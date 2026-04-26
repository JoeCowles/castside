'use client';
// src/components/CommentaryHistory.tsx
// Chatroom-style view of all commentator messages.

import { useEffect, useRef } from 'react';
import { CommentaryMessage } from '@/types';
import { IconResolver } from './IconResolver';
import styles from './CommentaryHistory.module.css';

interface CommentaryHistoryProps {
  messages: CommentaryMessage[];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function CommentaryHistory({ messages }: CommentaryHistoryProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Commentary</h2>
        <span className={styles.count}>{messages.length} messages</span>
      </div>

      <div className={styles.body} ref={bodyRef}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <p>No commentary yet. Commentators will appear here as they respond.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={styles.message}>
              <div className={styles.avatar} style={{ borderColor: msg.personaColor }}>
                <IconResolver name={msg.personaIcon} size={16} />
              </div>
              <div className={styles.bubble}>
                <div className={styles.bubbleHeader}>
                  <span className={styles.name} style={{ color: msg.personaColor }}>{msg.personaName}</span>
                  <span className={styles.time}>{formatTime(msg.timestamp)}</span>
                </div>
                <p className={styles.text}>{msg.text}</p>
                {msg.citations.length > 0 && (
                  <div className={styles.citations}>
                    {msg.citations.slice(0, 4).map((c) => {
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
