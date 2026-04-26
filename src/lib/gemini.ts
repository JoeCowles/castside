// src/lib/gemini.ts
// Google Gemini API wrapper using @google/genai SDK.
// Uses generateContentStream for streaming responses.
// All calls go directly from the browser to Google's API — no backend needed.

import { GoogleGenAI } from '@google/genai';
import type { Citation } from '@/types';

// ── Retry helper ───────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000; // doubles on each attempt: 1s → 2s → 4s

/**
 * Runs `fn` up to MAX_RETRIES times, backing off exponentially between
 * attempts. The `signal` arg is optional — if it fires we stop immediately.
 *
 * Treats both thrown errors AND a null/undefined/empty result as failures
 * so that blank responses from a partially-degraded provider are retried.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  isBlank: (result: T) => boolean = () => false,
  label = 'LLM call',
  signal?: AbortSignal
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      const result = await fn();
      if (isBlank(result)) {
        const msg = `${label}: blank response on attempt ${attempt}/${MAX_RETRIES}`;
        console.warn(`[Retry] ⚠ ${msg}`);
        lastErr = new Error(msg);
      } else {
        if (attempt > 1) console.log(`[Retry] ✅ ${label} succeeded on attempt ${attempt}`);
        return result;
      }
    } catch (err) {
      // Never retry aborts
      if ((err as Error).name === 'AbortError') throw err;
      lastErr = err;
      console.warn(`[Retry] ⚠ ${label} failed on attempt ${attempt}/${MAX_RETRIES}:`, err);
    }
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.log(`[Retry] ⏳ ${label} — waiting ${delay}ms before attempt ${attempt + 1}`);
      await new Promise<void>((res, rej) => {
        const t = setTimeout(res, delay);
        signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('Aborted', 'AbortError')); });
      });
    }
  }
  throw lastErr;
}

/**
 * Resolve Vertex AI proxy/redirect URLs to their actual destinations.
 * The Gemini grounding API returns URLs like:
 *   https://vertexaisearch.cloud.google.com/grounding-api-redirect/...
 * which 302-redirect to the real source URL.
 *
 * Uses opaque fetch (no-cors mode) to follow redirects — since the redirect
 * lands on a different origin, we can't read `response.url` in no-cors.
 * Instead we do a HEAD with cors mode and catch the redirect URL.
 * Falls back to the original proxy URL if resolution fails.
 */
async function resolveProxyUrl(proxyUri: string): Promise<string> {
  try {
    const res = await fetch(proxyUri, { method: 'HEAD', redirect: 'follow' });
    // After following redirects, res.url is the final destination
    if (res.url && res.url !== proxyUri) return res.url;
  } catch {
    // CORS will block cross-origin HEAD in most cases — try extracting from URL structure
  }
  return proxyUri;
}

/**
 * Resolve all Vertex AI proxy citations to their actual source URLs.
 * Runs resolution in parallel with a short timeout per URL.
 */
async function resolveCitations(citations: Citation[]): Promise<Citation[]> {
  const resolved = await Promise.all(
    citations.map(async (c) => {
      if (!c.uri.includes('vertexaisearch.cloud.google.com')) return c;
      const realUri = await Promise.race([
        resolveProxyUrl(c.uri),
        new Promise<string>((res) => setTimeout(() => res(c.uri), 3000)),
      ]);
      // Derive a better title from the resolved domain if the title is generic
      let title = c.title;
      if (realUri !== c.uri) {
        try {
          const hostname = new URL(realUri).hostname.replace('www.', '');
          if (!title || title === c.uri || title.includes('vertexaisearch')) {
            title = hostname;
          }
        } catch { /* keep existing title */ }
      }
      return { uri: realUri, title };
    })
  );
  return resolved;
}

export interface StreamGeminiOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  /** Called once when the stream ends with any web citations from Google Search grounding */
  onCitations?: (citations: Citation[]) => void;
}

export interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
}

/**
 * Async generator that streams a Gemini response token by token.
 *
 * Usage:
 *   for await (const token of streamGemini(systemPrompt, userPrompt, opts)) { ... }
 *
 * API reference: https://ai.google.dev/gemini-api/docs/text-generation?lang=node
 */
export async function* streamGemini(
  systemInstruction: string,
  userContent: string,
  options: StreamGeminiOptions
): AsyncGenerator<string> {
  const {
    apiKey,
    model = 'gemini-3-flash-preview',
    temperature = 0.8,
    maxOutputTokens = 5000,
    signal,
  } = options;

  if (!apiKey) {
    throw new Error('No API key configured. Open Settings to add your Gemini API key.');
  }

  const ai = new GoogleGenAI({ apiKey });

  let cancelled = false;
  signal?.addEventListener('abort', () => {
    console.warn('[Gemini stream] ⛔ ABORTED via signal');
    cancelled = true;
  });

  console.log(`[Gemini stream] ▶ START  model=${model}  maxTokens=${maxOutputTokens}  temp=${temperature}`);

  const response = await withRetry(
    () => ai.models.generateContentStream({
      model,
      contents: userContent,
      config: { systemInstruction, temperature, maxOutputTokens },
    }),
    () => false, // streams are checked token-by-token below
    `streamGemini(${model})`,
    signal
  );

  let chunkCount = 0;
  let totalText = '';

  for await (const chunk of response) {
    if (cancelled) {
      console.warn(`[Gemini stream] ⛔ Cancelled after ${chunkCount} chunks / ${totalText.length} chars`);
      return;
    }

    const text = chunk.text;
    if (text) {
      chunkCount++;
      totalText += text;
      console.debug(`[Gemini stream]  · chunk #${chunkCount}: "${text}"`);
      yield text;
    }

    // Log finish reason on every chunk — it's only set on the final chunk
    const finishReason = chunk.candidates?.[0]?.finishReason;
    if (finishReason) {
      console.log(`[Gemini stream] 🏁 finishReason=${finishReason}  chunks=${chunkCount}  chars=${totalText.length}`);
      if (finishReason === 'MAX_TOKENS') {
        console.warn('[Gemini stream] ⚠ Hit MAX_TOKENS — response was truncated. Increase maxOutputTokens in personas.ts');
      }
      if (finishReason === 'SAFETY') {
        console.warn('[Gemini stream] ⚠ Blocked by safety filters');
      }
    }
  }

  console.log(`[Gemini stream] ✅ DONE  chunks=${chunkCount}  chars=${totalText.length}  text="${totalText.slice(0, 100)}${totalText.length > 100 ? '…' : ''}"`);
}

/**
 * Quick YES/NO relevance check — determines if a persona should trigger.
 * Non-streaming, maxOutputTokens=10. Returns true for YES, false for NO.
 *
 * @param relevancePrompt  The persona's relevance gate prompt (from .md file)
 * @param fullContext      The rolling last-10-chunks window (joined text)
 * @param latestChunk      The freshest buffered words that triggered this check
 */
export async function checkRelevance(
  relevancePrompt: string,
  fullContext: string,
  latestChunk: string,
  apiKey: string,
  model = 'gemini-3-flash-preview',
  personaName = 'unknown'
): Promise<boolean> {
  if (!apiKey) return true;

  // ── Detect missing/broken prompt file ─────────────────────────────────
  if (!relevancePrompt || relevancePrompt.trim().length < 20) {
    console.warn(
      `%c[Relevance] ⚠️ ${personaName}: relevancePrompt is EMPTY/MISSING (chars=${relevancePrompt?.length ?? 0}).\n` +
      `Check that Turbopack is loading .md files (restart npm run dev after installing raw-loader).`,
      'color: orange; font-weight: bold'
    );
    return true; // fail-open
  }

  const ai = new GoogleGenAI({ apiKey });

  // Mirror the two-section format used by the main commentary prompt so the
  // relevance model sees exactly the same context window the commentary model does.
  const contextBlock = `Conversation context (last 10 chunks):\n"${fullContext}"\n\nLatest new content:\n"${latestChunk}"`;
  const fullPrompt = `${relevancePrompt}\n\n${contextBlock}`;

  // ── Log FULL prompt ────────────────────────────────────────────────────
  console.groupCollapsed(
    `[Relevance] 🔎 ${personaName}  (promptChars=${relevancePrompt.length}  contextChars=${fullContext.length}  latestChars=${latestChunk.length})`
  );
  console.log('%cFULL PROMPT SENT TO GEMINI:', 'font-weight:bold; color:#7cb9e8');
  console.log(fullPrompt);
  console.groupEnd();

  try {
    const response = await withRetry(
      () => ai.models.generateContent({
        model,
        contents: fullPrompt,
        // 1000 tokens gives thinking models room to reason before emitting JSON
        config: { maxOutputTokens: 1000, temperature: 0 },
      }),
      (r) => {
        // Try both the SDK convenience getter and the manual path
        const viaGetter = (r.text ?? '').trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viaParts  = ((r as any).candidates?.[0]?.content?.parts ?? [])
          .map((p: { text?: string }) => p.text ?? '').join('').trim();
        const text = viaGetter || viaParts;
        if (!text) {
          // Log full response so we can see what the API actually returned
          console.warn('[Relevance] 🔍 Raw response object (blank text detected):', JSON.stringify(r, null, 2));
        }
        return !text; // true = blank = retry
      },
      `checkRelevance(${personaName})`
    );

    // Prefer SDK getter; fall back to manual candidate extraction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viaParts = ((response as any).candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '').join('').trim();
    const raw = ((response.text ?? '').trim()) || viaParts;

    // Strip markdown code fences (```json ... ```) and any other wrapper noise
    const stripped = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    let decision: boolean;
    try {
      const parsed = JSON.parse(stripped) as { trigger?: unknown };
      if (typeof parsed.trigger !== 'boolean') {
        throw new Error(`"trigger" field missing or not boolean (got: ${JSON.stringify(parsed)})`);
      }
      decision = parsed.trigger;
    } catch (parseErr) {
      // Unparseable JSON counts as a blank → propagate so withRetry catches it on next call
      throw new Error(`JSON parse failed for ${personaName}: ${(parseErr as Error).message} | raw="${raw}"`);
    }

    // ── Log raw response + decision ────────────────────────────────────
    console.log(
      `%c[Relevance] ${decision ? '✅ trigger=true  → TRIGGER' : '❌ trigger=false → SKIP  '} | ${personaName}`,
      `color:${decision ? '#34d399' : '#f87171'}; font-weight:bold`
    );
    console.log(`%c  raw response: "${raw}"`, 'color:#aaa; font-style:italic');

    return decision;
  } catch (err) {
    console.warn(`[Relevance] ⚠️ ${personaName}: all retries failed (defaulting to TRIGGER):`, err);
    return true;
  }
}

/**
 * Same as streamGemini but with Google Search grounding enabled.
 * Use for personas where real-time web data improves accuracy (Theo, Nova).
 *
 * Note: Google Search is billed per query on Gemini 3 models.
 * Docs: https://ai.google.dev/gemini-api/docs/google-search
 */
export async function* streamGeminiWithSearch(
  systemInstruction: string,
  userContent: string,
  options: StreamGeminiOptions
): AsyncGenerator<string> {
  const {
    apiKey,
    model = 'gemini-3.1-pro-preview',
    temperature = 0.7,
    maxOutputTokens = 5000,
    signal,
    onCitations,
  } = options;

  if (!apiKey) {
    throw new Error('No API key configured.');
  }

  const ai = new GoogleGenAI({ apiKey });

  let cancelled = false;
  signal?.addEventListener('abort', () => {
    console.warn('[Gemini search stream] ⛔ ABORTED via signal');
    cancelled = true;
  });

  console.log(`[Gemini search stream] 🔍 START with Google Search  model=${model}`);

  const response = await withRetry(
    () => ai.models.generateContentStream({
      model,
      contents: userContent,
      config: { systemInstruction, temperature, maxOutputTokens, tools: [{ googleSearch: {} }] },
    }),
    () => false, // streams are checked token-by-token below
    `streamGeminiWithSearch(${model})`,
    signal
  );

  let chunkCount = 0;
  let totalText = '';
  // Collect all grounding chunks (citations) across the stream
  const citationMap = new Map<string, Citation>(); // deduplicate by URI

  for await (const chunk of response) {
    if (cancelled) {
      console.warn(`[Gemini search stream] ⛔ Cancelled after ${chunkCount} chunks`);
      return;
    }
    const text = chunk.text;
    if (text) {
      chunkCount++;
      totalText += text;
      console.debug(`[Gemini search stream]  · chunk #${chunkCount}: "${text}"`);
      yield text;
    }

    // Extract web citations from Google Search grounding metadata
    const groundingMeta = chunk.candidates?.[0]?.groundingMetadata;
    const groundingChunks = groundingMeta?.groundingChunks;
    if (groundingChunks) {
      for (const gc of groundingChunks) {
        const web = gc.web;
        if (web?.uri && web.uri !== 'undefined') {
          citationMap.set(web.uri, { uri: web.uri, title: web.title ?? web.uri });
        }
      }
    }

    const finishReason = chunk.candidates?.[0]?.finishReason;
    if (finishReason) {
      console.log(`[Gemini search stream] 🏁 finishReason=${finishReason}  chunks=${chunkCount}  chars=${totalText.length}`);
      if (finishReason === 'MAX_TOKENS') {
        console.warn('[Gemini search stream] ⚠ Hit MAX_TOKENS');
      }
    }
  }

  const rawCitations = [...citationMap.values()];
  if (rawCitations.length > 0) {
    console.log(`[Gemini search stream] 🔗 ${rawCitations.length} raw citation(s):`, rawCitations.map((c) => c.uri));
  }
  // Resolve proxy URLs to actual source URLs
  const citations = rawCitations.length > 0 ? await resolveCitations(rawCitations) : [];
  if (citations.length > 0) {
    console.log(`[Gemini search stream] 🔗 Resolved citation(s):`, citations.map((c) => c.uri));
  }
  onCitations?.(citations);

  console.log(`[Gemini search stream] ✅ DONE  chunks=${chunkCount}  chars=${totalText.length}`);
}

/**
 * Transcribe a short audio blob using Gemini's audio understanding.
 * Pass inline base64 audio — works for chunks up to ~20 MB.
 *
 * Supported mime types: audio/webm, audio/mp4, audio/ogg, audio/wav, audio/mp3
 */
export async function transcribeWithGemini(
  audioBlob: Blob,
  apiKey: string,
  model = 'gemini-3-flash-preview'
): Promise<string> {
  if (!apiKey) throw new Error('No Gemini API key configured.');

  const ai = new GoogleGenAI({ apiKey });

  // Convert blob → ArrayBuffer → Uint8Array → base64
  const arrayBuffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const mimeType = audioBlob.type || 'audio/webm';

  const transcribePrompt = 'Transcribe the speech in this audio clip verbatim. Return ONLY the spoken words — no explanations, no punctuation descriptions, no labels. If there is no speech, return an empty string.';

  const response = await withRetry(
    () => ai.models.generateContent({
      model,
      contents: [{ parts: [{ inlineData: { mimeType, data: base64 } }, { text: transcribePrompt }] }],
    }),
    // Only retry blank transcription if audio contained speech (we can't know,
    // so we don't treat empty as a failure — silence is valid)
    () => false,
    `transcribeWithGemini(${model})`
  );

  return (response.text ?? '').trim();
}

export async function validateGeminiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const gen = streamGemini('You are helpful.', 'Say "ok".', {
      apiKey,
      model: 'gemini-3-flash-preview',
      maxOutputTokens: 5,
    });
    await gen.next();
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}
