// src/types/index.ts
// Central type definitions for podcommentators

export type PersonaId = string;

export type WaveformState = 'idle' | 'thinking' | 'active';

export type AudioSource = 'mic' | 'camera' | 'stream' | 'screen' | 'system-audio';

export type AppMode = 'regular' | 'enhanced';

export type MediaType = 'audio' | 'video';

export interface Persona {
  id: PersonaId;
  name: string;
  role: string;
  icon: string;
  color: string;
  cooldown: number;   // seconds
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  systemPrompt: string;
  relevancePrompt: string; // loaded from prompts/<id>/relevance.md
  useSearch: boolean;      // enable Google Search grounding for this persona
  skipRelevance: boolean;  // skip separate relevance check; let the main prompt decide whether to respond
}

export interface Citation {
  uri: string;
  title: string;
}

export interface PersonaState {
  waveformState: WaveformState;
  currentResponse: string;
  isStreaming: boolean;
  cooldownUntil: number; // unix ms
  lastTriggeredAt: number;
  error: string | null;
  citations: Citation[];  // web sources from Google Search grounding
}

export interface CommentaryMessage {
  id: string;
  personaId: string;
  personaName: string;
  personaIcon: string;
  personaColor: string;
  text: string;
  quotedText: string;  // statement from transcript that triggered this commentary
  timestamp: number;
  citations: Citation[];
}

export interface TranscriptHighlight {
  text: string;   // substring to highlight in transcript
  color: string;  // persona color
}

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface AppSettings {
  apiKey: string;
  elevenLabsKey: string;
  model: string;
  wordThreshold: number;
  personas: Persona[];
  youtubeIngestUrl: string;
  youtubeStreamKey: string;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
