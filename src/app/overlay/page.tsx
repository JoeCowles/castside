'use client';
// src/app/overlay/page.tsx
// Loaded by the invisible Electron overlay window (setContentProtection = true).
// Receives persona states via IPC, renders only CommentatorRail.
// Background transparency is set client-side via useEffect.

import { useEffect, useState, useRef } from 'react';
import CommentatorRail from '@/components/CommentatorRail';
import type { Persona, PersonaState } from '@/types';

export default function OverlayPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>({});
  const railRef = useRef<HTMLDivElement>(null);

  // Force transparent background — root layout sets non-transparent defaults
  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.cssText = 'background:transparent;margin:0;padding:0;overflow:hidden;';
  }, []);

  // Subscribe to persona state updates from the main window via IPC
  useEffect(() => {
    const api = window.electronAPI;
    if (!api || !('isOverlay' in api) || !api.isOverlay) return;

    const unsubscribe = api.onPersonaStates(({ personas: p, states: s }) => {
      setPersonas(p);
      setPersonaStates(s);
    });

    return unsubscribe;
  }, []);

  // Mouse passthrough: disable when cursor is over the rail so cards are clickable
  useEffect(() => {
    const api = window.electronAPI;
    if (!api || !('isOverlay' in api) || !api.isOverlay) return;
    const el = railRef.current;
    if (!el) return;
    const onEnter = () => api.setMousePassthrough(false);
    const onLeave = () => api.setMousePassthrough(true);
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={railRef}
      style={{
        width: '100vw',
        height: '100vh',
        background: 'transparent',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <CommentatorRail personas={personas} personaStates={personaStates} />
    </div>
  );
}
