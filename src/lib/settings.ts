// src/lib/settings.ts
// Load and save AppSettings from localStorage with migration for older installs.

import { AppSettings, Persona } from '@/types';
import { DEFAULT_PERSONAS, makeDefaultPersonas } from '@/lib/personas';

const STORAGE_KEY = 'podcommentators_settings';
const listeners = new Set<() => void>();
let cachedRawSettings: string | null | undefined;
let cachedSettingsSnapshot: AppSettings | null = null;

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  elevenLabsKey: '',
  model: 'gemini-3.1-pro-preview',
  wordThreshold: 50,
  personas: makeDefaultPersonas(),
  youtubeIngestUrl: 'rtmps://a.rtmps.youtube.com/live2',
  youtubeStreamKey: '',
};

function makeDefaultSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    personas: makeDefaultPersonas(),
  };
}

function mergePersona(defaultPersona: Persona, savedPersona?: Partial<Persona>): Persona {
  return {
    ...defaultPersona,
    ...savedPersona,
    id: savedPersona?.id || defaultPersona.id,
    name: savedPersona?.name || defaultPersona.name,
    role: savedPersona?.role || defaultPersona.role,
    icon: savedPersona?.icon || defaultPersona.icon,
    systemPrompt: savedPersona?.systemPrompt || defaultPersona.systemPrompt,
    relevancePrompt: savedPersona?.relevancePrompt || defaultPersona.relevancePrompt,
  };
}

function migratePersonas(raw: unknown): Persona[] {
  if (!raw || typeof raw !== 'object') {
    return makeDefaultPersonas();
  }

  const maybeSettings = raw as {
    personas?: Persona[];
    personaStates?: Record<string, boolean>;
  };

  if (Array.isArray(maybeSettings.personas) && maybeSettings.personas.length > 0) {
    return maybeSettings.personas.map((persona) => ({
      ...createSafePersona(persona),
    }));
  }

  const legacyStates = maybeSettings.personaStates ?? {};
  return DEFAULT_PERSONAS.map((persona) =>
    mergePersona(persona, { enabled: legacyStates[persona.id] ?? persona.enabled })
  );
}

function createSafePersona(persona: Partial<Persona>): Persona {
  const fallback = DEFAULT_PERSONAS.find((entry) => entry.id === persona.id) ?? DEFAULT_PERSONAS[0];
  return {
    ...fallback,
    ...persona,
    id: persona.id || crypto.randomUUID(),
    name: persona.name || 'Commentator',
    role: persona.role || 'Analyst',
    icon: persona.icon || fallback.icon,
    color: persona.color || fallback.color,
    cooldown: persona.cooldown ?? fallback.cooldown,
    temperature: persona.temperature ?? fallback.temperature,
    maxTokens: persona.maxTokens ?? fallback.maxTokens,
    enabled: persona.enabled ?? true,
    systemPrompt: persona.systemPrompt || fallback.systemPrompt,
    relevancePrompt: persona.relevancePrompt || fallback.relevancePrompt,
    useSearch: persona.useSearch ?? fallback.useSearch,
    skipRelevance: persona.skipRelevance ?? fallback.skipRelevance,
  };
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return makeDefaultSettings();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRawSettings && cachedSettingsSnapshot) {
      return cachedSettingsSnapshot;
    }
    if (!raw) {
      const fallback = makeDefaultSettings();
      cachedRawSettings = raw;
      cachedSettingsSnapshot = fallback;
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings> & { personaStates?: Record<string, boolean> };
    const next = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      personas: migratePersonas(parsed),
      youtubeIngestUrl: parsed.youtubeIngestUrl || DEFAULT_SETTINGS.youtubeIngestUrl,
      youtubeStreamKey: parsed.youtubeStreamKey || '',
    };
    cachedRawSettings = raw;
    cachedSettingsSnapshot = next;
    return next;
  } catch {
    const fallback = makeDefaultSettings();
    cachedRawSettings = null;
    cachedSettingsSnapshot = fallback;
    return fallback;
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return;
  const raw = JSON.stringify(settings);
  cachedRawSettings = raw;
  cachedSettingsSnapshot = settings;
  localStorage.setItem(STORAGE_KEY, raw);
  listeners.forEach((listener) => listener());
}

export function subscribeToSettings(listener: () => void): () => void {
  listeners.add(listener);

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedRawSettings = undefined;
      cachedSettingsSnapshot = null;
      listener();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };
}
