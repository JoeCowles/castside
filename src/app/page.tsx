'use client';
// src/app/page.tsx
// CastSide main page — orchestrates audio/video sources, transcript, and AI persona sidebar.

import { useCallback, useMemo, useRef, useState } from 'react';
import { AppMode, AudioSource } from '@/types';
import { useSettings } from '@/context/SettingsContext';
import { useTranscript } from '@/hooks/useTranscript';
import { usePersonaOrchestrator } from '@/hooks/usePersonaOrchestrator';
import AudioSourcePanel from '@/components/AudioSourcePanel';
import TranscriptPanel from '@/components/TranscriptPanel';
import CommentatorRail from '@/components/CommentatorRail';
import VideoDisplay from '@/components/VideoDisplay';
import SettingsModal from '@/components/SettingsModal';
import styles from './page.module.css';

export default function Home() {
  const { settings } = useSettings();
  const [mode, setMode] = useState<AppMode>('enhanced');
  const [source, setSource] = useState<AudioSource>('mic');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Video state
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isVideoStream, setIsVideoStream] = useState(false);
  const streamAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ── Enabled personas (filtered list) ──────────────────────────────────────
  const enabledPersonas = useMemo(
    () => settings.personas.filter((persona) => persona.enabled),
    [settings.personas]
  );

  // ── Waveform state change callback ────────────────────────────────────────
  const handleWaveformChange = useCallback(() => { /* personaStates are the source of truth */ }, []);

  // ── Persona orchestrator ─────────────────────────────────────────────────
  const { personaStates, onChunkCommitted } = usePersonaOrchestrator({
    personas: enabledPersonas,
    wordThreshold: settings.wordThreshold,
    apiKey: settings.apiKey,
    model: settings.model,
    onWaveformStateChange: handleWaveformChange,
  });

  // ── Transcript hook ───────────────────────────────────────────────────────
  const { chunks, interimText, isListening, startListening, stopListening, clearTranscript, micLevel, recognitionError, transcriptionEngine } =
    useTranscript({
      source,
      streamAudioRef,
      apiKey: settings.apiKey,
      elevenLabsKey: settings.elevenLabsKey,
      onChunkCommitted,
      onPreviewStreamReady: setPreviewStream,
    });

  // ── Camera start/stop ─────────────────────────────────────────────────────
  const handleToggleListening = useCallback(async () => {
    if (isListening) {
      stopListening();
      if (source === 'camera') {
        previewStream?.getTracks().forEach((t) => t.stop());
        setPreviewStream(null);
      }
      return;
    }

    if (source === 'camera') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setPreviewStream(stream);
      } catch (err) {
        alert('Could not access camera/microphone: ' + (err as Error).message);
        return;
      }
    }
    // 'screen' source: getDisplayMedia picker is opened inside the hook; nothing to do here
    startListening();
  }, [isListening, source, previewStream, startListening, stopListening]);

  // ── Video stream URL handler ───────────────────────────────────────────────
  const handleStreamUrlChange = useCallback((url: string, isVideo: boolean) => {
    setIsVideoStream(isVideo);
    if (isVideo && videoRef.current) {
      videoRef.current.src = url;
    }
  }, []);

  const handleStopVideo = useCallback(() => {
    stopListening();
    previewStream?.getTracks().forEach((track) => track.stop());
    setPreviewStream(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    setIsVideoStream(false);
  }, [previewStream, stopListening]);

  const hasApiKey = Boolean(settings.apiKey);
  const hasVideo = Boolean(previewStream) || isVideoStream;

  return (
    <div className={styles.app}>
      {/* ── Top Bar ── */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🎙️</span>
            <span className={styles.logoText}>CastSide</span>
            <span className={styles.logoBadge}>AI</span>
          </div>

          <div className={styles.modeTabs}>
            <button
              className={[styles.modeTab, mode === 'regular' ? styles.modeTabActive : ''].join(' ')}
              onClick={() => setMode('regular')}
              id="btn-mode-regular"
            >
              Regular
            </button>
            <button
              className={[styles.modeTab, mode === 'enhanced' ? styles.modeTabActive : ''].join(' ')}
              onClick={() => setMode('enhanced')}
              id="btn-mode-enhanced"
            >
              ✨ Enhanced
            </button>
          </div>
        </div>

        <div className={styles.topbarRight}>
          {hasVideo && (
            <button
              className={styles.stopVideoBtn}
              onClick={handleStopVideo}
              id="btn-stop-video"
            >
              ⏹ Stop
            </button>
          )}
          <div className={styles.apiStatus}>
            <span className={[styles.statusDot, hasApiKey ? styles.statusConnected : ''].join(' ')} />
            <span className={styles.statusText}>{hasApiKey ? 'Gemini Connected' : 'No API Key'}</span>
          </div>
          <button
            className={styles.settingsBtn}
            onClick={() => setSettingsOpen(true)}
            id="btn-settings"
          >
            ⚙️ Settings
          </button>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <main className={[styles.layout, mode === 'enhanced' && !hasVideo ? styles.layoutEnhanced : ''].join(' ')}>

        {/* ── VIDEO MODE: full-width video with overlay ── */}
        {hasVideo ? (
          <div className={styles.videoMode}>
            <VideoDisplay
              mediaStream={previewStream}
              videoRef={videoRef}
              hasStreamUrlVideo={isVideoStream}
              isListening={isListening}
              source={source}
            />
          </div>
        ) : (
          /* ── AUDIO MODE: left panel + optional sidebar ── */
          <>
            <section className={styles.mainPanel}>
              {!hasApiKey && (
                <div className={styles.apiBanner}>
                  <span>⚠️</span>
                  <span>
                    Add your Gemini API key in{' '}
                    <button className={styles.bannerBtn} onClick={() => setSettingsOpen(true)}>Settings</button>
                    {' '}to enable AI personas.
                  </span>
                </div>
              )}

              <AudioSourcePanel
                source={source}
                onSourceChange={(s) => { stopListening(); setPreviewStream(null); setIsVideoStream(false); setSource(s); }}
                isListening={isListening}
                onToggleListening={handleToggleListening}
                micLevel={micLevel}
                recognitionError={recognitionError}
                transcriptionEngine={transcriptionEngine}
                streamAudioRef={streamAudioRef}
                onVideoStreamReady={setPreviewStream}
                onStreamUrlChange={handleStreamUrlChange}
              />

              <TranscriptPanel
                chunks={chunks}
                interimText={interimText}
                isListening={isListening}
                onClear={clearTranscript}
              />
            </section>
          </>
        )}
      </main>

      {/* ── Commentator Rail — enhanced mode only ── */}
      {mode === 'enhanced' && (
        <CommentatorRail personas={enabledPersonas} personaStates={personaStates} />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
