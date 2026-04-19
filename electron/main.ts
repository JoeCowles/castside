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

import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
  session,
  nativeTheme,
  systemPreferences,
  shell,
  protocol,
  net,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';

const isDev = !app.isPackaged;

// In production the Next.js static export is bundled into the app's resources.
// We serve it via a custom app:// protocol (secure, same-origin) to avoid
// the CORS/file:// issues that come with file:// URLs.
const NEXT_OUT = isDev
  ? path.join(__dirname, '../../out')          // dev fallback (unused)
  : path.join(process.resourcesPath, 'out');   // packaged: extraResources/out

const MAIN_URL    = isDev ? 'http://localhost:3000/desktop' : 'app://./desktop';
const OVERLAY_HTML = isDev ? 'http://localhost:3000/overlay' : 'app://./overlay';

// Register app:// BEFORE app.whenReady() — Electron requires this.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let mainWin: BrowserWindow | null = null;
let overlayWin: BrowserWindow | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Security: handle permission requests for microphone + screen recording
// ─────────────────────────────────────────────────────────────────────────────
function setupPermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['microphone', 'display-capture', 'media', 'mediaKeySystem'];
    callback(allowed.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['microphone', 'display-capture', 'media', 'mediaKeySystem'];
    return allowed.includes(permission);
  });

  // Auto-select the primary screen + system audio when the renderer calls
  // getDisplayMedia — no picker is shown to the user.
  // On macOS 13+ with Screen Recording permission granted, 'loopback' captures
  // all system audio (every app playing sound).
  if (typeof session.defaultSession.setDisplayMediaRequestHandler === 'function') {
    session.defaultSession.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        try {
          const sources = await desktopCapturer.getSources({ types: ['screen'] });
          const screenSource =
            sources.find((s) => s.name.toLowerCase().includes('entire screen')) ??
            sources.find((s) => s.id.startsWith('screen:')) ??
            sources[0];

          if (screenSource) {
            // 'loopback' = system audio on Windows; on macOS requires ScreenCaptureKit
            callback({ video: screenSource, audio: 'loopback' });
          } else {
            callback({});
          }
        } catch (err) {
          console.error('[Electron] setDisplayMediaRequestHandler error:', err);
          callback({});
        }
      }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create main application window
// ─────────────────────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWin = new BrowserWindow({
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

  nativeTheme.themeSource = 'dark';
  mainWin.loadURL(MAIN_URL);

  // Force transcription window to float above all apps (same as the overlay)
  mainWin.setAlwaysOnTop(true, 'screen-saver');
  mainWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Make the main window invisible to screen capture — same as the overlay.
  // The user still sees and interacts with the app normally on their screen.
  mainWin.setContentProtection(true);

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
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  overlayWin = new BrowserWindow({
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

  // ← THE MAGIC: invisible to all screen capture (unless DEMO_MODE bypasses it for recording)
  const isDemoMode = process.env.DEMO_MODE === '1';
  if (!isDemoMode) {
    overlayWin.setContentProtection(true);
  }

  // Force maximum z-index (floating above everything, even fullscreen presentations)
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Start fully click-through; renderer enables hit-testing for card areas
  overlayWin.setIgnoreMouseEvents(true, { forward: true });

  overlayWin.loadURL(OVERLAY_HTML);

  // Keep overlay filling the screen if display changes
  screen.on('display-metrics-changed', () => {
    if (!overlayWin) return;
    const { width: w, height: h } = screen.getPrimaryDisplay().workAreaSize;
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
  ipcMain.on('persona-states-update', (_event, payload: unknown) => {
    overlayWin?.webContents.send('persona-states-update', payload);
  });

  // Overlay → main: toggle mouse passthrough based on whether cursor is over a card
  ipcMain.on('overlay-set-mouse-passthrough', (_event, passthrough: boolean) => {
    if (!overlayWin) return;
    overlayWin.setIgnoreMouseEvents(passthrough, { forward: true });
  });

  // Renderer → main: list available desktop/audio sources for system audio capture
  ipcMain.handle('get-audio-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      fetchWindowIcons: false,
    });
    return sources.map((s) => ({ id: s.id, name: s.name, thumbnail: null }));
  });

  // Renderer → main: check if running in Electron
  ipcMain.handle('is-electron', () => true);

  // Renderer → main: check macOS permission status
  ipcMain.handle('check-permissions', async () => {
    if (process.platform !== 'darwin') {
      return { microphone: 'granted', screen: 'granted' };
    }
    const mic    = systemPreferences.getMediaAccessStatus('microphone');
    const scr    = systemPreferences.getMediaAccessStatus('screen');
    console.log(`[Electron] Permission status — mic: ${mic}, screen: ${scr}`);
    return { microphone: mic, screen: scr };
  });

  // Renderer → main: ask for mic permission on demand (shows dialog if not-determined)
  ipcMain.handle('request-mic-access', async () => {
    if (process.platform !== 'darwin') return 'granted';
    const current = systemPreferences.getMediaAccessStatus('microphone');
    if (current === 'granted') return 'granted';
    if (current === 'denied') return 'denied';
    // 'not-determined' — show the dialog
    const granted = await systemPreferences.askForMediaAccess('microphone');
    return granted ? 'granted' : 'denied';
  });

  // Renderer → main: open System Preferences Privacy pane
  ipcMain.on('open-privacy-settings', (_event, pane: string) => {
    const url = pane === 'screen'
      ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      : 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone';
    shell.openExternal(url);
  });

  // Renderer → main: toggle screenshare visibility (content protection)
  ipcMain.on('set-screenshare-visible', (_event, visible: boolean) => {
    if (mainWin) mainWin.setContentProtection(!visible);
    if (overlayWin) overlayWin.setContentProtection(!visible);
  });

  // Relay window visibility for overlay show/hide
  ipcMain.on('overlay-set-visible', (_event, visible: boolean) => {
    if (visible) {
      overlayWin?.showInactive();
    } else {
      overlayWin?.hide();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    const scrStatus = systemPreferences.getMediaAccessStatus('screen');
    console.log(`[Electron] Startup permissions — mic: ${micStatus}, screen: ${scrStatus}`);

    if (micStatus === 'not-determined') {
      console.log('[Electron] Showing microphone permission dialog...');
      const granted = await systemPreferences.askForMediaAccess('microphone').catch(() => false);
      console.log('[Electron] Microphone permission result:', granted ? 'granted' : 'denied');
    } else if (micStatus === 'denied') {
      console.warn(
        '[Electron] *** Microphone DENIED ***\n' +
        '  Go to: System Settings → Privacy & Security → Microphone\n' +
        '  Find "Electron" and toggle it ON, then restart the app.'
      );
    }

    // Trigger Screen Recording permission by accessing sources
    await desktopCapturer.getSources({ types: ['screen'] }).catch(() => {});
    const scrStatusAfter = systemPreferences.getMediaAccessStatus('screen');
    console.log(`[Electron] Screen Recording status: ${scrStatusAfter}`);
  }

  // ── Serve the Next.js static export via app:// in production ──
  if (!isDev) {
    const MIME: Record<string, string> = {
      '.html': 'text/html',
      '.js':   'application/javascript',
      '.css':  'text/css',
      '.json': 'application/json',
      '.png':  'image/png',
      '.jpg':  'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg':  'image/svg+xml',
      '.ico':  'image/x-icon',
      '.woff': 'font/woff',
      '.woff2':'font/woff2',
      '.ttf':  'font/ttf',
    };

    protocol.handle('app', (req) => {
      const url = new URL(req.url);
      let pathname = url.pathname.replace(/^\/\./, ''); // strip leading "./"
      if (!pathname || pathname === '/') pathname = '/index';

      let filePath = path.join(NEXT_OUT, pathname);

      // Next.js App Router exports routes as /route.html, but some asset folders lack extensions.
      if (!path.extname(filePath)) {
        if (fs.existsSync(`${filePath}.html`)) {
          filePath = `${filePath}.html`;
        } else {
          filePath = path.join(filePath, 'index.html');
        }
      }

      if (!fs.existsSync(filePath)) {
        console.error('[app://] Not found:', filePath);
        return new Response('Not found', { status: 404 });
      }

      const ext  = path.extname(filePath).toLowerCase();
      const mime = MIME[ext] ?? 'application/octet-stream';
      const data = fs.readFileSync(filePath);
      return new Response(data, { headers: { 'Content-Type': mime } });
    });
  }

  setupPermissions();
  createMainWindow();
  createOverlayWindow();
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
