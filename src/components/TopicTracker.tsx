'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardList,
  Check,
  Circle,
  Dot,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { AgendaLink, AgendaTopic } from '@/types';
import styles from './TopicTracker.module.css';

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

interface TopicTrackerProps {
  topics: AgendaTopic[];
  currentIndex: number | null;
  coveredIndices: Set<number>;
  currentSubtopicIndex?: number | null;
  /** Set of `"topicIdx:subIdx"` keys for covered subtopics. */
  coveredSubtopicKeys?: Set<string>;
  parsing?: boolean;
  defaultExpanded?: boolean;
  /** Visual variant — 'panel' is the default boxed layout; 'flush' fills its container. */
  variant?: 'panel' | 'flush';
  onEdit?: () => void;
}

interface PopoverState {
  key: string;            // "topicIdx:subIdx"
  details: string;
  links: AgendaLink[];
}

export default function TopicTracker({
  topics,
  currentIndex,
  coveredIndices,
  currentSubtopicIndex = null,
  coveredSubtopicKeys,
  parsing = false,
  defaultExpanded = false,
  variant = 'panel',
  onEdit,
}: TopicTrackerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [openTopics, setOpenTopics] = useState<Set<number>>(() => new Set());
  const [prevCurrent, setPrevCurrent] = useState<number | null>(currentIndex);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const subtopicRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const hideTimerRef = useRef<number | null>(null);

  // Auto-open the current topic and auto-collapse the previous one when the
  // active topic flips (state-on-prop-change pattern — no useEffect).
  if (currentIndex !== prevCurrent) {
    setPrevCurrent(currentIndex);
    const next = new Set(openTopics);
    if (prevCurrent !== null) next.delete(prevCurrent);
    if (currentIndex !== null) next.add(currentIndex);
    if (next.size !== openTopics.size || !setsEqual(next, openTopics)) {
      setOpenTopics(next);
    }
  }

  const toggleTopic = (i: number) => {
    setOpenTopics((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setPopover(null), 180);
  }, [clearHideTimer]);

  const showHover = useCallback(
    (key: string, details: string, links: AgendaLink[]) => {
      clearHideTimer();
      if (!details && links.length === 0) return;
      setPopover({ key, details, links });
    },
    [clearHideTimer]
  );

  const dismissHover = useCallback(() => scheduleHide(), [scheduleHide]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const getAnchor = useCallback(
    (key: string) => subtopicRefs.current.get(key) ?? null,
    [],
  );

  if (topics.length === 0) {
    if (!parsing) return null;
    return (
      <div className={[styles.wrap, variant === 'flush' ? styles.wrapFlush : ''].join(' ')}>
        <div className={styles.headerLeft}>
          <Loader2 size={12} className={[styles.headerIcon, styles.spin].join(' ')} />
          Parsing agenda…
        </div>
      </div>
    );
  }

  const coveredCount = coveredIndices.size + (currentIndex !== null && !coveredIndices.has(currentIndex) ? 1 : 0);

  return (
    <div className={[styles.wrap, variant === 'flush' ? styles.wrapFlush : ''].join(' ')}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className={styles.headerLeft}>
          <ClipboardList size={12} className={styles.headerIcon} />
          Agenda
        </span>
        <span className={styles.progress}>
          {parsing && <Loader2 size={11} className={styles.spin} style={{ marginRight: 6, verticalAlign: 'middle' }} />}
          {coveredCount} / {topics.length}
          {expanded ? <ChevronUp size={12} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
                    : <ChevronDown size={12} style={{ marginLeft: 6, verticalAlign: 'middle' }} />}
        </span>
      </button>

      {expanded && (
        <div className={styles.list} onDoubleClick={onEdit} title={onEdit ? 'Double-click to edit agenda' : undefined}>
          {topics.map((topic, i) => {
            const isCurrent = i === currentIndex;
            const isCovered = coveredIndices.has(i) && !isCurrent;
            const isOpen = openTopics.has(i);
            const hasSub = topic.subtopics.length > 0;
            const rowCls = [
              styles.item,
              isCurrent ? styles.itemCurrent : '',
              isCovered ? styles.itemCovered : '',
              !isCurrent && !isCovered ? styles.itemPending : '',
            ].join(' ');
            return (
              <div key={`${i}-${topic.title}`} className={styles.topicWrap}>
                <button
                  type="button"
                  className={[styles.itemButton, rowCls].join(' ')}
                  onClick={() => hasSub && toggleTopic(i)}
                  aria-expanded={hasSub ? isOpen : undefined}
                  disabled={!hasSub}
                >
                  <span className={styles.itemIcon}>
                    {isCovered ? <Check size={12} />
                      : isCurrent ? <Dot size={14} />
                      : <Circle size={9} />}
                  </span>
                  <span className={styles.itemText}>{topic.title}</span>
                  {hasSub && (
                    <span className={styles.disclosure} aria-hidden="true">
                      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </span>
                  )}
                </button>
                {hasSub && isOpen && (
                  <ul className={styles.sublist}>
                    {topic.subtopics.map((sub, j) => {
                      const key = `${i}:${j}`;
                      const isSubCurrent = i === currentIndex && j === currentSubtopicIndex;
                      const isSubCovered =
                        (coveredSubtopicKeys?.has(key) ?? false) && !isSubCurrent;
                      const hasContent = !!sub.details || sub.links.length > 0;
                      const isPopoverTarget = popover?.key === key;
                      const subCls = [
                        styles.sublistItem,
                        isSubCurrent ? styles.sublistItemCurrent : '',
                        isSubCovered ? styles.sublistItemCovered : '',
                        hasContent ? styles.sublistItemHasDetails : '',
                        isPopoverTarget ? styles.sublistItemActive : '',
                      ].join(' ');
                      return (
                        <li
                          key={key}
                          ref={(el) => {
                            if (el) subtopicRefs.current.set(key, el);
                            else subtopicRefs.current.delete(key);
                          }}
                          className={subCls}
                          onMouseEnter={hasContent ? () => showHover(key, sub.details, sub.links) : undefined}
                          onMouseLeave={hasContent ? dismissHover : undefined}
                          onFocus={hasContent ? () => showHover(key, sub.details, sub.links) : undefined}
                          onBlur={hasContent ? dismissHover : undefined}
                          tabIndex={hasContent ? 0 : undefined}
                        >
                          {isSubCovered && <Check size={10} className={styles.sublistItemCheck} />}
                          <span className={styles.sublistItemText}>{sub.text}</span>
                          {hasContent && (
                            <Sparkles size={10} className={styles.sublistItemDetailsHint} aria-hidden="true" />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {popover && (
        <DetailsPopover
          state={popover}
          getAnchor={getAnchor}
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  );
}

interface DetailsPopoverProps {
  state: PopoverState;
  getAnchor: (key: string) => HTMLElement | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function DetailsPopover({ state, getAnchor, onMouseEnter, onMouseLeave }: DetailsPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const reposition = useCallback(() => {
    const el = ref.current;
    const anchorEl = getAnchor(state.key);
    if (!el || !anchorEl) return;
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = anchorEl.getBoundingClientRect();
    const popW = Math.min(360, el.offsetWidth || 360);
    const popH = el.offsetHeight || 120;

    let left = rect.right + margin;
    let top = rect.top;
    if (left + popW + margin > vw) {
      if (rect.left - margin - popW >= margin) {
        left = rect.left - margin - popW;
      } else if (rect.bottom + margin + popH <= vh) {
        left = Math.max(margin, Math.min(vw - popW - margin, rect.left));
        top = rect.bottom + margin;
      } else {
        left = Math.max(margin, Math.min(vw - popW - margin, rect.left));
        top = Math.max(margin, rect.top - margin - popH);
      }
    } else {
      top = Math.max(margin, Math.min(vh - popH - margin, top));
    }
    setCoords((prev) => {
      if (prev && prev.top === top && prev.left === left && prev.width === popW) return prev;
      return { top, left, width: popW };
    });
  }, [getAnchor, state.key]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => { reposition(); }, [reposition, state.details, state.links]);

  useEffect(() => {
    const handle = () => reposition();
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [reposition]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className={styles.popover}
      style={{
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        maxWidth: coords?.width ?? 360,
        opacity: coords ? 1 : 0,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.popoverLabel}>
        <Sparkles size={10} /> Context
      </div>
      {state.details && <div className={styles.popoverBody}>{state.details}</div>}
      {state.links.length > 0 && (
        <div className={styles.popoverLinks}>
          {state.links.map((link, idx) => (
            <LinkPreview key={`${idx}-${link.url}`} link={link} />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

function LinkPreview({ link }: { link: AgendaLink }) {
  let hostname = '';
  try { hostname = new URL(link.url).hostname.replace(/^www\./, ''); } catch { hostname = link.url; }
  const favicon = hostname
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`
    : '';
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.linkCard}
      title={link.url}
    >
      {favicon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={favicon} alt="" className={styles.linkFavicon} width={16} height={16} />
      )}
      <span className={styles.linkBody}>
        <span className={styles.linkTitleRow}>
          <span className={styles.linkTitle}>{link.title || hostname}</span>
          <ExternalLink size={10} className={styles.linkExternal} aria-hidden="true" />
        </span>
        <span className={styles.linkHost}>{hostname}</span>
        {link.description && <span className={styles.linkDescription}>{link.description}</span>}
      </span>
    </a>
  );
}

interface TopicChipProps {
  title: string;
  index: number;
  total: number;
  onClick?: () => void;
}

/** Tiny inline chip showing only the current topic — for crowded layouts. */
export function TopicChip({ title, index, total, onClick }: TopicChipProps) {
  if (!title) return null;
  return (
    <button type="button" className={styles.chip} onClick={onClick} title="Open agenda">
      <ClipboardList size={11} className={styles.chipIcon} />
      <span className={styles.chipLabel}>{title}</span>
      <span className={styles.chipCount}>{index + 1}/{total}</span>
    </button>
  );
}
