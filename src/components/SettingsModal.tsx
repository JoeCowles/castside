'use client';
// src/components/SettingsModal.tsx

import { useMemo, useState } from 'react';
import { AppSettings, Persona } from '@/types';
import { createEmptyPersona } from '@/lib/personas';
import { validateGeminiKey } from '@/lib/gemini';
import { useSettings } from '@/context/SettingsContext';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsFormProps {
  initialSettings: AppSettings;
  onClose: () => void;
  onSave: (next: AppSettings) => void;
}

function updatePersona(list: Persona[], id: string, patch: Partial<Persona>): Persona[] {
  return list.map((persona) => (persona.id === id ? { ...persona, ...patch } : persona));
}

function SettingsForm({ initialSettings, onClose, onSave }: SettingsFormProps) {
  const [apiKey, setApiKey] = useState(initialSettings.apiKey || '');
  const [elevenLabsKey, setElevenLabsKey] = useState(initialSettings.elevenLabsKey || '');
  const [model, setModel] = useState(initialSettings.model || 'gemini-3.1-pro-preview');
  const [wordThreshold, setWordThreshold] = useState(initialSettings.wordThreshold || 50);
  const [personas, setPersonas] = useState<Persona[]>(initialSettings.personas.map((persona) => ({ ...persona })));
  const [youtubeIngestUrl, setYoutubeIngestUrl] = useState(initialSettings.youtubeIngestUrl);
  const [youtubeStreamKey, setYoutubeStreamKey] = useState(initialSettings.youtubeStreamKey);
  const [selectedPersonaId, setSelectedPersonaId] = useState(initialSettings.personas[0]?.id ?? '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showYoutubeKey, setShowYoutubeKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('Save Settings');

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.id === selectedPersonaId) ?? personas[0] ?? null,
    [personas, selectedPersonaId]
  );

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAddPersona = () => {
    const persona = createEmptyPersona();
    setPersonas((prev) => [...prev, persona]);
    setSelectedPersonaId(persona.id);
  };

  const handleDuplicatePersona = () => {
    if (!selectedPersona) return;
    const duplicate = {
      ...selectedPersona,
      id: crypto.randomUUID(),
      name: `${selectedPersona.name} Copy`,
    };
    setPersonas((prev) => [...prev, duplicate]);
    setSelectedPersonaId(duplicate.id);
  };

  const handleDeletePersona = () => {
    if (!selectedPersona) return;
    const next = personas.filter((persona) => persona.id !== selectedPersona.id);
    setPersonas(next);
    setSelectedPersonaId(next[0]?.id ?? '');
  };

  const handlePersonaField = <K extends keyof Persona>(field: K, value: Persona[K]) => {
    if (!selectedPersona) return;
    setPersonas((prev) => updatePersona(prev, selectedPersona.id, { [field]: value } as Partial<Persona>));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveLabel('Validating…');

    if (apiKey && apiKey !== initialSettings.apiKey) {
      const { valid, error } = await validateGeminiKey(apiKey);
      if (!valid) {
        setSaveLabel('Save Settings');
        setSaving(false);
        alert(`Invalid API key: ${error}`);
        return;
      }
    }

    const next: AppSettings = {
      apiKey,
      elevenLabsKey,
      model,
      wordThreshold,
      personas,
      youtubeIngestUrl,
      youtubeStreamKey,
    };

    setSaveLabel('Saving…');
    onSave(next);
    setSaveLabel('Saved');
    setSaving(false);
    setTimeout(() => onClose(), 400);
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Settings">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>⚙️ Settings</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.group}>
            <label className={styles.label} htmlFor="api-key-input">Google Gemini API Key</label>
            <p className={styles.hint}>Stored only in localStorage and sent directly to Google for commentary and transcription.</p>
            <div className={styles.inputRow}>
              <input
                id="api-key-input"
                type={showGeminiKey ? 'text' : 'password'}
                className={styles.input}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <button
                className={styles.iconBtn}
                onClick={() => setShowGeminiKey((value) => !value)}
                aria-label={showGeminiKey ? 'Hide key' : 'Show key'}
              >
                {showGeminiKey ? '🙈' : '👁️'}
              </button>
            </div>
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className={styles.link}>
              Get a Gemini API key →
            </a>
          </div>

          <div className={styles.group}>
            <label className={styles.label} htmlFor="elevenlabs-key-input">ElevenLabs API Key</label>
            <p className={styles.hint}>Optional, but preferred for transcription quality.</p>
            <input
              id="elevenlabs-key-input"
              type="password"
              className={styles.input}
              value={elevenLabsKey}
              onChange={(e) => setElevenLabsKey(e.target.value)}
              placeholder="sk_..."
              autoComplete="off"
              spellCheck={false}
            />
            <a href="https://elevenlabs.io/app/api-key" target="_blank" rel="noopener noreferrer" className={styles.link}>
              Get an ElevenLabs API key →
            </a>
          </div>

          <div className={styles.group}>
            <label className={styles.label} htmlFor="model-select">Model</label>
            <p className={styles.hint}>Use Pro for the richest commentary and Flash for faster turn-around.</p>
            <select
              id="model-select"
              className={styles.input}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <optgroup label="Gemini 3.1">
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>
              </optgroup>
              <optgroup label="Gemini 3">
                <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
              </optgroup>
              <optgroup label="Gemini 2.5">
                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
              </optgroup>
            </select>
          </div>

          <div className={styles.group}>
            <label className={styles.label} htmlFor="word-slider">Trigger Threshold</label>
            <p className={styles.hint}>How much transcript should accumulate before commentators consider chiming in.</p>
            <div className={styles.sliderRow}>
              <input
                id="word-slider"
                type="range"
                min={15}
                max={150}
                value={wordThreshold}
                onChange={(e) => setWordThreshold(Number(e.target.value))}
                className={styles.slider}
              />
              <span className={styles.sliderLabel}>{wordThreshold} words</span>
            </div>
          </div>

          <div className={styles.group}>
            <div className={styles.sectionHeader}>
              <div>
                <label className={styles.label}>Commentators</label>
                <p className={styles.hint}>Create, edit, duplicate, disable, and delete commentators without touching code.</p>
              </div>
              <button className={styles.addBtn} onClick={handleAddPersona}>+ Add</button>
            </div>

            <div className={styles.commentatorEditor}>
              <div className={styles.personaList}>
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    className={[styles.personaRow, persona.id === selectedPersonaId ? styles.personaRowActive : ''].join(' ')}
                    onClick={() => setSelectedPersonaId(persona.id)}
                    type="button"
                  >
                    <div
                      className={styles.personaAvatar}
                      style={{ '--persona-color': persona.color } as React.CSSProperties}
                      aria-hidden="true"
                    >
                      {persona.icon}
                    </div>
                    <div className={styles.personaInfo}>
                      <span className={styles.personaName}>{persona.name}</span>
                      <span className={styles.personaRole}>{persona.role}</span>
                    </div>
                    <span className={styles.personaEnabled}>{persona.enabled ? 'On' : 'Off'}</span>
                  </button>
                ))}
              </div>

              {selectedPersona ? (
                <div className={styles.editorCard}>
                  <div className={styles.editorActions}>
                    <button className={styles.secondaryBtn} onClick={handleDuplicatePersona} type="button">Duplicate</button>
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => handlePersonaField('enabled', !selectedPersona.enabled)}
                      type="button"
                    >
                      {selectedPersona.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button className={styles.deleteBtn} onClick={handleDeletePersona} type="button" disabled={personas.length <= 1}>
                      Delete
                    </button>
                  </div>

                  <div className={styles.gridTwo}>
                    <div className={styles.group}>
                      <label className={styles.label}>Name</label>
                      <input className={styles.input} value={selectedPersona.name} onChange={(e) => handlePersonaField('name', e.target.value)} />
                    </div>
                    <div className={styles.group}>
                      <label className={styles.label}>Title</label>
                      <input className={styles.input} value={selectedPersona.role} onChange={(e) => handlePersonaField('role', e.target.value)} />
                    </div>
                  </div>

                  <div className={styles.gridThree}>
                    <div className={styles.group}>
                      <label className={styles.label}>Icon</label>
                      <input className={styles.input} value={selectedPersona.icon} onChange={(e) => handlePersonaField('icon', e.target.value)} maxLength={4} />
                    </div>
                    <div className={styles.group}>
                      <label className={styles.label}>Color</label>
                      <input className={styles.colorInput} type="color" value={selectedPersona.color} onChange={(e) => handlePersonaField('color', e.target.value)} />
                    </div>
                    <div className={styles.group}>
                      <label className={styles.label}>Search</label>
                      <button
                        className={[styles.togglePill, selectedPersona.useSearch ? styles.togglePillOn : ''].join(' ')}
                        onClick={() => handlePersonaField('useSearch', !selectedPersona.useSearch)}
                        type="button"
                      >
                        {selectedPersona.useSearch ? 'Grounded' : 'Local'}
                      </button>
                    </div>
                  </div>

                  <div className={styles.gridThree}>
                    <div className={styles.group}>
                      <label className={styles.label}>Cooldown</label>
                      <input className={styles.input} type="number" min={1} value={selectedPersona.cooldown} onChange={(e) => handlePersonaField('cooldown', Number(e.target.value))} />
                    </div>
                    <div className={styles.group}>
                      <label className={styles.label}>Temperature</label>
                      <input className={styles.input} type="number" min={0} max={2} step={0.1} value={selectedPersona.temperature} onChange={(e) => handlePersonaField('temperature', Number(e.target.value))} />
                    </div>
                    <div className={styles.group}>
                      <label className={styles.label}>Max Tokens</label>
                      <input className={styles.input} type="number" min={256} max={8000} step={256} value={selectedPersona.maxTokens} onChange={(e) => handlePersonaField('maxTokens', Number(e.target.value))} />
                    </div>
                  </div>

                  <div className={styles.group}>
                    <label className={styles.label}>System Prompt</label>
                    <textarea
                      className={styles.textarea}
                      rows={7}
                      value={selectedPersona.systemPrompt}
                      onChange={(e) => handlePersonaField('systemPrompt', e.target.value)}
                    />
                  </div>

                  <div className={styles.group}>
                    <label className={styles.label}>Relevance Prompt</label>
                    <textarea
                      className={styles.textarea}
                      rows={5}
                      value={selectedPersona.relevancePrompt}
                      onChange={(e) => handlePersonaField('relevancePrompt', e.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.group}>
            <label className={styles.label}>YouTube Live</label>
            <p className={styles.hint}>
              CastSide can now save your YouTube ingest details and jump you into Live Control Room.
              Actual RTMPS publishing still needs an encoder/relay layer, because this app runs entirely in the browser.
            </p>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                value={youtubeIngestUrl}
                onChange={(e) => setYoutubeIngestUrl(e.target.value)}
                placeholder="rtmps://a.rtmps.youtube.com/live2"
              />
              <a className={styles.secondaryBtnLink} href="https://studio.youtube.com/channel/UC/livestreaming" target="_blank" rel="noopener noreferrer">
                Open YouTube
              </a>
            </div>
            <div className={styles.inputRow}>
              <input
                className={styles.input}
                type={showYoutubeKey ? 'text' : 'password'}
                value={youtubeStreamKey}
                onChange={(e) => setYoutubeStreamKey(e.target.value)}
                placeholder="YouTube stream key"
              />
              <button className={styles.iconBtn} onClick={() => setShowYoutubeKey((value) => !value)} type="button">
                {showYoutubeKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, saveAndClose } = useSettings();

  if (!isOpen) return null;

  return (
    <SettingsForm
      key={`${settings.apiKey}:${settings.personas.length}:${settings.wordThreshold}`}
      initialSettings={settings}
      onClose={onClose}
      onSave={saveAndClose}
    />
  );
}
