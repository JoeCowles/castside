"use strict";
// electron/preload.ts
// Context bridge for the MAIN APP window.
// Exposes a locked-down `window.electronAPI` object to the renderer.
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    isElectron: true,
    sendPersonaStates(personas, states) {
        electron_1.ipcRenderer.send('persona-states-update', { personas, states });
    },
    async getAudioSources() {
        return electron_1.ipcRenderer.invoke('get-audio-sources');
    },
    getSystemAudioConstraints(sourceId) {
        return {
            audio: {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                },
            },
            video: false,
        };
    },
    setOverlayVisible(visible) {
        electron_1.ipcRenderer.send('overlay-set-visible', visible);
    },
    async checkPermissions() {
        return electron_1.ipcRenderer.invoke('check-permissions');
    },
    async requestMicAccess() {
        return electron_1.ipcRenderer.invoke('request-mic-access');
    },
    openPrivacySettings(pane = 'microphone') {
        electron_1.ipcRenderer.send('open-privacy-settings', pane);
    },
    setScreenshareVisible(visible) {
        electron_1.ipcRenderer.send('set-screenshare-visible', visible);
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
