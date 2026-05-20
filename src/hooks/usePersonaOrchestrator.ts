'use client';
// src/hooks/usePersonaOrchestrator.ts
// Watches the transcript word buffer and triggers persona AI responses.
//
// FLOW per persona on each word batch:
//   1. checkRelevance  → cheap YES/NO Gemini call
//      NO  → log skip, no state change, no cooldown consumed
//      YES → continue
//      (skipRelevance personas skip this step entirely)
//   2. Set waveformState = 'thinking'
//   3. Generate/stream commentary via:
//      - factCheckWithSearch  (if skipRelevance — non-streaming with tool call)
//      - streamGeminiWithSearch  (if persona.useSearch = true)
//      - streamGemini            (all other personas)
//   4. Stream tokens → update currentResponse in real time
//   5. Set waveformState = 'idle', apply cooldown

import { useCallback, useEffect, useRef, useState } from 'react';
import { AgendaTopic, ChunkHighlights, CommentaryMessage, Persona, PersonaState, TranscriptChunk, WaveformState } from '@/types';
import { classifyAgendaTopic, parseAgendaTopics, selectAgent, streamGemini, streamGeminiWithSearch } from '@/lib/gemini';

interface UsePersonaOrchestratorOptions {
  personas: Persona[];
  wordThreshold: number;
  apiKey: string;
  agenda?: string;
  onWaveformStateChange: (personaId: string, state: WaveformState) => void;
}

interface UsePersonaOrchestratorReturn {
  personaStates: Record<string, PersonaState>;
  commentaryHistory: CommentaryMessage[];
  chunkHighlights: ChunkHighlights;
  onChunkCommitted: (chunkText: string, allChunks: TranscriptChunk[]) => void;
  agendaTopics: AgendaTopic[];
  currentAgendaIndex: number | null;
  coveredAgendaIndices: Set<number>;
  currentSubtopicIndex: number | null;
  coveredSubtopicKeys: Set<string>;
  agendaParsing: boolean;
}

/** Stable key for a subtopic — used in the covered set so it can span topics. */
function subKey(topicIdx: number, subIdx: number): string {
  return `${topicIdx}:${subIdx}`;
}

/** Fallback line-splitter used only when no API key is available. */
function fallbackParseAgenda(agenda: string): AgendaTopic[] {
  if (!agenda.trim()) return [];
  return agenda
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, 20)
    .map((title) => ({ title, subtopics: [] as AgendaTopic['subtopics'] }));
}

function makeInitialState(): PersonaState {
  return {
    waveformState: 'idle',
    currentResponse: '',
    isStreaming: false,
    cooldownUntil: 0,
    lastTriggeredAt: 0,
    error: null,
    citations: [],
  };
}

type PersonaStatesMap = Record<string, PersonaState>;

/** Extract a [[quoted statement]] from the beginning of a response and return the quote + cleaned text. */
function parseQuotedStatement(raw: string): { quotedText: string; cleanText: string } {
  const match = raw.match(/^\s*\[\[([\s\S]+?)\]\]\s*/);
  if (!match) return { quotedText: '', cleanText: raw };
  return { quotedText: match[1].trim(), cleanText: raw.slice(match[0].length).trim() };
}

export function usePersonaOrchestrator({
  personas,
  wordThreshold,
  apiKey,
  agenda = '',
  onWaveformStateChange,
}: UsePersonaOrchestratorOptions): UsePersonaOrchestratorReturn {
  const [personaStates, setPersonaStates] = useState<PersonaStatesMap>({});
  const [commentaryHistory, setCommentaryHistory] = useState<CommentaryMessage[]>([]);
  const [chunkHighlights, setChunkHighlights] = useState<ChunkHighlights>({});
  const [currentAgendaIndex, setCurrentAgendaIndex] = useState<number | null>(null);
  const [coveredAgendaIndices, setCoveredAgendaIndices] = useState<Set<number>>(() => new Set());
  const [currentSubtopicIndex, setCurrentSubtopicIndex] = useState<number | null>(null);
  const [coveredSubtopicKeys, setCoveredSubtopicKeys] = useState<Set<string>>(() => new Set());

  const wordBufferRef = useRef<string[]>([]);
  const abortControllersRef = useRef<Record<string, AbortController>>({});
  // Synchronous streaming tracker (React state is async, this avoids stale closure re-triggers)
  const isStreamingRef = useRef<Record<string, boolean>>({});
  // Keep agenda accessible inside callbacks without recreating them on every keystroke
  const agendaRef = useRef(agenda);
  useEffect(() => { agendaRef.current = agenda; }, [agenda]);

  // Agenda topics are parsed by Gemini so that long agendas with many
  // sub-bullets/details collapse down to actual segments — with the detail
  // lines preserved as subtopics for use as commentator context.
  const [agendaTopics, setAgendaTopics] = useState<AgendaTopic[]>([]);
  const [agendaParsing, setAgendaParsing] = useState(false);
  const agendaTopicsRef = useRef<AgendaTopic[]>([]);
  useEffect(() => { agendaTopicsRef.current = agendaTopics; }, [agendaTopics]);

  const currentAgendaIndexRef = useRef<number | null>(null);
  useEffect(() => { currentAgendaIndexRef.current = currentAgendaIndex; }, [currentAgendaIndex]);

  const currentSubtopicIndexRef = useRef<number | null>(null);
  useEffect(() => { currentSubtopicIndexRef.current = currentSubtopicIndex; }, [currentSubtopicIndex]);

  // Refs for covered sets so the classifier callback can read them synchronously
  // without re-creating triggerAll on every covered-set change.
  const coveredAgendaIndicesRef = useRef<Set<number>>(new Set());
  useEffect(() => { coveredAgendaIndicesRef.current = coveredAgendaIndices; }, [coveredAgendaIndices]);
  const coveredSubtopicKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => { coveredSubtopicKeysRef.current = coveredSubtopicKeys; }, [coveredSubtopicKeys]);

  // Parse the agenda whenever it changes. The agenda only changes when the
  // user explicitly saves it (via SettingsContext.updateSettings), so this
  // doesn't refire on every keystroke.
  useEffect(() => {
    const trimmed = agenda.trim();

    // Reset tracker progress whenever the agenda source changes
    setCurrentAgendaIndex(null);
    setCoveredAgendaIndices(new Set());
    setCurrentSubtopicIndex(null);
    setCoveredSubtopicKeys(new Set());

    if (!trimmed) {
      setAgendaTopics([]);
      setAgendaParsing(false);
      return;
    }

    if (!apiKey) {
      // Local-only fallback so the UI still works without a key
      setAgendaTopics(fallbackParseAgenda(trimmed));
      setAgendaParsing(false);
      return;
    }

    let cancelled = false;
    setAgendaParsing(true);
    parseAgendaTopics(trimmed, apiKey)
      .then((topics) => {
        if (cancelled) return;
        setAgendaTopics(topics.length > 0 ? topics : fallbackParseAgenda(trimmed));
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[Orchestrator] agenda parse failed:', err);
        setAgendaTopics(fallbackParseAgenda(trimmed));
      })
      .finally(() => {
        if (!cancelled) setAgendaParsing(false);
      });

    return () => { cancelled = true; };
  }, [agenda, apiKey]);

  // Synchronous guard so we don't fire overlapping classifier calls
  const classifyingRef = useRef(false);

  const updatePersonaState = useCallback((id: string, patch: Partial<PersonaState>) => {
    setPersonaStates((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? makeInitialState()), ...patch },
    }));
  }, []);

  // Ref so triggerPersona always reads current history without re-creating the callback
  const commentaryHistoryRef = useRef<CommentaryMessage[]>([]);
  useEffect(() => { commentaryHistoryRef.current = commentaryHistory; }, [commentaryHistory]);

  /** Build a short summary of this persona's recent statements to avoid repetition. */
  const buildPriorStatements = useCallback((personaId: string, limit = 10): string => {
    const allMsgs = commentaryHistoryRef.current.slice(-limit);
    if (allMsgs.length === 0) return '';
    const lines = allMsgs.map((m, i) => {
      const label = m.personaId === personaId ? 'You' : m.personaName;
      return `${i + 1}. [${label}] ${m.text}`;
    }).join('\n');
    return `\n\n=== PREVIOUS COMMENTARY (ALREADY SAID — DO NOT REPEAT) ===\n${lines}\n=== END PREVIOUS COMMENTARY ===\n\nThe above comments have ALREADY been made. Do NOT repeat, rephrase, or cover the same facts/topics. Find a completely different angle or say something entirely new.`;
  }, []);

  /** Highlight transcript chunks with a persona's color */
  const highlightChunks = useCallback((chunkIds: string[], color: string) => {
    setChunkHighlights((prev) => {
      const next = { ...prev };
      chunkIds.forEach((id) => { next[id] = color; });
      return next;
    });
  }, []);

  const triggerPersona = useCallback(
    async (persona: Persona, latestChunk: string, fullContext: string, triggerChunkIds: string[]) => {
      if (!apiKey) return;

      const triggerId = `${persona.id}-${Date.now()}`;

      const priorStatements = buildPriorStatements(persona.id);

      const currentAgenda = agendaRef.current.trim();
      const topics = agendaTopicsRef.current;
      const idx = currentAgendaIndexRef.current;
      const subIdx = currentSubtopicIndexRef.current;
      let currentTopicLine = '';
      if (idx !== null && topics[idx]) {
        const current = topics[idx];
        const subBlock = current.subtopics.length
          ? `\nContext / talking points for this segment (→ marks current subpoint):\n${current.subtopics
              .map((s, i) => {
                const marker = i === subIdx ? '→' : '-';
                const detail = s.details ? `\n   ${i === subIdx ? ' ' : ' '}  · ${s.details}` : '';
                return `${marker} ${s.text}${detail}`;
              })
              .join('\n')}`
          : '';
        const subLine = subIdx !== null && current.subtopics[subIdx]
          ? ` (currently on subpoint: "${current.subtopics[subIdx].text}")`
          : '';
        currentTopicLine = `\n\nCurrent agenda item being discussed: "${current.title}"${subLine}.${subBlock}\nFrame your commentary so it lands inside this segment.`;
      }
      const agendaBlock = currentAgenda
        ? `\n\n=== EPISODE AGENDA / SHOW NOTES ===\n${currentAgenda}\n=== END AGENDA ===${currentTopicLine}\n\nUse the agenda above to ground your commentary — it tells you the host's plan, guests, and intended angles. Don't just recap the agenda; react to what's being said with that plan in mind.\n`
        : '';

      const userContent = `${agendaBlock}Full transcript (for background context only):\n"${fullContext}"\n\n=== RESPOND TO THIS SECTION ===\n"${latestChunk}"\n=== END SECTION ===\n\nYour commentary MUST be about the section above. Your [[quoted text]] MUST come from that section. You may reference the full transcript for context, but your response should be centered on what was just said.${priorStatements}\n\nProvide your commentary now.`;

      // Flash for search personas (grounding citations), flash-lite for the rest
      const needsThinking = persona.useSearch || persona.skipRelevance;
      const personaModel = needsThinking
        ? 'gemini-3-flash-preview'
        : 'gemini-3.1-flash-lite-preview';
      // The thinking-enabled flash model burns tokens on internal reasoning + tool
      // calls before emitting visible output. Anything under ~4k tends to truncate
      // mid-response (or produce a blank), so floor it here for those personas.
      const maxOutputTokens = needsThinking
        ? Math.max(persona.maxTokens, 4000)
        : persona.maxTokens;

      // ── All personas use the same streaming path ──
      console.log(`[Orchestrator] ▶ triggerPersona  id=${triggerId}  persona=${persona.name}  useSearch=${persona.useSearch}`);
      isStreamingRef.current[persona.id] = true;

      const controller = new AbortController();
      abortControllersRef.current[persona.id] = controller;

      const cooldownUntil = Date.now() + persona.cooldown * 1000;
      updatePersonaState(persona.id, {
        isStreaming: true,
        currentResponse: '',
        waveformState: 'thinking',
        cooldownUntil,
        lastTriggeredAt: Date.now(),
        error: null,
        citations: [],
      });
      onWaveformStateChange(persona.id, 'thinking');

      try {
        const streamFn = needsThinking ? streamGeminiWithSearch : streamGemini;

        let fullResponse = '';
        let firstToken = true;
        let tokenCount = 0;
        let collectedCitations: import('@/types').Citation[] = [];

        for await (const token of streamFn(persona.systemPrompt, userContent, {
          apiKey,
          model: personaModel,
          temperature: persona.temperature,
          maxOutputTokens,
          signal: controller.signal,
          onCitations: (citations) => {
            if (citations.length > 0) {
              collectedCitations = citations;
              updatePersonaState(persona.id, { citations });
            }
          },
        })) {
          if (firstToken) {
            console.log(`[Orchestrator] 💬 First token for ${persona.name} (triggerId=${triggerId})`);
            onWaveformStateChange(persona.id, 'active');
            updatePersonaState(persona.id, { waveformState: 'active' });
            firstToken = false;
          }
          tokenCount++;
          fullResponse += token;
          const { cleanText: displayText } = parseQuotedStatement(fullResponse);
          updatePersonaState(persona.id, { currentResponse: displayText });
        }

        console.log(`[Orchestrator] ✅ ${persona.name} DONE  tokens=${tokenCount}  chars=${fullResponse.length}  triggerId=${triggerId}`);
        isStreamingRef.current[persona.id] = false;

        const { quotedText, cleanText } = parseQuotedStatement(fullResponse);
        if (quotedText) {
          updatePersonaState(persona.id, { isStreaming: false, waveformState: 'idle', currentResponse: cleanText });
        } else {
          updatePersonaState(persona.id, { isStreaming: false, waveformState: 'idle' });
        }
        onWaveformStateChange(persona.id, 'idle');

        if (cleanText.trim()) {
          // Highlight transcript chunks after the response is complete
          highlightChunks(triggerChunkIds, persona.color);
          setCommentaryHistory((prev) => [...prev, {
            id: triggerId,
            personaId: persona.id,
            personaName: persona.name,
            personaIcon: persona.icon,
            personaColor: persona.color,
            text: cleanText,
            quotedText,
            triggerChunk: latestChunk,
            triggerChunkIds,
            timestamp: Date.now(),
            citations: collectedCitations,
          }]);
        }
      } catch (err) {
        isStreamingRef.current[persona.id] = false;
        if ((err as Error).name === 'AbortError') {
          console.warn(`[Orchestrator] ⛔ ${persona.name} aborted (triggerId=${triggerId})`);
          return;
        }
        console.error(`[Orchestrator] ❌ ${persona.name} error:`, err, `triggerId=${triggerId}`);
        updatePersonaState(persona.id, {
          isStreaming: false,
          waveformState: 'idle',
          error: (err as Error).message,
        });
        onWaveformStateChange(persona.id, 'idle');
      }
    },
    [apiKey, updatePersonaState, onWaveformStateChange, buildPriorStatements, highlightChunks]
  );

  const triggerAll = useCallback(
    async (latestChunk: string, allChunks: TranscriptChunk[]) => {
      // Pass the FULL transcript as context (not just last 10)
      const allTexts = allChunks.map((c) => c.text);
      if (!allTexts.some((t) => t === latestChunk)) allTexts.push(latestChunk);
      const fullContext = allTexts.join(' ');

      const now = Date.now();

      // Filter to personas that are available (enabled, not on cooldown, not streaming)
      const available = personas.filter((p) => {
        if (!p.enabled) return false;
        const state = personaStates[p.id];
        if (state && now < state.cooldownUntil) {
          console.log(`[Orchestrator]   ⏳ ${p.name} on cooldown (${Math.ceil((state.cooldownUntil - now) / 1000)}s remaining)`);
          return false;
        }
        if (isStreamingRef.current[p.id]) {
          console.log(`[Orchestrator]   💬 ${p.name} still streaming — skipping`);
          return false;
        }
        return true;
      });

      if (available.length === 0) {
        console.log('[Orchestrator] 🟡 No available personas — skipping');
        return;
      }

      console.log(
        `[Orchestrator] 🟡 triggerAll  newWords=${latestChunk.split(/\s+/).length}` +
        `  contextChunks=${allTexts.length}  contextWords=${fullContext.split(/\s+/).length}` +
        `  availablePersonas=${available.length}`
      );

      // Collect IDs of the most recent chunks that comprise the latest buffered text
      // (the last few chunks that contributed words to this trigger)
      const recentChunkIds = allChunks.slice(-3).map((c) => c.id);

      // ── Agenda classifier (fire-and-forget) — top-level topic + subtopic ──
      const topicsForClassify = agendaTopicsRef.current;
      if (topicsForClassify.length > 0 && !classifyingRef.current) {
        classifyingRef.current = true;
        classifyAgendaTopic(topicsForClassify, fullContext, latestChunk, apiKey)
          .then(({ topicIndex, subtopicIndex }) => {
            if (topicIndex === null) return;
            const prevTopic = currentAgendaIndexRef.current;
            const prevSub = currentSubtopicIndexRef.current;
            const coveredTopics = coveredAgendaIndicesRef.current;
            const coveredSubs = coveredSubtopicKeysRef.current;

            if (prevTopic !== topicIndex) {
              // Speakers may have referenced an earlier topic — once we've moved
              // past it, never reopen. Stay on the current topic.
              if (coveredTopics.has(topicIndex)) return;

              // Genuinely moved on to a new (un-crossed) topic.
              setCurrentAgendaIndex(topicIndex);
              // Pick up a subtopic for the new topic only if it isn't already crossed off.
              const nextSub =
                subtopicIndex !== null && !coveredSubs.has(subKey(topicIndex, subtopicIndex))
                  ? subtopicIndex
                  : null;
              setCurrentSubtopicIndex(nextSub);

              if (prevTopic !== null) {
                setCoveredAgendaIndices((prev) => {
                  if (prev.has(prevTopic)) return prev;
                  const next = new Set(prev);
                  next.add(prevTopic);
                  return next;
                });
                // Whatever subtopic we were last on in the previous topic
                // gets crossed off — the speakers moved on.
                if (prevSub !== null) {
                  setCoveredSubtopicKeys((prev) => {
                    const key = subKey(prevTopic, prevSub);
                    if (prev.has(key)) return prev;
                    const next = new Set(prev);
                    next.add(key);
                    return next;
                  });
                }
              }
            } else if (subtopicIndex !== null && subtopicIndex !== prevSub) {
              // Same top-level topic, different subtopic candidate.
              // Skip if it's already crossed off — never reopen subpoints either.
              if (coveredSubs.has(subKey(topicIndex, subtopicIndex))) return;

              setCurrentSubtopicIndex(subtopicIndex);
              if (prevSub !== null) {
                setCoveredSubtopicKeys((prev) => {
                  const key = subKey(topicIndex, prevSub);
                  if (prev.has(key)) return prev;
                  const next = new Set(prev);
                  next.add(key);
                  return next;
                });
              }
            }
          })
          .catch((err) => console.warn('[Orchestrator] agenda classify failed:', err))
          .finally(() => { classifyingRef.current = false; });
      }

      // ── Agent Orchestrator: single call to select which persona to trigger ──
      // Always use flash for the orchestrator — speed is critical here
      const selectedId = await selectAgent(
        available.map((p) => ({ id: p.id, name: p.name, role: p.role })),
        fullContext,
        latestChunk,
        apiKey,
        undefined,
        agendaRef.current
      );

      if (!selectedId) {
        console.log('[Orchestrator] ⏭ Orchestrator selected none — skipping');
        return;
      }

      const persona = available.find((p) => p.id === selectedId);
      if (!persona) return;

      console.log(`[Orchestrator] ✅ Orchestrator selected: ${persona.name} (${persona.id})`);
      triggerPersona(persona, latestChunk, fullContext, recentChunkIds);
    },
    [personas, personaStates, triggerPersona, apiKey]
  );

  const onChunkCommitted = useCallback(
    (chunkText: string, allChunks: TranscriptChunk[]) => {
      const words = chunkText.trim().split(/\s+/).filter(Boolean);
      wordBufferRef.current.push(...words);

      if (wordBufferRef.current.length >= wordThreshold) {
        const bufferedText = wordBufferRef.current.join(' ');
        wordBufferRef.current = [];
        triggerAll(bufferedText, allChunks);
      }
    },
    [wordThreshold, triggerAll]
  );

  useEffect(() => {
    setPersonaStates((prev) => {
      const next: PersonaStatesMap = {};
      personas.forEach((persona) => {
        next[persona.id] = prev[persona.id] ?? makeInitialState();
      });
      return next;
    });

    Object.keys(abortControllersRef.current).forEach((id) => {
      if (!personas.some((persona) => persona.id === id)) {
        abortControllersRef.current[id]?.abort();
        delete abortControllersRef.current[id];
        delete isStreamingRef.current[id];
      }
    });
  }, [personas]);

  return {
    personaStates,
    commentaryHistory,
    chunkHighlights,
    onChunkCommitted,
    agendaTopics,
    currentAgendaIndex,
    coveredAgendaIndices,
    currentSubtopicIndex,
    coveredSubtopicKeys,
    agendaParsing,
  };
}
