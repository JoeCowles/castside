'use client';
// src/components/CommentatorRail.tsx
//
// Message-feed overlay — cards pop in from the right, stack top → bottom.
// Oldest card at the top is dismissed first (FIFO), everything slides up.
// Multiple cards from the same persona can coexist.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Citation, Persona, PersonaState } from '@/types';
import WaveformCanvas from './WaveformCanvas';
import { IconResolver } from './IconResolver';
import styles from './CommentatorRail.module.css';

const DISMISS_DELAY_MS = 15_000; // auto-dismiss after 15s idle
const EXIT_ANIM_MS     = 420;
const MAX_VISIBLE       = 4;     // max cards on screen

interface CommentatorRailProps {
  personas: Persona[];
  personaStates: Record<string, PersonaState>;
}

interface FeedCard {
  id: string;
  personaId: string;
  text: string;
  citations: Citation[];
  streaming: boolean;
  slide: 'entering' | 'visible' | 'exiting';
}

export default function CommentatorRail({ personas, personaStates }: CommentatorRailProps) {
  const [feed, setFeed] = useState<FeedCard[]>([]);
  const prevStreaming = useRef<Record<string, boolean>>({});
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const columnRef = useRef<HTMLDivElement | null>(null);

  // Build a map for quick persona lookup
  const personaMap = useRef<Map<string, Persona>>(new Map());
  useEffect(() => {
    personaMap.current.clear();
    personas.forEach((p) => personaMap.current.set(p.id, p));
  }, [personas]);

  // Dismiss the oldest visible card (FIFO)
  const dismissOldest = useCallback(() => {
    setFeed((prev) => {
      const oldest = prev.find((c) => c.slide === 'visible' && !c.streaming);
      if (!oldest) return prev;
      // Clear its dismiss timer
      const dt = dismissTimers.current.get(oldest.id);
      if (dt) { clearTimeout(dt); dismissTimers.current.delete(oldest.id); }
      // Start exit animation
      const updated = prev.map((c) =>
        c.id === oldest.id ? { ...c, slide: 'exiting' as const } : c
      );
      exitTimers.current.set(oldest.id, setTimeout(() => {
        exitTimers.current.delete(oldest.id);
        setFeed((f) => f.filter((c) => c.id !== oldest.id));
      }, EXIT_ANIM_MS));
      return updated;
    });
  }, []);

  // Schedule auto-dismiss for a card
  const scheduleDismiss = useCallback((cardId: string) => {
    if (dismissTimers.current.has(cardId)) return;
    dismissTimers.current.set(cardId, setTimeout(() => {
      dismissTimers.current.delete(cardId);
      setFeed((prev) => {
        const card = prev.find((c) => c.id === cardId);
        if (!card || card.slide === 'exiting') return prev;
        const updated = prev.map((c) =>
          c.id === cardId ? { ...c, slide: 'exiting' as const } : c
        );
        exitTimers.current.set(cardId, setTimeout(() => {
          exitTimers.current.delete(cardId);
          setFeed((f) => f.filter((c) => c.id !== cardId));
        }, EXIT_ANIM_MS));
        return updated;
      });
    }, DISMISS_DELAY_MS));
  }, []);

  // Manual dismiss
  const manualDismiss = useCallback((cardId: string) => {
    const dt = dismissTimers.current.get(cardId);
    if (dt) { clearTimeout(dt); dismissTimers.current.delete(cardId); }
    setFeed((prev) => prev.map((c) =>
      c.id === cardId ? { ...c, slide: 'exiting' as const } : c
    ));
    exitTimers.current.set(cardId, setTimeout(() => {
      exitTimers.current.delete(cardId);
      setFeed((f) => f.filter((c) => c.id !== cardId));
    }, EXIT_ANIM_MS));
  }, []);

  // Watch streaming transitions to create/complete feed cards
  useEffect(() => {
    personas.forEach((persona) => {
      if (!persona.enabled) return;
      const state = personaStates[persona.id];
      if (!state) return;

      const wasStreaming = prevStreaming.current[persona.id] ?? false;
      const nowStreaming = state.isStreaming;

      if (nowStreaming && !wasStreaming) {
        // New stream started → add card to feed
        const cardId = `${persona.id}-${Date.now()}`;
        setFeed((prev) => {
          // Enforce max visible — dismiss oldest if needed
          const visibleCount = prev.filter((c) => c.slide !== 'exiting').length;
          let next = [...prev];
          if (visibleCount >= MAX_VISIBLE) {
            const oldest = next.find((c) => c.slide === 'visible' && !c.streaming);
            if (oldest) {
              const dt = dismissTimers.current.get(oldest.id);
              if (dt) { clearTimeout(dt); dismissTimers.current.delete(oldest.id); }
              next = next.map((c) =>
                c.id === oldest.id ? { ...c, slide: 'exiting' as const } : c
              );
              exitTimers.current.set(oldest.id, setTimeout(() => {
                exitTimers.current.delete(oldest.id);
                setFeed((f) => f.filter((c) => c.id !== oldest.id));
              }, EXIT_ANIM_MS));
            }
          }
          return [...next, {
            id: cardId,
            personaId: persona.id,
            text: state.currentResponse || '',
            citations: state.citations || [],
            streaming: true,
            slide: 'entering',
          }];
        });
        // Transition entering → visible on next frame for CSS animation
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setFeed((prev) => prev.map((c) =>
              c.personaId === persona.id && c.slide === 'entering'
                ? { ...c, slide: 'visible' }
                : c
            ));
          });
        });
      } else if (!nowStreaming && wasStreaming) {
        // Stream ended → freeze card and schedule dismiss (or kill it if blank)
        setFeed((prev) => {
          let completed: FeedCard | null = null;
          const updated = prev.map((c) => {
            if (c.personaId === persona.id && c.streaming) {
              const next: FeedCard = {
                ...c,
                streaming: false,
                text: state.currentResponse || c.text,
                citations: state.citations || c.citations,
              };
              completed = next;
              return next;
            }
            return c;
          });
          if (!completed) return updated;
          const finalCard: FeedCard = completed;
          if (!finalCard.text.trim()) {
            // No text was produced (e.g. MAX_TOKENS in thinking) — dismiss
            // immediately instead of parking a blank card for 15 seconds.
            const exiting = updated.map((c) =>
              c.id === finalCard.id ? { ...c, slide: 'exiting' as const } : c
            );
            exitTimers.current.set(finalCard.id, setTimeout(() => {
              exitTimers.current.delete(finalCard.id);
              setFeed((f) => f.filter((c) => c.id !== finalCard.id));
            }, EXIT_ANIM_MS));
            return exiting;
          }
          setTimeout(() => scheduleDismiss(finalCard.id), 0);
          return updated;
        });
      }

      prevStreaming.current[persona.id] = nowStreaming;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaStates]);

  // Update streaming cards with latest text/citations
  useEffect(() => {
    setFeed((prev) => {
      let changed = false;
      const next = prev.map((card) => {
        if (!card.streaming) return card;
        const state = personaStates[card.personaId];
        if (!state) return card;
        const newText = state.currentResponse || '';
        const newCitations = state.citations || [];
        if (newText !== card.text || newCitations.length !== card.citations.length) {
          changed = true;
          return { ...card, text: newText, citations: newCitations };
        }
        return card;
      });
      return changed ? next : prev;
    });
  }, [personaStates]);

  // Auto-dismiss oldest idle card when the column overflows the viewport
  useEffect(() => {
    const col = columnRef.current;
    if (!col) return;
    requestAnimationFrame(() => {
      if (col.scrollHeight > col.clientHeight) {
        // Find oldest non-streaming visible card to dismiss
        const oldest = feed.find((c) => c.slide === 'visible' && !c.streaming);
        if (oldest) {
          const dt = dismissTimers.current.get(oldest.id);
          if (dt) { clearTimeout(dt); dismissTimers.current.delete(oldest.id); }
          setFeed((prev) => prev.map((c) =>
            c.id === oldest.id ? { ...c, slide: 'exiting' as const } : c
          ));
          exitTimers.current.set(oldest.id, setTimeout(() => {
            exitTimers.current.delete(oldest.id);
            setFeed((f) => f.filter((c) => c.id !== oldest.id));
          }, EXIT_ANIM_MS));
        }
      }
    });
  }, [feed]);

  // Cleanup timers
  useEffect(() => () => {
    dismissTimers.current.forEach((t) => clearTimeout(t));
    exitTimers.current.forEach((t) => clearTimeout(t));
  }, []);

  return (
    <div className={styles.rail}>
      <div ref={columnRef} className={styles.cardsColumn}>
        {feed.map((card) => {
          const persona = personaMap.current.get(card.personaId);
          if (!persona) return null;

          const state = personaStates[card.personaId];
          const isThinking = card.streaming && state?.waveformState === 'thinking';
          const isActive = card.streaming && state?.waveformState === 'active';

          const trackClass = [
            styles.cardTrack,
            card.slide === 'visible' || card.slide === 'entering' ? styles.cardVisible : '',
            card.slide === 'exiting' ? styles.cardExiting : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={card.id}
              className={trackClass}
              style={{ '--persona-color': persona.color } as React.CSSProperties}
            >
              <div className={styles.card}>
                <button
                  className={styles.closeBtn}
                  onClick={(e) => { e.stopPropagation(); manualDismiss(card.id); }}
                  aria-label={`Dismiss ${persona.name}`}
                  title="Dismiss"
                >
                  ×
                </button>

                {/* Content: name/role + response text */}
                <div className={styles.contentCol}>
                  <div className={styles.identity}>
                    <span className={styles.personaName}>
                      <IconResolver name={persona.icon} size={16} /> {persona.name}
                    </span>
                    <span className={styles.personaRole}>{persona.role}</span>
                  </div>

                  {card.text ? (
                    <p className={styles.responseText}>
                      {card.text}
                      {card.streaming && <span className={styles.cursor}>▋</span>}
                    </p>
                  ) : null}

                  {/* Citation chips */}
                  {card.citations.length > 0 && (
                    <div className={styles.citations}>
                      {card.citations.slice(0, 4).map((c: Citation) => {
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

                {/* Avatar + waveform */}
                <div className={styles.avatarCol}>
                  <div className={[
                    styles.avatarRing,
                    isThinking ? styles.avatarThinking : '',
                    isActive ? styles.avatarActive : '',
                  ].filter(Boolean).join(' ')}>
                    <div className={styles.avatar} aria-hidden="true">
                      <IconResolver name={persona.icon} size={24} className={styles.avatarGlyph} />
                    </div>
                    <span className={[
                      styles.statusDot,
                      isThinking ? styles.dotThinking : '',
                      isActive ? styles.dotSpeaking : '',
                    ].filter(Boolean).join(' ')} />
                  </div>

                  {card.streaming && (isThinking || isActive) ? (
                    <div className={styles.waveSlot}>
                      <WaveformCanvas state={state?.waveformState ?? 'idle'} color={persona.color} height={36} />
                    </div>
                  ) : (
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
