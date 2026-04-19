// electron/preload.ts
// Context bridge for the MAIN APP window.
// Exposes a locked-down `window.electronAPI` object to the renderer.

import { contextBridge, ipcRenderer } from 'electron';

// Inline types (avoids cross-rootDir import issues with tsc)
interface Persona { id: string; name: string; role: string; icon: string; color: string; cooldown: number; temperature: number; maxTokens: number; enabled: boolean; systemPrompt: string; relevancePrompt: string; useSearch: boolean; }
type WaveformState = 'idle' | 'thinking' | 'active';
interface PersonaState { waveformState: WaveformState; currentResponse: string; isStreaming: boolean; cooldownUntil: number; lastTriggeredAt: number; error: string | null; citations: Array<{ uri: string; title: string }>; }


export interface ElectronAPI {
  /** Send updated persona states from the main window to the overlay */
  sendPersonaStates: (personas: Persona[], states: Record<string, PersonaState>) => void;

  /** Request a list of capturable desktop audio sources */
  getAudioSources: () => Promise<Array<{ id: string; name: string }>>;

  /** Get a getUserMedia constraint object for system-wide audio capture */
  getSystemAudioConstraints: (sourceId: string) => MediaStreamConstraints;

  /** Toggle overlay window visibility */
  setOverlayVisible: (visible: boolean) => void;

  /** Check macOS permission status for mic + screen */
  checkPermissions: () => Promise<{ microphone: string; screen: string }>;

  /** Request mic permission on demand — shows dialog if not-determined */
  requestMicAccess: () => Promise<string>;

  /** Open macOS System Preferences > Privacy (pane: 'microphone' | 'screen') */
  openPrivacySettings: (pane?: string) => void;

  /** Indicate this is running inside Electron */
  isElectron: true;
}

const api: ElectronAPI = {
  isElectron: true,

  sendPersonaStates(personas, states) {
    ipcRenderer.send('persona-states-update', { personas, states });
  },

  async getAudioSources() {
    return ipcRenderer.invoke('get-audio-sources');
  },

  getSystemAudioConstraints(sourceId: string): MediaStreamConstraints {
    return {
      audio: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      } as unknown as MediaTrackConstraints,
      video: false,
    };
  },

  setOverlayVisible(visible: boolean) {
    ipcRenderer.send('overlay-set-visible', visible);
  },

  async checkPermissions() {
    return ipcRenderer.invoke('check-permissions');
  },

  async requestMicAccess() {
    return ipcRenderer.invoke('request-mic-access');
  },

  openPrivacySettings(pane = 'microphone') {
    ipcRenderer.send('open-privacy-settings', pane);
  },

  setScreenshareVisible(visible: boolean) {
    ipcRenderer.send('set-screenshare-visible', visible);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
