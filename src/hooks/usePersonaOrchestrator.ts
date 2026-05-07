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
import { ChunkHighlights, CommentaryMessage, Persona, PersonaState, TranscriptChunk, WaveformState } from '@/types';
import { selectAgent, streamGemini, streamGeminiWithSearch } from '@/lib/gemini';

interface UsePersonaOrchestratorOptions {
  personas: Persona[];
  wordThreshold: number;
  apiKey: string;
  onWaveformStateChange: (personaId: string, state: WaveformState) => void;
}

interface UsePersonaOrchestratorReturn {
  personaStates: Record<string, PersonaState>;
  commentaryHistory: CommentaryMessage[];
  chunkHighlights: ChunkHighlights;
  onChunkCommitted: (chunkText: string, allChunks: TranscriptChunk[]) => void;
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
  onWaveformStateChange,
}: UsePersonaOrchestratorOptions): UsePersonaOrchestratorReturn {
  const [personaStates, setPersonaStates] = useState<PersonaStatesMap>({});
  const [commentaryHistory, setCommentaryHistory] = useState<CommentaryMessage[]>([]);
  const [chunkHighlights, setChunkHighlights] = useState<ChunkHighlights>({});

  const wordBufferRef = useRef<string[]>([]);
  const abortControllersRef = useRef<Record<string, AbortController>>({});
  // Synchronous streaming tracker (React state is async, this avoids stale closure re-triggers)
  const isStreamingRef = useRef<Record<string, boolean>>({});

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
      const userContent = `Full transcript (for background context only):\n"${fullContext}"\n\n=== RESPOND TO THIS SECTION ===\n"${latestChunk}"\n=== END SECTION ===\n\nYour commentary MUST be about the section above. Your [[quoted text]] MUST come from that section. You may reference the full transcript for context, but your response should be centered on what was just said.${priorStatements}\n\nProvide your commentary now.`;

      // Flash for search personas (grounding citations), flash-lite for the rest
      const personaModel = (persona.useSearch || persona.skipRelevance)
        ? 'gemini-3-flash-preview'
        : 'gemini-3.1-flash-lite-preview';

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
        const needsSearch = persona.useSearch || persona.skipRelevance;
        const streamFn = needsSearch ? streamGeminiWithSearch : streamGemini;

        let fullResponse = '';
        let firstToken = true;
        let tokenCount = 0;
        let collectedCitations: import('@/types').Citation[] = [];

        for await (const token of streamFn(persona.systemPrompt, userContent, {
          apiKey,
          model: personaModel,
          temperature: persona.temperature,
          maxOutputTokens: persona.maxTokens,
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

      // ── Agent Orchestrator: single call to select which persona to trigger ──
      // Always use flash for the orchestrator — speed is critical here
      const selectedId = await selectAgent(
        available.map((p) => ({ id: p.id, name: p.name, role: p.role })),
        fullContext,
        latestChunk,
        apiKey
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

  return { personaStates, commentaryHistory, chunkHighlights, onChunkCommitted };
}
