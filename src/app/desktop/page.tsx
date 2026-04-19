'use client';
// src/app/desktop/page.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTranscript } from '@/hooks/useTranscript';
import { usePersonaOrchestrator } from '@/hooks/usePersonaOrchestrator';
import SettingsModal from '@/components/SettingsModal';
import { Settings, Mic, MicOff } from 'lucide-react';
import styles from './desktop.module.css';

type PermStatus = { microphone: string; screen: string } | null;

export default function DesktopPage() {
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const streamAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Electron detection (client-side only to avoid hydration mismatch)
  const [isElectron, setIsElectron] = useState(false);
  const [permStatus, setPermStatus] = useState<PermStatus>(null);
  const [permLoading, setPermLoading] = useState(false);

  // Mic device selection
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [micDeviceId, setMicDeviceId] = useState<string>('');

  useEffect(() => {
    const isElec = !!window.electronAPI?.isElectron;
    setIsElectron(isElec);
    if (isElec) {
      window.electronAPI!.checkPermissions().then(setPermStatus).catch(console.error);
    }

    // Enumerate audio input devices — works in renderer without IPC
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      setAudioInputs(inputs);
      // Pick first non-default device if available, otherwise first device
      const preferred = inputs.find((d) => d.deviceId !== 'default' && d.deviceId !== 'communications') ?? inputs[0];
      if (preferred) setMicDeviceId(preferred.deviceId);
    }).catch(console.warn);
  }, []);

  // Re-enumerate after permissions are granted (labels appear after first getUserMedia)
  const refreshDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const inputs = devices.filter((d) => d.kind === 'audioinput');
    setAudioInputs(inputs);
    if (inputs.length > 0 && !micDeviceId) {
      const preferred = inputs.find((d) => d.deviceId !== 'default') ?? inputs[0];
      setMicDeviceId(preferred.deviceId);
    }
  }, [micDeviceId]);

  const refreshPerms = useCallback(async () => {
    if (!window.electronAPI?.checkPermissions) return;
    const p = await window.electronAPI.checkPermissions().catch(() => null);
    setPermStatus(p);
    await refreshDevices();
  }, [refreshDevices]);

  const enabledPersonas = useMemo(
    () => settings.personas.filter((p) => p.enabled),
    [settings.personas]
  );

  const handleWaveformChange = useCallback(() => {}, []);

  const { personaStates, onChunkCommitted } = usePersonaOrchestrator({
    personas: enabledPersonas,
    wordThreshold: settings.wordThreshold,
    apiKey: settings.apiKey,
    model: settings.model,
    onWaveformStateChange: handleWaveformChange,
  });

  // Broadcast persona states to the overlay window
  useEffect(() => {
    if (!isElectron) return;
    const api = window.electronAPI;
    if (!api || !('sendPersonaStates' in api)) return;
    (api as { sendPersonaStates: (p: typeof enabledPersonas, s: typeof personaStates) => void })
      .sendPersonaStates(enabledPersonas, personaStates);
  }, [personaStates, enabledPersonas, isElectron]);

  const {
    chunks, interimText, isListening, startListening, stopListening,
    recognitionError, micLevel,
  } = useTranscript({
    source: 'screen',
    streamAudioRef,
    apiKey: settings.apiKey,
    elevenLabsKey: settings.elevenLabsKey,
    onChunkCommitted,
    onPreviewStreamReady: setPreviewStream,
    micDeviceId: micDeviceId || undefined,
  });

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks, interimText]);

  // On Start: request mic permission first, then enumerate devices, then start
  const handleToggle = useCallback(async () => {
    if (isListening) {
      stopListening();
      previewStream?.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
      return;
    }

    if (isElectron && window.electronAPI?.requestMicAccess) {
      setPermLoading(true);
      try {
        const result = await window.electronAPI.requestMicAccess();
        await refreshPerms(); // also re-enumerates devices with real labels
        if (result === 'denied') {
          setPermLoading(false);
          return;
        }
      } catch (err) {
        console.error('[Desktop] Permission request failed:', err);
      }
      setPermLoading(false);
    }

    startListening();
  }, [isListening, startListening, stopListening, previewStream, isElectron, refreshPerms]);

  const hasApiKey = Boolean(settings.apiKey);
  const micDenied    = isElectron && permStatus?.microphone === 'denied';
  const screenDenied = isElectron && permStatus?.screen === 'denied';
  const anyDenied    = micDenied || screenDenied;

  const activeCount = Object.values(personaStates).filter(
    (s) => s.isStreaming || s.waveformState !== 'idle'
  ).length;
  const pulseScale = isListening ? 1 + micLevel * 0.1 : 1;
  const recentChunks = chunks.slice(-6);
  const hasTranscript = recentChunks.length > 0 || !!interimText;

  return (
    <div className={styles.app}>
      {/* Thin drag strip — clears traffic lights and settings button */}
      <div className={styles.dragHandle} />

      {/* ── Top bar ── */}
      <header className={styles.topbar}>
        <div className={styles.logo}>
          <Mic size={13} className={styles.logoIcon} />
          <span className={styles.logoText}>podcommentators</span>
        </div>
        <div className={styles.topRight}>
          <span
            className={[styles.apiDot, hasApiKey ? styles.apiDotOn : ''].join(' ')}
            title={hasApiKey ? 'Gemini connected' : 'No API key'}
          />
          <button
            className={styles.settingsBtn}
            onClick={() => setSettingsOpen(true)}
            id="btn-desktop-settings"
            aria-label="Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* ── Permission banners ── */}
      {micDenied && (
        <div className={styles.permBanner}>
          <span>🎙️ Microphone denied</span>
          <button className={styles.permBtn} onClick={() => window.electronAPI?.openPrivacySettings?.('microphone')}>
            Fix in System Settings →
          </button>
        </div>
      )}
      {screenDenied && (
        <div className={styles.permBanner}>
          <span>🖥️ Screen Recording denied</span>
          <button className={styles.permBtn} onClick={() => window.electronAPI?.openPrivacySettings?.('screen')}>
            Fix in System Settings →
          </button>
        </div>
      )}

      {/* ── Main ── */}
      <main className={styles.main}>
        <p className={[styles.statusLabel, isListening ? styles.statusLabelActive : ''].join(' ')}>
          {permLoading ? 'Requesting permission…' : isListening
            ? activeCount > 0 ? `${activeCount} commentator${activeCount > 1 ? 's' : ''} responding` : 'Listening…'
            : anyDenied ? 'Permission required' : 'Ready'}
        </p>

        {/* Orb */}
        <button
          className={[styles.orb, isListening ? styles.orbActive : '', anyDenied ? styles.orbWarning : ''].join(' ')}
          style={{ transform: `scale(${pulseScale})` }}
          onClick={handleToggle}
          id="btn-desktop-start-stop"
          disabled={!hasApiKey || permLoading}
        >
          <div className={styles.orbGlow} />
          <div className={styles.orbInner}>
            {isListening
              ? <MicOff size={20} className={styles.orbIcon} />
              : micDenied
                ? <MicOff size={20} className={styles.orbIconWarning} />
                : <Mic size={20} className={styles.orbIcon} />}
            <span className={styles.orbLabel}>
              {permLoading ? '…' : isListening ? 'Stop' : 'Start'}
            </span>
          </div>
        </button>

        {/* Mic device picker */}
        {audioInputs.length > 1 && (
          <div className={styles.micPickerRow}>
            <Mic size={11} className={styles.micPickerIcon} />
            <select
              id="select-mic-device"
              className={styles.micPicker}
              value={micDeviceId}
              onChange={(e) => setMicDeviceId(e.target.value)}
              disabled={isListening}
              title="Select microphone input"
            >
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${audioInputs.indexOf(d) + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error */}
        {recognitionError && <p className={styles.errorMsg}>{recognitionError}</p>}

        {/* No API key nudge */}
        {!hasApiKey && (
          <p className={styles.nudge}>
            <button className={styles.nudgeBtn} onClick={() => setSettingsOpen(true)}>Open Settings</button>
            {' '}to add your Gemini API key
          </p>
        )}

        {/* Transcript */}
        {hasTranscript && (
          <div className={styles.transcript}>
            {recentChunks.map((chunk) => (
              <p key={chunk.id} className={styles.chunk}>{chunk.text}</p>
            ))}
            {interimText && (
              <p className={styles.interim}>{interimText}<span className={styles.cursor}>▋</span></p>
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {isListening && !hasTranscript && (
          <div className={styles.transcriptPlaceholder}>
            <div className={styles.listeningDots}><span /><span /><span /></div>
            <p>Waiting for audio…</p>
          </div>
        )}
      </main>

      {/* ── Persona dots footer ── */}
      <footer className={styles.footer}>
        {enabledPersonas.map((persona) => {
          const state = personaStates[persona.id];
          const isActive = state?.waveformState !== 'idle';
          return (
            <div key={persona.id} className={styles.personaDot} title={persona.name}>
              <span
                className={[styles.dot, isActive ? styles.dotActive : ''].join(' ')}
                style={{ '--color': persona.color, background: persona.color, opacity: isActive ? 1 : 0.25 } as React.CSSProperties}
              />
              <span className={styles.dotLabel} style={{ color: isActive ? persona.color : undefined }}>
                {persona.name}
              </span>
            </div>
          );
        })}
      </footer>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
