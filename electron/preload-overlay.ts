// electron/preload-overlay.ts
// Context bridge for the OVERLAY window (the screen-share-invisible CommentatorRail).

import { contextBridge, ipcRenderer } from 'electron';

// Inline types (avoids cross-rootDir import issues with tsc)
interface Persona { id: string; name: string; role: string; icon: string; color: string; cooldown: number; temperature: number; maxTokens: number; enabled: boolean; systemPrompt: string; relevancePrompt: string; useSearch: boolean; }
type WaveformState = 'idle' | 'thinking' | 'active';
interface PersonaState { waveformState: WaveformState; currentResponse: string; isStreaming: boolean; cooldownUntil: number; lastTriggeredAt: number; error: string | null; citations: Array<{ uri: string; title: string }>; }


export interface OverlayElectronAPI {
  /** Listen for persona state updates pushed from the main window */
  onPersonaStates: (
    callback: (data: { personas: Persona[]; states: Record<string, PersonaState> }) => void
  ) => () => void;

  /** Tell the main process whether the cursor is over a card (to toggle click-through) */
  setMousePassthrough: (passthrough: boolean) => void;

  isElectron: true;
  isOverlay: true;
}

const api: OverlayElectronAPI = {
  isElectron: true,
  isOverlay: true,

  onPersonaStates(callback) {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { personas: Persona[]; states: Record<string, PersonaState> }
    ) => callback(data);

    ipcRenderer.on('persona-states-update', handler);

    // Return a cleanup function so React can unsubscribe on unmount
    return () => {
      ipcRenderer.removeListener('persona-states-update', handler);
    };
  },

  setMousePassthrough(passthrough: boolean) {
    ipcRenderer.send('overlay-set-mouse-passthrough', passthrough);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
