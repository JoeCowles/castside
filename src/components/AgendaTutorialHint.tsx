'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './AgendaTutorialHint.module.css';

/**
 * Small floating hint that points at the agenda button when the user hasn't
 * configured an agenda yet. Locates the visible button via the
 * `data-agenda-button` attribute and portals a pill+arrow under it.
 */
export default function AgendaTutorialHint() {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const measure = useCallback(() => {
    const candidates = document.querySelectorAll<HTMLElement>('[data-agenda-button]');
    let target: HTMLElement | null = null;
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { target = el; break; }
    }
    if (!target) {
      setPos(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setPos({
      top: rect.bottom + 10,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    measure();
    const handle = () => measure();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);

    // Re-measure if layout shifts (e.g. button mounts after our first pass).
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(handle)
      : null;
    ro?.observe(document.body);

    // Re-measure on a short interval for the first second to catch late mounts
    // without committing to a permanent observer.
    let ticks = 0;
    const id = window.setInterval(() => {
      measure();
      ticks++;
      if (ticks > 6) window.clearInterval(id);
    }, 150);

    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
      ro?.disconnect();
      window.clearInterval(id);
    };
  }, [measure]);

  if (typeof document === 'undefined' || !pos) return null;

  return createPortal(
    <div
      className={styles.hint}
      style={{ top: pos.top, left: pos.left }}
      role="status"
      aria-live="polite"
    >
      <span className={styles.arrow} aria-hidden="true" />
      <span className={styles.label}>Paste an agenda here</span>
    </div>,
    document.body,
  );
}
