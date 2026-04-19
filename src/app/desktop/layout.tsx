// src/app/desktop/layout.tsx
// Layout for the Electron desktop window.
// Uses the root layout's providers (SettingsContext etc.) via inheritance — 
// no need to re-declare them here.

export const metadata = {
  title: 'Podcommentators',
  description: 'AI commentators for any audio, running locally.',
};

export default function DesktopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
