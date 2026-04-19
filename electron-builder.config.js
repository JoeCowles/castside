// electron-builder.config.js
// Build + packaging config for the podcommentators desktop app.

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.podcommentators.app',
  productName: 'Podcommentators',
  copyright: 'Copyright © 2025 Podcommentators',

  // Where electron-builder looks for the compiled main process JS
  directories: {
    output: 'dist-electron',
    buildResources: 'electron/assets',
  },

  // Files to bundle into the app
  files: [
    'out/**/*',          // Next.js static export
    'electron/dist/**/*', // Compiled electron main + preloads
    'electron/assets/**/*',
    'package.json',
  ],

  // ── macOS ─────────────────────────────────────────────────────────────────
  mac: {
    category: 'public.app-category.productivity',
    target: [
      { target: 'dmg', arch: ['arm64', 'x64'] },
      { target: 'zip', arch: ['arm64', 'x64'] },
    ],
    entitlements: 'electron/entitlements.mac.plist',
    entitlementsInherit: 'electron/entitlements.mac.plist',
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },

  dmg: {
    contents: [
      { x: 410, y: 150, type: 'link', path: '/Applications' },
      { x: 130, y: 150, type: 'file' },
    ],
    window: { width: 540, height: 380 },
  },

  // ── Windows (future) ──────────────────────────────────────────────────────
  win: {
    target: 'nsis',
  },

  // ── Linux (future) ────────────────────────────────────────────────────────
  linux: {
    target: 'AppImage',
  },
};
