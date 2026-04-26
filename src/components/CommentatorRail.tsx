'use client';
// src/components/CommentatorRail.tsx
//
// Fixed right-edge overlay — works in all modes (mic, camera, stream).
//
// Card layout inside the sliding track (flex row, left → right):
//   [content: text + name/role]  |  [avatar]  |  [waveform]
//
// This way, when the card slides in from the right:
//   1. Waveform (rightmost when active) enters viewport first
//   2. Avatar enters next — the "face" appears
//   3. Name/role and text arrive last
//
// There are NO loading animations / thinking dots — just the avatar glow.
//
// Auto-dismiss: 30 s after persona goes idle
// Peek: hovering within 48px of right edge shows avatar + name

import { useCallback, useEffect, useRef, useState } from 'react';
import { Citation, Persona, PersonaState } from '@/types';
import WaveformCanvas from './WaveformCanvas';
import { IconResolver } from './IconResolver';
import styles from './CommentatorRail.module.css';

const DISMISS_DELAY_MS = 30_000;
const EXIT_ANIM_MS     = 460;
// px of the card visible during peek (avatar slot ~60px + name block ~110px)
const PEEK_PX = 172;

interface CommentatorRailProps {
  personas: Persona[];
  personaStates: Record<string, PersonaState>;
}

type CardSlide = 'hidden' | 'visible' | 'exiting';

interface CardMeta {
  slide: CardSlide;
  hasBeenActive: boolean;
}

export default function CommentatorRail({ personas, personaStates }: CommentatorRailProps) {
  const [cardMeta, setCardMeta] = useState<Record<string, CardMeta>>(() => {
    const init: Record<string, CardMeta> = {};
    personas.forEach((p) => { init[p.id] = { slide: 'hidden', hasBeenActive: false }; });
    return init;
  });

  const [peekingId, setPeekingId] = useState<string | null>(null);

  const dismissTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const exitTimers    = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const prevStreaming  = useRef<Record<string, boolean>>({});
  const cardRefs      = useRef<Record<string, HTMLDivElement | null>>({});

  const slideIn = useCallback((id: string) => {
    if (dismissTimers.current[id]) { clearTimeout(dismissTimers.current[id]); delete dismissTimers.current[id]; }
    if (exitTimers.current[id])    { clearTimeout(exitTimers.current[id]);    delete exitTimers.current[id]; }
    setCardMeta((prev) => ({ ...prev, [id]: { slide: 'visible', hasBeenActive: true } }));
  }, []);

  const scheduleExit = useCallback((id: string) => {
    if (dismissTimers.current[id]) return;
    dismissTimers.current[id] = setTimeout(() => {
      delete dismissTimers.current[id];
      setCardMeta((prev) => ({ ...prev, [id]: { ...prev[id], slide: 'exiting' } }));
      exitTimers.current[id] = setTimeout(() => {
        delete exitTimers.current[id];
        setCardMeta((prev) => ({ ...prev, [id]: { ...prev[id], slide: 'hidden' } }));
      }, EXIT_ANIM_MS);
    }, DISMISS_DELAY_MS);
  }, []);

  // Manual dismiss: immediately start exit animation (card returns on next trigger)
  const manualDismiss = useCallback((id: string) => {
    if (dismissTimers.current[id]) { clearTimeout(dismissTimers.current[id]); delete dismissTimers.current[id]; }
    setCardMeta((prev) => ({ ...prev, [id]: { ...prev[id], slide: 'exiting' } }));
    exitTimers.current[id] = setTimeout(() => {
      delete exitTimers.current[id];
      setCardMeta((prev) => ({ ...prev, [id]: { slide: 'hidden', hasBeenActive: false } }));
    }, EXIT_ANIM_MS);
  }, []);

  useEffect(() => {
    setCardMeta((prev) => {
      const next: Record<string, CardMeta> = {};
      personas.forEach((persona) => {
        next[persona.id] = prev[persona.id] ?? { slide: 'hidden', hasBeenActive: false };
      });
      return next;
    });
  }, [personas]);

  useEffect(() => {
    personas.forEach((persona) => {
      if (!persona.enabled) return;
      const state = personaStates[persona.id];
      if (!state) return;

      const wasStreaming = prevStreaming.current[persona.id] ?? false;
      const nowStreaming = state.isStreaming;

      if (nowStreaming && !wasStreaming) slideIn(persona.id);
      else if (!nowStreaming && wasStreaming) scheduleExit(persona.id);

      prevStreaming.current[persona.id] = nowStreaming;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaStates]);

  // Find the enabled card whose vertical center is closest to the cursor Y
  const findClosestCard = useCallback((clientY: number): string | null => {
    let bestId: string | null = null;
    let bestDist = Infinity;
    const enabledIds = personas.filter((p) => p.enabled).map((p) => p.id);
    for (const id of enabledIds) {
      const el = cardRefs.current[id];
      if (!el) continue;
      const meta = cardMeta[id];
      if (!meta?.hasBeenActive) continue;
      if (meta.slide === 'visible' || meta.slide === 'exiting') continue;
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const dist = Math.abs(clientY - centerY);
      if (dist < bestDist) { bestDist = dist; bestId = id; }
    }
    return bestId;
  }, [personas, cardMeta]);

  useEffect(() => () => {
    Object.values(dismissTimers.current).forEach((t) => clearTimeout(t!));
    Object.values(exitTimers.current).forEach((t) => clearTimeout(t!));
  }, []);

  return (
    <div
      className={styles.rail}
      style={{ '--peek-px': `${PEEK_PX}px` } as React.CSSProperties}
    >
      {/* Invisible hover strip at right edge — tracks Y to peek nearest card */}
      <div
        className={styles.hoverTrigger}
        onMouseMove={(e) => setPeekingId(findClosestCard(e.clientY))}
        onMouseLeave={() => setPeekingId(null)}
      />

      <div className={styles.cardsColumn}>
        {personas.filter((p) => p.enabled).map((persona) => {
          const state = personaStates[persona.id];
          if (!state) return null;

          const meta    = cardMeta[persona.id] ?? { slide: 'hidden', hasBeenActive: false };
          const isVisible = meta.slide === 'visible';
          const isExiting = meta.slide === 'exiting';
          const canPeek   = peekingId === persona.id && meta.hasBeenActive && !isVisible && !isExiting;

          const { waveformState, currentResponse, isStreaming } = state;
          const isThinking = waveformState === 'thinking';
          const isActive   = waveformState === 'active';
          const showWave   = isVisible && (isThinking || isActive);

          // Show the full response — CSS handles scrolling for long text
          const displayText = currentResponse;

          const trackClass = [
            styles.cardTrack,
            isVisible ? styles.cardVisible  : '',
            isExiting ? styles.cardExiting  : '',
            canPeek   ? styles.cardPeeking  : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={persona.id}
              ref={(el) => { cardRefs.current[persona.id] = el; }}
              className={trackClass}
              style={{ '--persona-color': persona.color } as React.CSSProperties}
              onMouseEnter={() => { if (canPeek) setPeekingId(persona.id); }}
              onMouseLeave={() => { if (peekingId === persona.id) setPeekingId(null); }}
            >
              {/* ── Unified card ── */}
              <div className={styles.card}>
                {/* Close button — appears on hover for visible and peeked cards */}
                {(isVisible || canPeek) && (
                  <button
                    className={styles.closeBtn}
                    onClick={(e) => { e.stopPropagation(); manualDismiss(persona.id); setPeekingId(null); }}
                    aria-label={`Dismiss ${persona.name}`}
                    title="Dismiss"
                  >
                    ×
                  </button>
                )}

                {/* Left column: name/role + response text */}
                <div className={styles.contentCol}>
                  <div className={styles.identity}>
                    <span className={styles.personaName}>
                      <IconResolver name={persona.icon} size={16} /> {persona.name}
                    </span>
                    <span className={styles.personaRole}>{persona.role}</span>
                  </div>

                  {displayText ? (
                    <p className={styles.responseText}>
                      {displayText}
                      {isStreaming && <span className={styles.cursor}>▋</span>}
                    </p>
                  ) : null}

                  {/* Citation chips — shown for personas using Google Search (Theo, Nova) */}
                  {(state.citations ?? []).length > 0 && (
                    <div className={styles.citations}>
                      {state.citations.slice(0, 4).map((c: Citation) => {
                        let domain = '';
                        const isProxy = c.uri.includes('vertexaisearch.cloud.google.com');
                        try { domain = new URL(c.uri).hostname.replace('www.', ''); } catch { domain = c.uri; }
                        const displayDomain = isProxy ? (c.title || 'Source') : domain;
                        const faviconDomain = isProxy ? '' : domain;
                        return (
                          <a
                            key={c.uri}
                            href={c.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.citationChip}
                            title={c.title}
                          >
                            {faviconDomain && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=16`}
                                alt=""
                                width={12}
                                height={12}
                                className={styles.citationFavicon}
                              />
                            )}
                            <span className={styles.citationDomain}>{displayDomain}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right column: avatar then waveform to its right */}
                <div className={styles.avatarCol}>
                  {/* Avatar with thinking/active ring */}
                  <div className={[
                    styles.avatarRing,
                    isThinking ? styles.avatarThinking : '',
                    isActive   ? styles.avatarActive   : '',
                  ].filter(Boolean).join(' ')}>
                    <div className={styles.avatar} aria-hidden="true">
                      <IconResolver name={persona.icon} size={24} className={styles.avatarGlyph} />
                    </div>
                    <span className={[
                      styles.statusDot,
                      isThinking ? styles.dotThinking : '',
                      isActive   ? styles.dotSpeaking  : '',
                    ].filter(Boolean).join(' ')} />
                  </div>

                  {/* Waveform — to the RIGHT of the avatar */}
                  {showWave ? (
                    <div className={styles.waveSlot}>
                      <WaveformCanvas state={waveformState} color={persona.color} height={36} />
                    </div>
                  ) : (
                    /* Placeholder keeps width stable so card doesn't jump when wave appears */
                    <div className={styles.wavePlaceholder} />
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
