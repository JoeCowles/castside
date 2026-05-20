'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, X } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import styles from './AgendaModal.module.css';

interface AgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PLACEHOLDER = `Paste or type your show notes. One line per topic works best:

1. Cold open — welcome guest
2. New funding round at Acme Corp
3. The 4-day work week — pro & con
4. Listener question: AI in education
5. Lightning round: hot takes`;

function countItems(text: string): number {
  return text
    .split(/\r?\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 0).length;
}

export default function AgendaModal({ isOpen, onClose }: AgendaModalProps) {
  if (!isOpen) return null;
  return <AgendaModalInner onClose={onClose} />;
}

function AgendaModalInner({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings } = useSettings();
  const [draft, setDraft] = useState(settings.agenda);

  const itemCount = useMemo(() => countItems(draft), [draft]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSave = () => {
    updateSettings({ agenda: draft });
    onClose();
  };

  const handleClear = () => {
    setDraft('');
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Episode agenda">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <ClipboardList size={18} /> Episode Agenda
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.hint}>
            Paste your show notes, run-of-show, or topic list. Commentators will use this for context,
            and the topic tracker will check items off as you cover them.
          </p>
          <textarea
            className={styles.textarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            autoFocus
          />
          <span className={styles.itemCount}>
            {itemCount === 0 ? 'No items detected' : `${itemCount} item${itemCount === 1 ? '' : 's'} detected`}
          </span>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.clearBtn} onClick={handleClear} disabled={!draft}>
            Clear
          </button>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave}>Save Agenda</button>
        </div>
      </div>
    </div>
  );
}
