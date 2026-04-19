"use strict";
// electron/preload-overlay.ts
// Context bridge for the OVERLAY window (the screen-share-invisible CommentatorRail).
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    isElectron: true,
    isOverlay: true,
    onPersonaStates(callback) {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('persona-states-update', handler);
        // Return a cleanup function so React can unsubscribe on unmount
        return () => {
            electron_1.ipcRenderer.removeListener('persona-states-update', handler);
        };
    },
    setMousePassthrough(passthrough) {
        electron_1.ipcRenderer.send('overlay-set-mouse-passthrough', passthrough);
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
