'use client';

import React from 'react';
import { TranscriptHighlight } from '@/types';

/**
 * Normalize a string for fuzzy matching: lowercase, collapse whitespace,
 * strip common punctuation. Returns the normalized string and a mapping
 * from each normalized-string index back to the original-string index.
 */
function normalize(str: string): { norm: string; map: number[] } {
  const norm: string[] = [];
  const map: number[] = [];
  let prevSpace = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    // Strip punctuation that transcription may add/omit inconsistently
    if (/[.,!?;:'"()\-–—]/.test(ch)) continue;
    if (/\s/.test(ch)) {
      if (!prevSpace && norm.length > 0) {
        norm.push(' ');
        map.push(i);
        prevSpace = true;
      }
      continue;
    }
    norm.push(ch.toLowerCase());
    map.push(i);
    prevSpace = false;
  }
  return { norm: norm.join(''), map };
}

/** Render text with highlighted spans where any highlight substring matches (fuzzy, case/punctuation insensitive). */
export default function HighlightedText({ text, highlights }: { text: string; highlights: TranscriptHighlight[] }) {
  if (!highlights || highlights.length === 0) return <>{text}</>;

  const { norm: normText, map: textMap } = normalize(text);

  // Build a list of match regions in original-string coordinates
  const regions: { start: number; end: number; color: string }[] = [];

  for (const h of highlights) {
    if (!h.text) continue;
    const { norm: normNeedle } = normalize(h.text);
    if (!normNeedle) continue;

    let pos = 0;
    while (pos <= normText.length - normNeedle.length) {
      const idx = normText.indexOf(normNeedle, pos);
      if (idx === -1) break;
      // Map normalized positions back to original string positions
      const origStart = textMap[idx];
      const origEndNorm = idx + normNeedle.length - 1;
      // The end in original text is the char after the last matched normalized char
      const origEnd = origEndNorm < textMap.length - 1
        ? textMap[origEndNorm + 1]
        : text.length;
      regions.push({ start: origStart, end: origEnd, color: h.color });
      pos = idx + normNeedle.length;
    }
  }

  if (regions.length === 0) return <>{text}</>;

  // Sort by start, merge overlaps
  regions.sort((a, b) => a.start - b.start);
  const merged: typeof regions = [regions[0]];
  for (let i = 1; i < regions.length; i++) {
    const prev = merged[merged.length - 1];
    if (regions[i].start <= prev.end) {
      prev.end = Math.max(prev.end, regions[i].end);
    } else {
      merged.push(regions[i]);
    }
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (cursor < r.start) parts.push(text.slice(cursor, r.start));
    parts.push(
      <mark
        key={r.start}
        style={{ background: `${r.color}22`, borderBottom: `2px solid ${r.color}`, color: 'inherit', borderRadius: '2px', padding: '0 1px' }}
      >
        {text.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}
