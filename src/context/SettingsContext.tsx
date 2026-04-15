'use client';
// src/context/SettingsContext.tsx
// Global settings context backed by a tiny localStorage store.

import React, { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { AppSettings } from '@/types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, subscribeToSettings } from '@/lib/settings';

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (next: Partial<AppSettings>) => void;
  saveAndClose: (next: AppSettings) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);
const SERVER_SETTINGS_SNAPSHOT: AppSettings = DEFAULT_SETTINGS;

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useSyncExternalStore(
    subscribeToSettings,
    loadSettings,
    () => SERVER_SETTINGS_SNAPSHOT
  );

  const updateSettings = useCallback((next: Partial<AppSettings>) => {
    saveSettings({ ...settings, ...next });
  }, [settings]);

  const saveAndClose = useCallback((next: AppSettings) => {
    saveSettings(next);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, saveAndClose }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>');
  return ctx;
}
