// src/types/electron.d.ts
// Global type declarations for the Electron context bridge APIs.
// These augment Window so TypeScript knows about window.electronAPI in both
// the main window and the overlay window renderers.

import type { PersonaState, Persona } from './index';

// Main window API surface
interface MainWindowElectronAPI {
  isElectron: true;
  isOverlay?: false;

  sendPersonaStates: (
    personas: Persona[],
    states: Record<string, PersonaState>
  ) => void;

  getAudioSources: () => Promise<Array<{ id: string; name: string }>>;

  getSystemAudioConstraints: (sourceId: string) => MediaStreamConstraints;

  setOverlayVisible: (visible: boolean) => void;

  /** Returns macOS permission status: 'granted' | 'denied' | 'restricted' | 'not-determined' */
  checkPermissions: () => Promise<{ microphone: string; screen: string }>;

  /** Ask for microphone permission now — shows macOS dialog if not-determined, returns new status */
  requestMicAccess: () => Promise<string>;

  /** Opens System Settings → Privacy (pane: 'microphone' | 'screen') */
  openPrivacySettings: (pane?: string) => void;
}

// Overlay window API surface
interface OverlayWindowElectronAPI {
  isElectron: true;
  isOverlay: true;

  onPersonaStates: (
    callback: (data: { personas: Persona[]; states: Record<string, PersonaState> }) => void
  ) => () => void;

  setMousePassthrough: (passthrough: boolean) => void;
}

declare global {
  interface Window {
    electronAPI?: MainWindowElectronAPI | OverlayWindowElectronAPI;
  }
}

export {};
