"use strict";
// electron/main.ts
// Electron main process for podcommentators desktop app.
//
// Architecture:
//   - mainWin    → normal BrowserWindow loading Next.js (localhost:3000 in dev)
//   - overlayWin → transparent, content-protected window that floats over everything.
//                  setContentProtection(true) maps to NSWindowSharingNone on macOS,
//                  making it INVISIBLE to all screen capture (Zoom, OBS, Meet, etc.).
//
// IPC channels:
//   'persona-states-update' → mainWin → main process → overlayWin
//   'get-audio-sources'     → renderer → main process → response
//   'get-system-audio'      → renderer → main process → response (stream handle)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const isDev = !electron_1.app.isPackaged;
const MAIN_URL = isDev ? 'http://localhost:3000/desktop' : `file://${path.join(__dirname, '../out/desktop/index.html')}`;
const OVERLAY_HTML = isDev
    ? 'http://localhost:3000/overlay'
    : `file://${path.join(__dirname, '../out/overlay/index.html')}`;
let mainWin = null;
let overlayWin = null;
// ─────────────────────────────────────────────────────────────────────────────
// Security: handle permission requests for microphone + screen recording
// ─────────────────────────────────────────────────────────────────────────────
function setupPermissions() {
    electron_1.session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        const allowed = ['microphone', 'display-capture', 'media', 'mediaKeySystem'];
        callback(allowed.includes(permission));
    });
    electron_1.session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
        const allowed = ['microphone', 'display-capture', 'media', 'mediaKeySystem'];
        return allowed.includes(permission);
    });
    // Auto-select the primary screen + system audio when the renderer calls
    // getDisplayMedia — no picker is shown to the user.
    // On macOS 13+ with Screen Recording permission granted, 'loopback' captures
    // all system audio (every app playing sound).
    if (typeof electron_1.session.defaultSession.setDisplayMediaRequestHandler === 'function') {
        electron_1.session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
            try {
                const sources = await electron_1.desktopCapturer.getSources({ types: ['screen'] });
                const screenSource = sources.find((s) => s.name.toLowerCase().includes('entire screen')) ??
                    sources.find((s) => s.id.startsWith('screen:')) ??
                    sources[0];
                if (screenSource) {
                    // 'loopback' = system audio on Windows; on macOS requires ScreenCaptureKit
                    callback({ video: screenSource, audio: 'loopback' });
                }
                else {
                    callback({});
                }
            }
            catch (err) {
                console.error('[Electron] setDisplayMediaRequestHandler error:', err);
                callback({});
            }
        });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// Create main application window
// ─────────────────────────────────────────────────────────────────────────────
function createMainWindow() {
    mainWin = new electron_1.BrowserWindow({
        width: 420,
        height: 700,
        minWidth: 360,
        minHeight: 560,
        maxWidth: 560,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0a0a14',
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    electron_1.nativeTheme.themeSource = 'dark';
    mainWin.loadURL(MAIN_URL);
    if (isDev) {
        mainWin.webContents.openDevTools({ mode: 'detach' });
    }
    mainWin.on('closed', () => {
        mainWin = null;
        overlayWin?.close();
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Create the transparent overlay window
//
// KEY: setContentProtection(true) → NSWindowSharingNone on macOS
//      This makes the window invisible to ALL screen capture APIs including
//      CGWindowListCreateImage, Zoom, Google Meet, OBS, QuickTime, etc.
//      This is the exact mechanism Granola uses for its floating notes HUD.
// ─────────────────────────────────────────────────────────────────────────────
function createOverlayWindow() {
    const primaryDisplay = electron_1.screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    overlayWin = new electron_1.BrowserWindow({
        width,
        height,
        x: 0,
        y: 0,
        // Visual config
        transparent: true,
        frame: false,
        hasShadow: false,
        // Behavior config
        alwaysOnTop: true,
        resizable: false,
        movable: false,
        // Makes it float above fullscreen apps on macOS
        type: 'panel',
        // Allow clicks to pass through to underlying apps except where cards are
        // (the renderer calls ipcMain to toggle mouse passthrough per-region)
        focusable: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload-overlay.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    // ← THE MAGIC: invisible to all screen capture
    overlayWin.setContentProtection(true);
    // Start fully click-through; renderer enables hit-testing for card areas
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
    overlayWin.loadURL(OVERLAY_HTML);
    // Keep overlay filling the screen if display changes
    electron_1.screen.on('display-metrics-changed', () => {
        if (!overlayWin)
            return;
        const { width: w, height: h } = electron_1.screen.getPrimaryDisplay().workAreaSize;
        overlayWin.setBounds({ x: 0, y: 0, width: w, height: h });
    });
    if (isDev) {
        // Open devtools for overlay in a separate window so it doesn't interfere
        // overlayWin.webContents.openDevTools({ mode: 'detach' });
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// IPC Handlers
// ─────────────────────────────────────────────────────────────────────────────
function setupIPC() {
    // Main app → overlay: forward persona states
    electron_1.ipcMain.on('persona-states-update', (_event, payload) => {
        overlayWin?.webContents.send('persona-states-update', payload);
    });
    // Overlay → main: toggle mouse passthrough based on whether cursor is over a card
    electron_1.ipcMain.on('overlay-set-mouse-passthrough', (_event, passthrough) => {
        if (!overlayWin)
            return;
        overlayWin.setIgnoreMouseEvents(passthrough, { forward: true });
    });
    // Renderer → main: list available desktop/audio sources for system audio capture
    electron_1.ipcMain.handle('get-audio-sources', async () => {
        const sources = await electron_1.desktopCapturer.getSources({
            types: ['screen', 'window'],
            fetchWindowIcons: false,
        });
        return sources.map((s) => ({ id: s.id, name: s.name, thumbnail: null }));
    });
    // Renderer → main: check if running in Electron
    electron_1.ipcMain.handle('is-electron', () => true);
    // Renderer → main: check macOS permission status
    electron_1.ipcMain.handle('check-permissions', async () => {
        if (process.platform !== 'darwin') {
            return { microphone: 'granted', screen: 'granted' };
        }
        const mic = electron_1.systemPreferences.getMediaAccessStatus('microphone');
        const scr = electron_1.systemPreferences.getMediaAccessStatus('screen');
        console.log(`[Electron] Permission status — mic: ${mic}, screen: ${scr}`);
        return { microphone: mic, screen: scr };
    });
    // Renderer → main: ask for mic permission on demand (shows dialog if not-determined)
    electron_1.ipcMain.handle('request-mic-access', async () => {
        if (process.platform !== 'darwin')
            return 'granted';
        const current = electron_1.systemPreferences.getMediaAccessStatus('microphone');
        if (current === 'granted')
            return 'granted';
        if (current === 'denied')
            return 'denied';
        // 'not-determined' — show the dialog
        const granted = await electron_1.systemPreferences.askForMediaAccess('microphone');
        return granted ? 'granted' : 'denied';
    });
    // Renderer → main: open System Preferences Privacy pane
    electron_1.ipcMain.on('open-privacy-settings', (_event, pane) => {
        const url = pane === 'screen'
            ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
            : 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone';
        electron_1.shell.openExternal(url);
    });
    // Relay window visibility for overlay show/hide
    electron_1.ipcMain.on('overlay-set-visible', (_event, visible) => {
        if (visible) {
            overlayWin?.showInactive();
        }
        else {
            overlayWin?.hide();
        }
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(async () => {
    if (process.platform === 'darwin') {
        const micStatus = electron_1.systemPreferences.getMediaAccessStatus('microphone');
        const scrStatus = electron_1.systemPreferences.getMediaAccessStatus('screen');
        console.log(`[Electron] Startup permissions — mic: ${micStatus}, screen: ${scrStatus}`);
        if (micStatus === 'not-determined') {
            console.log('[Electron] Showing microphone permission dialog...');
            const granted = await electron_1.systemPreferences.askForMediaAccess('microphone').catch(() => false);
            console.log('[Electron] Microphone permission result:', granted ? 'granted' : 'denied');
        }
        else if (micStatus === 'denied') {
            console.warn('[Electron] *** Microphone DENIED ***\n' +
                '  Go to: System Settings → Privacy & Security → Microphone\n' +
                '  Find "Electron" and toggle it ON, then restart the app.');
        }
        // Trigger Screen Recording permission by accessing sources
        await electron_1.desktopCapturer.getSources({ types: ['screen'] }).catch(() => { });
        const scrStatusAfter = electron_1.systemPreferences.getMediaAccessStatus('screen');
        console.log(`[Electron] Screen Recording status: ${scrStatusAfter}`);
    }
    setupPermissions();
    createMainWindow();
    createOverlayWindow();
    setupIPC();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
            createOverlayWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
