// src/app/overlay/layout.tsx
// Sub-layouts must NOT contain <html>/<body> — those belong only to the root layout.
// Background transparency is applied via useEffect in the page component.
export const metadata = { title: 'Podcommentators Overlay' };

export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
