// src/lib/personas.ts
// Default AI commentator presets plus helpers for creating editable personas.

import { Persona } from '@/types';

import theoSystem from '@/prompts/theo/system.md';
import miloSystem from '@/prompts/milo/system.md';
import bennySystem from '@/prompts/benny/system.md';
import novaSystem from '@/prompts/nova/system.md';
import rexSystem from '@/prompts/rex/system.md';

import theoRelevance from '@/prompts/theo/relevance.md';
import miloRelevance from '@/prompts/milo/relevance.md';
import bennyRelevance from '@/prompts/benny/relevance.md';
import novaRelevance from '@/prompts/nova/relevance.md';
import rexRelevance from '@/prompts/rex/relevance.md';

export const DEFAULT_PERSONAS: Persona[] = [
  {
    id: 'gary',
    name: 'Theo',
    role: 'Fact-Checker',
    icon: '🔍',
    color: '#4F8EF7',
    cooldown: 18,
    temperature: 0.5,
    maxTokens: 5000,
    enabled: true,
    useSearch: true,
    systemPrompt: theoSystem,
    relevancePrompt: theoRelevance,
  },
  {
    id: 'fred',
    name: 'Milo',
    role: 'Context & Color',
    icon: '🎵',
    color: '#A78BFA',
    cooldown: 22,
    temperature: 0.85,
    maxTokens: 5000,
    enabled: true,
    useSearch: false,
    systemPrompt: miloSystem,
    relevancePrompt: miloRelevance,
  },
  {
    id: 'jackie',
    name: 'Benny',
    role: 'Comedy Writer',
    icon: '😂',
    color: '#F59E0B',
    cooldown: 12,
    temperature: 1.1,
    maxTokens: 4000,
    enabled: true,
    useSearch: false,
    systemPrompt: bennySystem,
    relevancePrompt: bennyRelevance,
  },
  {
    id: 'robin',
    name: 'Nova',
    role: 'News Anchor',
    icon: '📰',
    color: '#34D399',
    cooldown: 28,
    temperature: 0.6,
    maxTokens: 5000,
    enabled: true,
    useSearch: true,
    systemPrompt: novaSystem,
    relevancePrompt: novaRelevance,
  },
  {
    id: 'troll',
    name: 'Rex',
    role: 'Cynical Commentator',
    icon: '😈',
    color: '#F87171',
    cooldown: 10,
    temperature: 1.2,
    maxTokens: 4000,
    enabled: true,
    useSearch: false,
    systemPrompt: rexSystem,
    relevancePrompt: rexRelevance,
  },
];

export function clonePersona(persona: Persona): Persona {
  return { ...persona };
}

export function makeDefaultPersonas(): Persona[] {
  return DEFAULT_PERSONAS.map(clonePersona);
}

export function createEmptyPersona(): Persona {
  return {
    id: crypto.randomUUID(),
    name: 'New Commentator',
    role: 'Analyst',
    icon: '🎙️',
    color: '#60A5FA',
    cooldown: 18,
    temperature: 0.8,
    maxTokens: 4000,
    enabled: true,
    useSearch: false,
    systemPrompt: 'You are an energetic live commentator. React to the conversation with concise, high-signal observations.',
    relevancePrompt: 'Decide whether this commentator should respond to the latest conversation update. Return JSON only: {"trigger": true} or {"trigger": false}.',
  };
}
