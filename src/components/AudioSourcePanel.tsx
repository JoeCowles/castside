'use client';
// src/components/AudioSourcePanel.tsx
// Source selector: Microphone (audio only), Camera (audio+video), or Stream URL (audio or video).

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
  transcriptionEngine: 'elevenlabs' | 'gemini' | 'webspeech' | 'none';
  streamAudioRef: React.RefObject<HTMLAudioElement | null>;
  onVideoStreamReady: (stream: MediaStream | null) => void;
  onStreamUrlChange: (url: string, isVideo: boolean) => void;
}

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

  const StatusDot = ({ color }: { color: string }) => (
    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, marginRight: '6px', verticalAlign: 'middle', boxShadow: `0 0 8px ${color}80` }} />
  );

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

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.title}>Source</h2>
        <span className={styles.engineBadge}>
          {transcriptionEngine === 'elevenlabs' && <><StatusDot color="#34d399" /> ElevenLabs</>}
          {transcriptionEngine === 'gemini' && <><StatusDot color="#34d399" /> Gemini</>}
          {transcriptionEngine === 'webspeech' && <><StatusDot color="#60A5FA" /> Web Speech</>}
          {transcriptionEngine === 'none' && (
            (source === 'mic' || source === 'camera')
              ? <><StatusDot color="#F59E0B" /> No API Key</>
              : <><StatusDot color="#9CA3AF" /> Idle</>
          )}
        </span>
      </div>

      {/* Recognition error banner */}
      {recognitionError && (
        <div className={styles.errorBanner}>
          <AlertTriangle className={styles.errorIcon} size={20} />
          <div>
            <strong>Speech Error</strong>
            <p>{recognitionError}</p>
          </div>
        </div>
      )}

      {/* Source tabs */}
      <div className={styles.tabs}>
        <button
          className={[styles.tab, source === 'mic' ? styles.tabActive : ''].join(' ')}
          onClick={() => handleSourceChange('mic')}
          id="tab-mic"
        >
          <Mic size={16} /> Mic
        </button>
        <button
          className={[styles.tab, source === 'camera' ? styles.tabActive : ''].join(' ')}
          onClick={() => handleSourceChange('camera')}
          id="tab-camera"
        >
          <Camera size={16} /> Camera
        </button>
        <button
          className={[styles.tab, source === 'stream' ? styles.tabActive : ''].join(' ')}
          onClick={() => handleSourceChange('stream')}
          id="tab-stream"
        >
          <Radio size={16} /> Stream URL
        </button>
        <button
          className={[styles.tab, source === 'screen' ? styles.tabActive : ''].join(' ')}
          onClick={() => handleSourceChange('screen')}
          id="tab-screen"
        >
          <Monitor size={16} /> Screen
        </button>
      </div>

      {/* Mic panel */}
      {source === 'mic' && (
        <div className={styles.sourceBody}>
          <p className={styles.hint}>
            Capture audio from your microphone or any virtual audio cable.
          </p>
          <div className={styles.micRow}>
            <button
              className={[styles.listenBtn, isListening ? styles.listenBtnActive : ''].join(' ')}
              onClick={onToggleListening}
              id="btn-listen-mic"
            >
              {isListening ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              {isListening ? 'Stop' : 'Start Listening'}
            </button>
            <div className={styles.micBar}>
              <div className={styles.micBarFill} style={{ width: `${micLevel * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Camera panel */}
      {source === 'camera' && (
        <div className={styles.sourceBody}>
          <div className={styles.obsCallout}>
            <Video className={styles.obsIcon} size={24} />
            <div>
              <strong>OBS Virtual Camera</strong> — in OBS go to{' '}
              <code>Tools → Virtual Camera → Start Virtual Camera</code>, then click Start below
              and select <em>OBS Virtual Camera</em>.
            </div>
          </div>
          <p className={styles.hint}>
            Video appears as the main stream view. For audio transcription you&apos;ll also need a
            virtual audio cable (see setup guide below).
          </p>
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

      {/* Stream URL panel */}
      {source === 'stream' && (
        <div className={styles.sourceBody}>
          <div className={styles.obsCallout}>
            <Radio className={styles.obsIcon} size={24} />
            <div>
              <strong>OBS → Local HLS:</strong> Stream OBS to{' '}
              <code>rtmp://127.0.0.1/mystream</code> via MediaMTX, then paste{' '}
              <code>http://localhost:8888/mystream/index.m3u8</code> below.
            </div>
          </div>
          <p className={styles.hint}>
            Supports MP3, MP4, HLS (.m3u8), and most HTTP streams. Video streams display
            in the main view.
          </p>
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
          <audio
            ref={streamAudioRef as React.RefObject<HTMLAudioElement>}
            className={styles.hiddenAudio}
            id="audio-player"
          />
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

      {/* Screen capture panel */}
      {source === 'screen' && (
        <div className={styles.sourceBody}>
          <div className={styles.obsCallout}>
            <Monitor className={styles.obsIcon} size={24} />
            <div>
              <strong>Screen Capture</strong> — captures your screen&apos;s system audio plus your microphone and combines both for transcription.
              When the browser picker opens, make sure to tick{' '}
              <strong>Share system audio</strong> / <em>Share tab audio</em> to include
              what&apos;s playing on your device.
            </div>
          </div>
          <p className={styles.hint}>
            Works best in Chrome. Firefox does not support system audio capture.
            Your mic is always mixed in even if system audio is unavailable.
          </p>
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

      {/* ── OBS Setup Guide ── */}
      <div className={styles.guideWrap}>
        <OBSSetupGuide />
      </div>
    </div>
  );
}
