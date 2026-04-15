'use client';
// src/components/AudioSourcePanel.tsx

import { useState } from 'react';
import { AudioSource } from '@/types';
import { Mic, Camera, Radio, Monitor, Play, Square, AlertTriangle, Video } from 'lucide-react';
import OBSSetupGuide from './OBSSetupGuide';
import styles from './AudioSourcePanel.module.css';

interface AudioSourcePanelProps {
  source: AudioSource;
  onSourceChange: (s: AudioSource) => void;
  isListening: boolean;
  onToggleListening: () => void;
  micLevel: number;
  recognitionError: string | null;
  transcriptionEngine: 'elevenlabs' | 'webspeech' | 'none';
  streamAudioRef: React.RefObject<HTMLAudioElement | null>;
  onVideoStreamReady: (stream: MediaStream | null) => void;
  onStreamUrlChange: (url: string, isVideo: boolean) => void;
}

const SOURCES: { id: AudioSource; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'mic',    label: 'Microphone',  description: 'Capture from your mic or virtual audio cable', icon: <Mic size={28} /> },
  { id: 'camera', label: 'Camera',      description: 'Live camera + OBS Virtual Camera support',     icon: <Camera size={28} /> },
  { id: 'stream', label: 'Stream URL',  description: 'Load an HLS, MP4, or HTTP audio stream',       icon: <Radio size={28} /> },
  { id: 'screen', label: 'Screen',      description: 'Capture system audio and mic together',        icon: <Monitor size={28} /> },
];

export default function AudioSourcePanel({
  source,
  onSourceChange,
  isListening,
  onToggleListening,
  micLevel,
  recognitionError,
  transcriptionEngine,
  streamAudioRef,
  onVideoStreamReady,
  onStreamUrlChange,
}: AudioSourcePanelProps) {
  const [streamUrl, setStreamUrl] = useState('');
  const [streamLoaded, setStreamLoaded] = useState(false);
  const [streamError, setStreamError] = useState('');

  const handleSourceChange = (s: AudioSource) => {
    onVideoStreamReady(null);
    onSourceChange(s);
    setStreamLoaded(false);
    setStreamError('');
  };

  const handleLoadStream = () => {
    const el = streamAudioRef.current;
    if (!el || !streamUrl.trim()) return;
    setStreamError('');
    setStreamLoaded(false);

    const url = streamUrl.trim();
    el.src = url;
    el.load();
    el.oncanplay = () => setStreamLoaded(true);
    el.onerror = () => {
      setStreamError('Could not load stream. Check the URL and try again.');
      setStreamLoaded(false);
    };

    const isVideo = /\.(mp4|webm|mov|m3u8|ts)(\?|$)/i.test(url);
    onStreamUrlChange(url, isVideo);
  };

  const EngineLabel = () => {
    const dot = (color: string) => (
      <span className={styles.engineDot} style={{ background: color, boxShadow: `0 0 8px ${color}80` }} />
    );
    if (transcriptionEngine === 'elevenlabs') return <>{dot('#34d399')} ElevenLabs</>;
    if (transcriptionEngine === 'webspeech')  return <>{dot('#60A5FA')} Web Speech</>;
    if (source === 'mic' || source === 'camera') return <>{dot('#F59E0B')} No API Key</>;
    return <>{dot('#9CA3AF')} Idle</>;
  };

  return (
    <div className={styles.panel}>
      {/* Status row */}
      <div className={styles.statusRow}>
        <span className={styles.sectionLabel}>Input Source</span>
        <span className={styles.engineBadge}><EngineLabel /></span>
      </div>

      {/* Error banner */}
      {recognitionError && (
        <div className={styles.errorBanner}>
          <AlertTriangle className={styles.errorIcon} size={18} />
          <div>
            <strong>Speech Error</strong>
            <p>{recognitionError}</p>
          </div>
        </div>
      )}

      {/* Source card grid */}
      <div className={styles.sourceGrid}>
        {SOURCES.map((s) => {
          const active = source === s.id;
          return (
            <button
              key={s.id}
              className={[styles.sourceCard, active ? styles.sourceCardActive : ''].join(' ')}
              onClick={() => handleSourceChange(s.id)}
              id={`tab-${s.id}`}
            >
              <span className={styles.sourceIcon}>{s.icon}</span>
              <span className={styles.sourceLabel}>{s.label}</span>
              <span className={styles.sourceDesc}>{s.description}</span>
            </button>
          );
        })}
      </div>

      {/* ── Config panel for selected source ── */}

      {/* Mic */}
      {source === 'mic' && (
        <div className={styles.configPanel}>
          <div className={styles.micRow}>
            <button
              className={[styles.listenBtn, isListening ? styles.listenBtnActive : ''].join(' ')}
              onClick={onToggleListening}
              id="btn-listen-mic"
            >
              {isListening ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {isListening ? 'Stop Listening' : 'Start Listening'}
            </button>
            <div className={styles.micBar}>
              <div className={styles.micBarFill} style={{ width: `${micLevel * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Camera */}
      {source === 'camera' && (
        <div className={styles.configPanel}>
          <div className={styles.obsCallout}>
            <Video className={styles.obsIcon} size={20} />
            <div>
              <strong>OBS Virtual Camera</strong> — Go to <code>Tools → Virtual Camera → Start Virtual Camera</code>, then click Start and select <em>OBS Virtual Camera</em>.
            </div>
          </div>
          <div className={styles.micRow}>
            <button
              className={[styles.listenBtn, isListening ? styles.listenBtnActive : ''].join(' ')}
              onClick={onToggleListening}
              id="btn-listen-camera"
            >
              {isListening ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {isListening ? 'Stop Camera' : 'Start Camera'}
            </button>
            <div className={styles.micBar}>
              <div className={styles.micBarFill} style={{ width: `${micLevel * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Stream URL */}
      {source === 'stream' && (
        <div className={styles.configPanel}>
          <div className={styles.obsCallout}>
            <Radio className={styles.obsIcon} size={20} />
            <div>
              <strong>OBS → Local HLS:</strong> Stream to <code>rtmp://127.0.0.1/mystream</code> via MediaMTX, then paste <code>http://localhost:8888/mystream/index.m3u8</code> below.
            </div>
          </div>
          <div className={styles.urlRow}>
            <input
              type="url"
              className={styles.urlInput}
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="http://localhost:8888/mystream/index.m3u8"
              id="stream-url-input"
              onKeyDown={(e) => e.key === 'Enter' && handleLoadStream()}
            />
            <button className={styles.loadBtn} onClick={handleLoadStream} id="btn-load-stream">
              Load
            </button>
          </div>
          {streamError && <p className={styles.streamError}>{streamError}</p>}
          <audio ref={streamAudioRef as React.RefObject<HTMLAudioElement>} className={styles.hiddenAudio} id="audio-player" />
          {streamLoaded && (
            <button
              className={[styles.listenBtn, isListening ? styles.listenBtnActive : ''].join(' ')}
              onClick={onToggleListening}
              id="btn-listen-stream"
            >
              {isListening ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {isListening ? 'Stop Transcribing' : 'Start Transcribing'}
            </button>
          )}
        </div>
      )}

      {/* Screen */}
      {source === 'screen' && (
        <div className={styles.configPanel}>
          <div className={styles.obsCallout}>
            <Monitor className={styles.obsIcon} size={20} />
            <div>
              <strong>Screen Capture</strong> — When the browser picker opens, tick <strong>Share system audio</strong> to include audio playing on your device.
            </div>
          </div>
          <div className={styles.micRow}>
            <button
              className={[styles.listenBtn, isListening ? styles.listenBtnActive : ''].join(' ')}
              onClick={onToggleListening}
              id="btn-listen-screen"
            >
              {isListening ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {isListening ? 'Stop Capture' : 'Start Screen Capture'}
            </button>
            <div className={styles.micBar}>
              <div className={styles.micBarFill} style={{ width: `${micLevel * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* OBS Setup Guide */}
      <div className={styles.guideWrap}>
        <OBSSetupGuide />
      </div>
    </div>
  );
}
