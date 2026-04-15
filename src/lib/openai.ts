// src/lib/openai.ts
// OpenAI chat completions (streaming) and Whisper transcription wrapper.
// All calls go directly from the browser to api.openai.com — no backend needed.

import { OpenAIMessage } from '@/types';

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

export interface StreamChatOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * Async generator that streams a chat completion response token by token.
 *
 * Usage:
 *   for await (const token of streamChat(messages, opts)) { ... }
 */
export async function* streamChat(
  messages: OpenAIMessage[],
  options: StreamChatOptions
): AsyncGenerator<string> {
  const { apiKey, model = 'gpt-4o-mini', temperature = 0.8, maxTokens = 150, signal } = options;

  if (!apiKey) {
    throw new Error('No API key configured. Open Settings to add your OpenAI API key.');
  }

  const response = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: maxTokens,
      temperature,
    }),
    signal,
  });

  if (!response.ok) {
    let errMsg = `OpenAI API error ${response.status}`;
    try {
      const errBody = await response.json();
      errMsg = (errBody as { error?: { message?: string } })?.error?.message ?? errMsg;
    } catch {
      // ignore parse error
    }
    throw new Error(errMsg);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      const jsonStr = trimmed.slice(6);
      try {
        const parsed = JSON.parse(jsonStr) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // skip malformed SSE chunks
      }
    }
  }
}

/**
 * Transcribe an audio blob via OpenAI Whisper API.
 */
export async function transcribeAudio(audioBlob: Blob, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error('No API key configured.');

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  const response = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    let errMsg = `Whisper API error ${response.status}`;
    try {
      const errBody = await response.json();
      errMsg = (errBody as { error?: { message?: string } })?.error?.message ?? errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = (await response.json()) as { text?: string };
  return data.text ?? '';
}

/**
 * Validate an API key with a minimal test call.
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const gen = streamChat([{ role: 'user', content: 'Say "ok".' }], {
      apiKey,
      model: 'gpt-4o-mini',
      maxTokens: 5,
    });
    await gen.next();
    return { valid: true };
  } catch (err) {
    return { valid: false, error: (err as Error).message };
  }
}
