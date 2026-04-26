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
import { CommentaryMessage, Persona, PersonaState, TranscriptChunk, WaveformState } from '@/types';
import { checkRelevance, streamGemini, streamGeminiWithSearch, factCheckWithSearch } from '@/lib/gemini';

interface UsePersonaOrchestratorOptions {
  personas: Persona[];
  wordThreshold: number;
  apiKey: string;
  model: string;
  onWaveformStateChange: (personaId: string, state: WaveformState) => void;
}

interface UsePersonaOrchestratorReturn {
  personaStates: Record<string, PersonaState>;
  commentaryHistory: CommentaryMessage[];
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
  model,
  onWaveformStateChange,
}: UsePersonaOrchestratorOptions): UsePersonaOrchestratorReturn {
  const [personaStates, setPersonaStates] = useState<PersonaStatesMap>({});
  const [commentaryHistory, setCommentaryHistory] = useState<CommentaryMessage[]>([]);

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
  const buildPriorStatements = useCallback((personaId: string, limit = 5): string => {
    const msgs = commentaryHistoryRef.current
      .filter((m) => m.personaId === personaId)
      .slice(-limit);
    if (msgs.length === 0) return '';
    const lines = msgs.map((m, i) => `${i + 1}. ${m.text.slice(0, 200)}`).join('\n');
    return `\n\nYour previous statements (do NOT repeat these):\n${lines}`;
  }, []);

  const triggerPersona = useCallback(
    async (persona: Persona, latestChunk: string, fullContext: string) => {
      if (!apiKey) return;

      const triggerId = `${persona.id}-${Date.now()}`;

      const priorStatements = buildPriorStatements(persona.id);
      const userContent = `Conversation context (last ~10 exchanges):\n"${fullContext}"\n\nLatest new content:\n"${latestChunk}"${priorStatements}\n\nProvide your commentary now.`;

      // ── Stage 1: Relevance gate ─────────────────────────────────────────
      // For skipRelevance personas (e.g. Theo), run the fact-check gate BEFORE
      // showing any UI, so the card never appears if there's nothing to report.
      if (persona.skipRelevance) {
        isStreamingRef.current[persona.id] = true;
        try {
          const result = await factCheckWithSearch(persona.systemPrompt, userContent, {
            apiKey,
            model,
            temperature: persona.temperature,
            maxOutputTokens: persona.maxTokens,
          });

          isStreamingRef.current[persona.id] = false;

          if (!result.responded) {
            console.log(`[Orchestrator] ⏭ ${persona.name} no inaccuracy found — skipping  triggerId=${triggerId}`);
            return; // No UI state change at all — card never appears
          }

          // Inaccuracy found — show the card with the result
          console.log(`[Orchestrator] ▶ ${persona.name} found inaccuracy — showing card  triggerId=${triggerId}`);
          const { quotedText, cleanText } = parseQuotedStatement(result.text);
          const cooldownUntil = Date.now() + persona.cooldown * 1000;

          // Set the card to 'active' with all data in a single state update
          // so citations and response text are not lost to React batching.
          updatePersonaState(persona.id, {
            isStreaming: true,
            waveformState: 'active',
            currentResponse: cleanText,
            cooldownUntil,
            lastTriggeredAt: Date.now(),
            error: null,
            citations: result.citations,
          });
          onWaveformStateChange(persona.id, 'active');

          // Settle the card after a brief moment so the slide-in animation plays
          setTimeout(() => {
            updatePersonaState(persona.id, { isStreaming: false, waveformState: 'idle' });
            onWaveformStateChange(persona.id, 'idle');
          }, 500);

          if (cleanText.trim()) {
            setCommentaryHistory((prev) => [...prev, {
              id: triggerId,
              personaId: persona.id,
              personaName: persona.name,
              personaIcon: persona.icon,
              personaColor: persona.color,
              text: cleanText,
              quotedText,
              triggerChunk: latestChunk,
              timestamp: Date.now(),
              citations: result.citations,
            }]);
          }
        } catch (err) {
          isStreamingRef.current[persona.id] = false;
          if ((err as Error).name === 'AbortError') return;
          console.error(`[Orchestrator] ❌ ${persona.name} error:`, err, `triggerId=${triggerId}`);
        }
        return;
      }

      // For normal personas, run the relevance check before showing UI
      const relevant = await checkRelevance(persona.relevancePrompt, fullContext, latestChunk, apiKey, model, persona.name);
      if (!relevant) {
        console.log(`[Orchestrator] ⏭ ${persona.name} skipped (relevance=NO)  triggerId=${triggerId}`);
        return;
      }

      // ── Stage 2: Mark as active ─────────────────────────────────────────
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
        // ── Standard streaming path ─────────────────────────────────────────
        const streamFn = persona.useSearch ? streamGeminiWithSearch : streamGemini;

        let fullResponse = '';
        let firstToken = true;
        let tokenCount = 0;
        let collectedCitations: import('@/types').Citation[] = [];

        for await (const token of streamFn(persona.systemPrompt, userContent, {
          apiKey,
          model,
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
          // Strip [[...]] prefix from displayed text so users don't see brackets
          const { cleanText: displayText } = parseQuotedStatement(fullResponse);
          updatePersonaState(persona.id, { currentResponse: displayText });
        }

        console.log(`[Orchestrator] ✅ ${persona.name} DONE  tokens=${tokenCount}  chars=${fullResponse.length}  triggerId=${triggerId}`);
        isStreamingRef.current[persona.id] = false;

        // Parse [[quoted statement]] from the response
        const { quotedText, cleanText } = parseQuotedStatement(fullResponse);
        if (quotedText) {
          updatePersonaState(persona.id, { isStreaming: false, waveformState: 'idle', currentResponse: cleanText });
        } else {
          updatePersonaState(persona.id, { isStreaming: false, waveformState: 'idle' });
        }
        onWaveformStateChange(persona.id, 'idle');

        if (cleanText.trim()) {
          setCommentaryHistory((prev) => [...prev, {
            id: triggerId,
            personaId: persona.id,
            personaName: persona.name,
            personaIcon: persona.icon,
            personaColor: persona.color,
            text: cleanText,
            quotedText,
            triggerChunk: latestChunk,
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
    [apiKey, model, updatePersonaState, onWaveformStateChange, buildPriorStatements]
  );

  const triggerAll = useCallback(
    (latestChunk: string, allChunks: TranscriptChunk[]) => {
      // Build a rolling window of the last 10 chunks as the full context.
      // This is passed to both the relevance gate and the commentary prompt.
      const last10 = allChunks.slice(-10).map((c) => c.text);
      // Append the latest buffered chunk (may not be committed yet)
      if (!last10.includes(latestChunk)) last10.push(latestChunk);
      const fullContext = last10.join(' ');

      const now = Date.now();

      console.log(
        `[Orchestrator] 🟡 triggerAll  newWords=${latestChunk.split(/\s+/).length}` +
        `  contextChunks=${last10.length}  contextWords=${fullContext.split(/\s+/).length}` +
        `  enabledPersonas=${personas.filter(p => p.enabled).length}`
      );

      personas
        .filter((p) => p.enabled)
        .forEach((persona, index) => {
          const state = personaStates[persona.id];
          // Skip if on cooldown
          if (state && now < state.cooldownUntil) {
            console.log(`[Orchestrator]   ⏳ ${persona.name} on cooldown (${Math.ceil((state.cooldownUntil - now) / 1000)}s remaining)`);
            return;
          }
          // Skip if currently streaming — use the ref for synchronous accuracy
          if (isStreamingRef.current[persona.id]) {
            console.log(`[Orchestrator]   💬 ${persona.name} still streaming — skipping`);
            return;
          }
          console.log(`[Orchestrator]   ✅ ${persona.name} queued for relevance check (delay=${index * 200}ms)`);
          // Stagger to avoid rate limits; relevance check happens before full trigger
          setTimeout(() => triggerPersona(persona, latestChunk, fullContext), index * 200);
        });
    },
    [personas, personaStates, triggerPersona]
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

  return { personaStates, commentaryHistory, onChunkCommitted };
}
