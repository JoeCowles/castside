'use client';
// src/components/TranscriptPanel.tsx

import { useEffect, useRef } from 'react';
import { Mic, MessageSquare } from 'lucide-react';
import { TranscriptChunk } from '@/types';
import styles from './TranscriptPanel.module.css';

interface TranscriptPanelProps {
  chunks: TranscriptChunk[];
  interimText: string;
  isListening: boolean;
  onClear: () => void;
  commentaryCount?: number;
  onToggleCommentary?: () => void;
  showingCommentary?: boolean;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TranscriptPanel({
  chunks,
  interimText,
  isListening,
  onClear,
  commentaryCount = 0,
  onToggleCommentary,
  showingCommentary = false,
}: TranscriptPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  // Track whether the user has scrolled away from the bottom
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
      userScrolledUp.current = !atBottom;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-scroll to bottom on new content — only if user hasn't scrolled up
  useEffect(() => {
    const el = bodyRef.current;
    if (el && !userScrolledUp.current) el.scrollTop = el.scrollHeight;
  }, [chunks, interimText]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Live Transcript</h2>
          {isListening && (
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} />
              LIVE
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          <span className={styles.chunkCount}>{chunks.length} segments</span>
          {onToggleCommentary && (
            <button
              className={[styles.commentaryBtn, showingCommentary ? styles.commentaryBtnActive : ''].join(' ')}
              onClick={onToggleCommentary}
            >
              <MessageSquare size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
              Chat{commentaryCount > 0 ? ` (${commentaryCount})` : ''}
            </button>
          )}
          <button className={styles.clearBtn} onClick={onClear} disabled={chunks.length === 0}>
            Clear
          </button>
        </div>
      </div>

      <div className={styles.body} ref={bodyRef}>
        {chunks.length === 0 && !interimText ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon} style={{ display: 'flex', justifyContent: 'center' }}><Mic size={32} /></div>
            <p>Start listening to see the live transcript here.</p>
            <p className={styles.emptyHint}>Tip: Use a virtual audio cable to route any podcast through your mic input.</p>
          </div>
        ) : (
          <>
            {chunks.map((chunk) => (
              <div key={chunk.id} className={styles.chunk}>
                <span className={styles.timestamp}>{formatTime(chunk.timestamp)}</span>
                <p className={styles.chunkText}>{chunk.text}</p>
              </div>
            ))}
            {interimText && (
              <div className={[styles.chunk, styles.interim].join(' ')}>
                <span className={styles.timestamp}>…</span>
                <p className={styles.chunkText}>{interimText}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
