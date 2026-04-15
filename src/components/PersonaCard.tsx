'use client';
// src/components/PersonaCard.tsx
// Individual card for a single AI persona.
// compact=true renders a slimmer version for the video overlay sidebar.
//
// Animation states:
//   idle     → avatar + name/role shown, waveform hidden
//   thinking → avatar breathes with a subtle glow; info still visible
//   active   → info slides left out, waveform slides in; avatar nudges left

import { Persona, PersonaState } from '@/types';
import WaveformCanvas from './WaveformCanvas';
import styles from './PersonaCard.module.css';

interface PersonaCardProps {
  persona: Persona;
  state: PersonaState;
  compact?: boolean;
}

function getCooldownLabel(cooldownUntil: number): string {
  return cooldownUntil > 0 ? 'active' : '';
}

export default function PersonaCard({ persona, state, compact = false }: PersonaCardProps) {
  const { waveformState, currentResponse, isStreaming, cooldownUntil, error } = state;
  const isOnCooldown = cooldownUntil > 0 && !isStreaming;
  const isActive   = waveformState === 'active';
  const isThinking = waveformState === 'thinking';

  const statusLabel = isStreaming
    ? waveformState === 'thinking' ? 'Thinking…' : 'Speaking…'
    : isOnCooldown
    ? `Cooldown ${getCooldownLabel(cooldownUntil)}`
    : 'Idle';

  const cardClass = [
    styles.card,
    isActive   ? styles.cardSpeaking  : '',
    isThinking ? styles.cardThinking  : '',
    compact    ? styles.compact        : '',
  ].filter(Boolean).join(' ');

  const avatarWrapClass = [
    styles.avatarWrap,
    isActive   ? styles.avatarActive   : '',
    isThinking ? styles.avatarThinking : '',
  ].filter(Boolean).join(' ');

  const dotClass = [
    styles.statusDot,
    isActive   ? styles.dotSpeaking  : '',
    isThinking ? styles.dotThinking  : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClass}
      style={{ '--persona-color': persona.color } as React.CSSProperties}
    >
      {/* Header — avatar + sliding content slot */}
      <div className={styles.header}>
        <div className={avatarWrapClass}>
            <div
              className={styles.avatar}
              style={{ width: compact ? 36 : 44, height: compact ? 36 : 44 }}
              aria-hidden="true"
            >
              <span className={styles.avatarGlyph}>{persona.icon}</span>
            </div>
          <span className={dotClass} />
        </div>

        {/* Slot: info text slides out, waveform slides in */}
        <div className={styles.contentSlot} style={{ height: compact ? 36 : 44 }}>
          {/* Info layer — visible when idle or thinking */}
          <div className={[styles.infoLayer, isActive ? styles.infoHidden : ''].filter(Boolean).join(' ')}>
            <div className={styles.nameRow}>
              <span className={styles.emoji}>{persona.icon}</span>
              <span className={styles.name}>{persona.name}</span>
            </div>
            {!compact && <span className={styles.role}>{persona.role}</span>}
          </div>

          {/* Waveform layer — slides in when active */}
          <div className={[styles.waveformLayer, isActive ? styles.waveformVisible : ''].filter(Boolean).join(' ')}>
            <WaveformCanvas
              state={waveformState}
              color={persona.color}
              height={compact ? 30 : 40}
            />
          </div>
        </div>

        {!compact && <span className={styles.statusBadge}>{statusLabel}</span>}
      </div>

      {/* Response bubble */}
      <div className={styles.responseBubble}>
        {error ? (
          <p className={styles.errorText}>⚠️ {error}</p>
        ) : currentResponse ? (
          <p className={styles.responseText}>
            {currentResponse}
            {isStreaming && <span className={styles.cursor}>▋</span>}
          </p>
        ) : (
          <p className={styles.placeholder}>Waiting for audio…</p>
        )}
      </div>
    </div>
  );
}
