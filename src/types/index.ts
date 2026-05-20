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
  quotedText: string;      // statement from transcript that triggered this commentary
  triggerChunk: string;    // the raw transcript chunk that triggered this response
  triggerChunkIds: string[]; // IDs of transcript chunks that were highlighted for this response
  timestamp: number;
  citations: Citation[];
}

export interface TranscriptChunk {
  id: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

/** Maps a transcript chunk ID to the persona color that's highlighting it */
export type ChunkHighlights = Record<string, string>;

export interface AppSettings {
  apiKey: string;
  elevenLabsKey: string;
  model: string;
  wordThreshold: number;
  personas: Persona[];
  youtubeIngestUrl: string;
  youtubeStreamKey: string;
  agenda: string;
}

export interface AgendaLink {
  url: string;
  title: string;
  description: string;
}

export interface AgendaSubtopic {
  text: string;
  /** Host's notes + model-added supporting context. */
  details: string;
  /** Host-supplied URLs preserved + research-backed links found by the model. */
  links: AgendaLink[];
}

export interface AgendaTopic {
  title: string;
  subtopics: AgendaSubtopic[];
}

export type AgendaItemStatus = 'pending' | 'current' | 'covered';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
