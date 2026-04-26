'use client';
// src/app/app/page.tsx
// podcommentators main page — orchestrates audio/video sources, transcript, and AI persona sidebar.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppMode, AudioSource, TranscriptHighlight } from '@/types';
import { useSettings } from '@/context/SettingsContext';
import { useTranscript } from '@/hooks/useTranscript';
import { usePersonaOrchestrator } from '@/hooks/usePersonaOrchestrator';
import AudioSourcePanel from '@/components/AudioSourcePanel';
import TranscriptPanel from '@/components/TranscriptPanel';
import CommentaryHistory from '@/components/CommentaryHistory';
import CommentatorRail from '@/components/CommentatorRail';
import VideoDisplay from '@/components/VideoDisplay';
import SettingsModal from '@/components/SettingsModal';
import { Mic, Sparkles, Square, Settings, AlertTriangle } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  const { settings } = useSettings();
  const [mode, setMode] = useState<AppMode>('enhanced');
  const [source, setSource] = useState<AudioSource>('mic');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);

  // Detect Electron context — must be done in useEffect to avoid SSR hydration mismatch
  const [isElectron, setIsElectron] = useState(false);
  const [isOverlay, setIsOverlay] = useState(false);
  useEffect(() => {
    setIsElectron(!!window.electronAPI?.isElectron);
    setIsOverlay(!!(window.electronAPI as { isOverlay?: boolean } | undefined)?.isOverlay);
  }, []);

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
  const { personaStates, commentaryHistory, onChunkCommitted } = usePersonaOrchestrator({
    personas: enabledPersonas,
    wordThreshold: settings.wordThreshold,
    apiKey: settings.apiKey,
    model: settings.model,
    onWaveformStateChange: handleWaveformChange,
  });

  // ── Broadcast persona states to overlay window (Electron only) ────────────
  useEffect(() => {
    if (!isElectron || isOverlay) return;
    const api = window.electronAPI;
    if (!api || !('sendPersonaStates' in api)) return;
    api.sendPersonaStates(enabledPersonas, personaStates);
  }, [personaStates, enabledPersonas, isElectron, isOverlay]);

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

  // Build transcript highlights from commentary that includes quoted statements
  const transcriptHighlights = useMemo<TranscriptHighlight[]>(
    () => commentaryHistory
      .filter((m) => m.quotedText)
      .map((m) => ({ text: m.quotedText, color: m.personaColor })),
    [commentaryHistory]
  );

  const hasApiKey = Boolean(settings.apiKey);
  const hasVideo = Boolean(previewStream) || isVideoStream;

  // Transcript is only shown in mic mode while actively listening
  const showTranscript = source === 'mic' && isListening;

  return (
    <div className={styles.app}>
      {/* ── Top Bar ── */}
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <div className={styles.logo}>
            <Mic className={styles.logoIcon} size={22} />
            <span className={styles.logoText}>podcommentators</span>
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
              <Sparkles size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> Enhanced
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
              <Square size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} fill="currentColor" /> Stop
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
            <Settings size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> Settings
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
          /* ── AUDIO MODE ── */
          <section className={styles.mainPanel}>
            {!hasApiKey && (
              <div className={styles.apiBanner}>
                <AlertTriangle size={16} />
                <span>
                  Add your Gemini API key in{' '}
                  <button className={styles.bannerBtn} onClick={() => setSettingsOpen(true)}>Settings</button>
                  {' '}to enable AI personas.
                </span>
              </div>
            )}

            <div className={[styles.contentArea, showTranscript ? styles.contentAreaWithTranscript : ''].join(' ')}>
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

              {showTranscript && (
                <div className={styles.transcriptArea}>
                  <TranscriptPanel
                    chunks={chunks}
                    interimText={interimText}
                    isListening={isListening}
                    onClear={clearTranscript}
                    commentaryCount={commentaryHistory.length}
                    onToggleCommentary={() => setShowCommentary((v) => !v)}
                    showingCommentary={showCommentary}
                    highlights={transcriptHighlights}
                  />
                  {showCommentary && (
                    <CommentaryHistory messages={commentaryHistory} />
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ── Commentator Rail — enhanced mode + not in Electron (it's in the overlay) ── */}
      {mode === 'enhanced' && !isElectron && (
        <CommentatorRail personas={enabledPersonas} personaStates={personaStates} />
      )}

      {/* ── In-app rail for Electron mode (fallback when overlay is unavailable) ── */}
      {mode === 'enhanced' && isElectron && (
        <CommentatorRail personas={enabledPersonas} personaStates={personaStates} />
      )}

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
