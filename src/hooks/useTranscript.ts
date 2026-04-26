'use client';
// src/hooks/useTranscript.ts
//
// TRANSCRIPTION STRATEGY (priority order):
//
// 1. ElevenLabs (when elevenLabsKey is set) — MediaRecorder → ElevenLabs API
//    - Most accurate, works on any browser
//    - ~3-second chunk latency
//
// 2. Web Speech API fallback (when no elevenLabsKey) — Chrome/Edge only, free
//    - Sends audio directly to Google's cloud speech servers
//    - Only works for mic source (no stream/screen support)
//
// Stream URL and Screen Capture modes require an ElevenLabs key.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioSource, TranscriptChunk } from '@/types';
import { transcribeWithElevenLabs } from '@/lib/elevenlabs';

// ── Web Speech API types ───────────────────────────────────────────────────
declare global {
  interface Window {
    webkitSpeechRecognition: new () => ISpeechRecognition;
    SpeechRecognition: new () => ISpeechRecognition;
  }
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

const FATAL_SPEECH_ERRORS = new Set([
  'not-allowed', 'service-not-allowed', 'audio-capture',
]);

const SPEECH_ERROR_MESSAGES: Record<string, string> = {
  'network': 'Web Speech API couldn\'t reach Google\'s servers. Add an ElevenLabs API key in Settings for reliable transcription.',
  'not-allowed': 'Microphone access denied. Click the padlock icon in your browser\'s address bar and allow microphone access.',
  'audio-capture': 'No microphone found. Plug in a mic or check System Settings → Sound.',
  'no-speech': 'No speech detected.',
  'service-not-allowed': 'Your browser blocked the speech service.',
};

interface UseTranscriptOptions {
  source: AudioSource;
  streamAudioRef?: React.RefObject<HTMLAudioElement | null>;
  apiKey: string;
  elevenLabsKey: string;
  onChunkCommitted: (chunk: string, allChunks: TranscriptChunk[]) => void;
  onPreviewStreamReady?: (stream: MediaStream | null) => void;
  /** deviceId of the preferred microphone input (from enumerateDevices) */
  micDeviceId?: string;
}

interface UseTranscriptReturn {
  chunks: TranscriptChunk[];
  interimText: string;
  isListening: boolean;
  recognitionError: string | null;
  transcriptionEngine: 'elevenlabs' | 'webspeech' | 'none';
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  micLevel: number;
}


export function useTranscript({
  source,
  streamAudioRef,
  apiKey: _apiKey,
  elevenLabsKey,
  onChunkCommitted,
  onPreviewStreamReady,
  micDeviceId,
}: UseTranscriptOptions): UseTranscriptReturn {
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const chunksRef = useRef<TranscriptChunk[]>([]);
  const fatalErrorRef = useRef(false);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const stopListeningRef = useRef<() => void>(() => {});

  // Engine: ElevenLabs > Web Speech (for mic only)
  const transcriptionEngine: UseTranscriptReturn['transcriptionEngine'] =
    isListening
      ? (elevenLabsKey ? 'elevenlabs' : (source === 'mic' || source === 'system-audio' ? 'webspeech' : 'none'))
      : 'none';

  useEffect(() => { chunksRef.current = chunks; }, [chunks]);

  // ── Mic-level monitor ───────────────────────────────────────────────────
  const startMicLevelMonitor = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setMicLevel(avg / 255);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopMicLevelMonitor = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setMicLevel(0);
  }, []);

  // ── Commit a final chunk ────────────────────────────────────────────────
  const commitChunk = useCallback((text: string) => {
    if (!text.trim()) return;
    const chunk: TranscriptChunk = {
      id: `chunk-${crypto.randomUUID()}`,
      text: text.trim(),
      timestamp: Date.now(),
      isFinal: true,
    };
    setChunks((prev) => {
      const next = [...prev, chunk];
      chunksRef.current = next;
      onChunkCommitted(text.trim(), next);
      return next;
    });
  }, [onChunkCommitted]);

  // ── Strategy A: ElevenLabs chunked transcription (mic / camera) ─────────
  const startElevenLabsMicListening = useCallback(async () => {
    setRecognitionError(null);
    fatalErrorRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      activeStreamRef.current = stream;
      startMicLevelMonitor(stream);
    } catch (err) {
      const msg = (err as Error).message || String(err);
      setRecognitionError(`Microphone access failed: ${msg}`);
      setIsListening(false);
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg';

    const recorder = new MediaRecorder(stream, { mimeType });
    const audioChunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    recorder.onstop = async () => {
      if (fatalErrorRef.current) return;

      // Snapshot and clear chunks, then restart IMMEDIATELY to avoid audio gaps
      const pending = [...audioChunks];
      audioChunks.length = 0;
      if (!fatalErrorRef.current && mediaRecorderRef.current === recorder) {
        try { recorder.start(); } catch { /* stopped */ }
      }

      if (pending.length === 0) return;
      const blob = new Blob(pending, { type: mimeType });

      try {
        const text = await transcribeWithElevenLabs(blob, elevenLabsKey);
        const ignore = ['there is no speech.', '[silence]', '[music]', ''];
        if (text && !ignore.includes(text.toLowerCase().trim())) {
          commitChunk(text);
          setRecognitionError(null);
        }
      } catch (err) {
        if (!fatalErrorRef.current) {
          setRecognitionError(`Transcription error: ${(err as Error).message}`);
        }
      }
    };

    const slice = () => {
      if (fatalErrorRef.current) return;
      if (recorder.state === 'recording') {
        recorder.requestData();
        recorder.stop();
      }
    };

    const interval = setInterval(slice, 3000);
    (recorder as MediaRecorder & { _interval?: ReturnType<typeof setInterval> })._interval = interval;

    recorder.start();
    mediaRecorderRef.current = recorder;
  }, [elevenLabsKey, commitChunk, startMicLevelMonitor]);

  // ── Strategy B: Web Speech API (mic only, no key required) ─────────────
  const startWebSpeechListening = useCallback(async () => {
    const SpeechRecognitionCtor: (new () => ISpeechRecognition) | undefined =
      window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setRecognitionError(
        'Speech recognition is not supported in this browser. Use Chrome or Edge, or add an ElevenLabs API key for reliable transcription.'
      );
      setIsListening(false);
      return;
    }

    setRecognitionError(null);
    fatalErrorRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      startMicLevelMonitor(stream);
    } catch (err) {
      setRecognitionError(`Microphone access failed: ${(err as Error).message}`);
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognitionCtor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (event: ISpeechRecognitionEvent) => {
      setRecognitionError(null);
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          commitChunk(result[0].transcript);
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    rec.onerror = (event: { error: string }) => {
      const { error } = event;
      const msg = SPEECH_ERROR_MESSAGES[error] ?? `Speech error: "${error}"`;
      setRecognitionError(msg);
      if (FATAL_SPEECH_ERRORS.has(error)) {
        fatalErrorRef.current = true;
        recognitionRef.current = null;
        setIsListening(false);
        stopMicLevelMonitor();
      }
    };

    rec.onend = () => {
      if (fatalErrorRef.current) return;
      if (recognitionRef.current === rec) {
        try { rec.start(); } catch { /* already stopped */ }
      }
    };

    rec.start();
    recognitionRef.current = rec;
  }, [commitChunk, startMicLevelMonitor, stopMicLevelMonitor]);

  // ── Strategy C: Stream URL → ElevenLabs transcription ───────────────────
  const startStreamListening = useCallback(async () => {
    const audioEl = streamAudioRef?.current;
    if (!audioEl) {
      setRecognitionError('No audio loaded. Paste a stream URL and click Load first.');
      return;
    }
    if (!elevenLabsKey) {
      setRecognitionError('An ElevenLabs API key is required for stream transcription. Open Settings to add one.');
      return;
    }

    setRecognitionError(null);
    fatalErrorRef.current = false;

    try {
      const audioCtx = new AudioContext();
      const src = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      src.connect(dest);
      src.connect(audioCtx.destination);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(dest.stream, { mimeType });
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      recorder.onstop = async () => {
        const pending = [...audioChunks];
        audioChunks.length = 0;
        // Restart immediately to avoid audio gaps
        if (!fatalErrorRef.current && mediaRecorderRef.current === recorder) {
          try { recorder.start(); } catch { /* stopped */ }
        }
        if (pending.length === 0) return;
        const blob = new Blob(pending, { type: mimeType });
        try {
          const text = await transcribeWithElevenLabs(blob, elevenLabsKey);
          const ignore = ['there is no speech.', '[silence]', '[music]', ''];
          if (text && !ignore.includes(text.toLowerCase().trim())) commitChunk(text);
        } catch (err) {
          setRecognitionError(`Transcription error: ${(err as Error).message}`);
        }
      };

      const interval = setInterval(() => {
        if (recorder.state === 'recording') {
          recorder.requestData();
          recorder.stop();
        }
      }, 10000);

      recorder.start();
      mediaRecorderRef.current = recorder;
      (recorder as MediaRecorder & { _interval?: ReturnType<typeof setInterval> })._interval = interval;
    } catch (err) {
      setRecognitionError(`Could not capture stream audio: ${(err as Error).message}`);
    }
  }, [streamAudioRef, elevenLabsKey, commitChunk]);

  // ── Strategy D: Screen Capture → ElevenLabs transcription ───────────────
  const startScreenListening = useCallback(async () => {
    if (!elevenLabsKey) {
      setRecognitionError('An ElevenLabs API key is required for screen capture transcription. Open Settings to add one.');
      setIsListening(false);
      return;
    }

    setRecognitionError(null);
    fatalErrorRef.current = false;

    // ── Step 1: Get display media (intercepted by Electron to auto-select screen) ──
    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,  // simplified — let Electron's handler provide audio: 'loopback'
      });
    } catch (err) {
      setRecognitionError(`Screen capture cancelled or not permitted: ${(err as Error).message}`);
      setIsListening(false);
      return;
    }

    onPreviewStreamReady?.(screenStream);

    // Stop listening if the user ends screen share via Electron's stop button
    screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (!fatalErrorRef.current) stopListeningRef.current();
    });

    const screenAudioTracks = screenStream.getAudioTracks();
    console.log('[Audio] Screen stream audio tracks:', screenAudioTracks.length,
      screenAudioTracks.map(t => `${t.label} (enabled=${t.enabled}, readyState=${t.readyState})`));

    // ── Step 2: Get mic audio ──
    let micStream: MediaStream | null = null;
    try {
      // Build audio constraints — prefer the user-chosen device, fall back to default
      const audioConstraints: MediaTrackConstraints = micDeviceId
        ? { deviceId: { ideal: micDeviceId } }
        : { echoCancellation: true, noiseSuppression: true };

      micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false });
      console.log('[Audio] Mic stream tracks:', micStream.getAudioTracks().length,
        micStream.getAudioTracks().map(t => `${t.label} readyState=${t.readyState}`));
      activeStreamRef.current = micStream;
      startMicLevelMonitor(micStream);
    } catch (err) {
      const error = err as DOMException;
      console.warn('[Audio] Mic access denied:', error.name, error.message);

      // NotFoundError = specific device missing; retry with any available device
      if (error.name === 'NotFoundError') {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const inputs = devices.filter(d => d.kind === 'audioinput');
          console.log('[Audio] Available audio inputs:', inputs.map(d => `${d.label} (${d.deviceId})`));
          if (inputs.length > 0) {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: inputs[0].deviceId } },
              video: false,
            });
            console.log('[Audio] Fallback mic acquired:', micStream.getAudioTracks()[0]?.label);
            activeStreamRef.current = micStream;
            startMicLevelMonitor(micStream);
          }
        } catch (fallbackErr) {
          console.warn('[Audio] Fallback mic also failed:', fallbackErr);
        }
      }
    }

    // ── Step 3: Choose recording source ──
    // Priority: system audio + mic mix > mic only > error
    const hasSystemAudio = screenAudioTracks.length > 0 &&
      screenAudioTracks.some(t => t.readyState === 'live');
    const hasMic = !!micStream && micStream.getAudioTracks().some(t => t.readyState === 'live');

    console.log(`[Audio] hasSystemAudio=${hasSystemAudio}, hasMic=${hasMic}`);

    let recordingStream: MediaStream;

    if (hasSystemAudio || hasMic) {
      // Use AudioContext to mix sources
      const audioCtx = new AudioContext({ sampleRate: 44100 });
      // AudioContext in Electron/Chrome often starts suspended — must resume
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
        console.log('[Audio] AudioContext resumed from suspended state');
      }
      const dest = audioCtx.createMediaStreamDestination();

      if (hasSystemAudio) {
        audioCtx.createMediaStreamSource(new MediaStream(screenAudioTracks)).connect(dest);
        console.log('[Audio] Connected system audio to mixer');
      }
      if (hasMic) {
        audioCtx.createMediaStreamSource(micStream!).connect(dest);
        console.log('[Audio] Connected mic to mixer');
      }

      recordingStream = dest.stream;
    } else {
      // No audio at all
      setRecognitionError(
        'No audio available. Check that microphone and Screen Recording permissions are granted in System Settings.'
      );
      setIsListening(false);
      screenStream.getTracks().forEach(t => t.stop());
      return;
    }

    // ── Step 4: Start MediaRecorder ──
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg';

    console.log('[Audio] Starting MediaRecorder with mimeType:', mimeType,
      'stream tracks:', recordingStream.getAudioTracks().length);

    const recorder = new MediaRecorder(recordingStream, { mimeType });
    const audioChunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        console.log('[Audio] Got audio chunk:', e.data.size, 'bytes');
        audioChunks.push(e.data);
      }
    };

    recorder.onstop = async () => {
      if (fatalErrorRef.current) return;

      // Snapshot and clear chunks, then restart IMMEDIATELY to avoid audio gaps
      const pending = [...audioChunks];
      audioChunks.length = 0;
      if (!fatalErrorRef.current && mediaRecorderRef.current === recorder) {
        try { recorder.start(); } catch { /* stopped */ }
      }

      if (pending.length === 0) {
        console.warn('[Audio] recorder.onstop: no chunks — silence?');
        return;
      }
      const blob = new Blob(pending, { type: mimeType });
      console.log('[Audio] Sending', blob.size, 'bytes to ElevenLabs');

      try {
        const text = await transcribeWithElevenLabs(blob, elevenLabsKey);
        console.log('[Audio] Transcription result:', JSON.stringify(text));
        const ignore = ['there is no speech.', '[silence]', '[music]', ''];
        if (text && !ignore.includes(text.toLowerCase().trim())) {
          commitChunk(text);
          setRecognitionError(null);
        }
      } catch (err) {
        if (!fatalErrorRef.current) {
          setRecognitionError(`Transcription error: ${(err as Error).message}`);
        }
      }
    };

    const slice = () => {
      if (fatalErrorRef.current) return;
      if (recorder.state === 'recording') {
        recorder.requestData();
        recorder.stop();
      }
    };

    const interval = setInterval(slice, 3000);
    (recorder as MediaRecorder & { _interval?: ReturnType<typeof setInterval> })._interval = interval;
    (recorder as MediaRecorder & { _screenStream?: MediaStream })._screenStream = screenStream;

    recorder.start();
    mediaRecorderRef.current = recorder;
    console.log('[Audio] MediaRecorder started, state:', recorder.state);
  }, [elevenLabsKey, micDeviceId, commitChunk, onPreviewStreamReady, startMicLevelMonitor]);

  // ── Strategy E: Electron system-audio capture (all computer audio) ─────────
  // Uses desktopCapturer via the Electron preload bridge to capture all system
  // audio without needing a virtual audio device. Requires Screen Recording
  // permission granted in macOS System Settings.
  const startSystemAudioListening = useCallback(async () => {
    const api = window.electronAPI;
    if (!api || !('getAudioSources' in api)) {
      setRecognitionError('System audio capture requires the desktop app. Download it or use Screen Capture mode in the browser.');
      setIsListening(false);
      return;
    }
    if (!elevenLabsKey) {
      setRecognitionError('An ElevenLabs API key is required for system audio transcription. Open Settings to add one.');
      setIsListening(false);
      return;
    }

    setRecognitionError(null);
    fatalErrorRef.current = false;

    // Ask the main process for available desktop sources
    let sources: Array<{ id: string; name: string }>;
    try {
      sources = await (api as { getAudioSources: () => Promise<Array<{ id: string; name: string }>> }).getAudioSources();
    } catch (err) {
      setRecognitionError(`Could not enumerate audio sources: ${(err as Error).message}`);
      setIsListening(false);
      return;
    }

    // Prefer a source named "Entire Screen" or fall back to first screen source
    const screenSource =
      sources.find((s) => s.name.toLowerCase().includes('entire screen')) ??
      sources.find((s) => s.id.startsWith('screen:')) ??
      sources[0];

    if (!screenSource) {
      setRecognitionError('No screen source found for system audio capture.');
      setIsListening(false);
      return;
    }

    // Build constraints using the Electron preload helper
    const constraints = (api as { getSystemAudioConstraints: (id: string) => MediaStreamConstraints }).getSystemAudioConstraints(screenSource.id);

    let systemStream: MediaStream;
    try {
      systemStream = await navigator.mediaDevices.getUserMedia(constraints);
      activeStreamRef.current = systemStream;
      startMicLevelMonitor(systemStream);
    } catch (err) {
      setRecognitionError(
        `System audio access failed: ${(err as Error).message}. ` +
        'Grant Screen Recording permission in System Settings → Privacy & Security.'
      );
      setIsListening(false);
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg';

    const recorder = new MediaRecorder(systemStream, { mimeType });
    const audioChunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    recorder.onstop = async () => {
      if (fatalErrorRef.current) return;

      // Snapshot and clear chunks, then restart IMMEDIATELY to avoid audio gaps
      const pending = [...audioChunks];
      audioChunks.length = 0;
      if (!fatalErrorRef.current && mediaRecorderRef.current === recorder) {
        try { recorder.start(); } catch { /* stopped */ }
      }

      if (pending.length === 0) return;
      const blob = new Blob(pending, { type: mimeType });

      try {
        const text = await transcribeWithElevenLabs(blob, elevenLabsKey);
        const ignore = ['there is no speech.', '[silence]', '[music]', ''];
        if (text && !ignore.includes(text.toLowerCase().trim())) {
          commitChunk(text);
          setRecognitionError(null);
        }
      } catch (err) {
        if (!fatalErrorRef.current) {
          setRecognitionError(`Transcription error: ${(err as Error).message}`);
        }
      }
    };

    const slice = () => {
      if (fatalErrorRef.current) return;
      if (recorder.state === 'recording') {
        recorder.requestData();
        recorder.stop();
      }
    };

    const interval = setInterval(slice, 3000);
    (recorder as MediaRecorder & { _interval?: ReturnType<typeof setInterval> })._interval = interval;
    recorder.start();
    mediaRecorderRef.current = recorder;
  }, [elevenLabsKey, commitChunk, startMicLevelMonitor]);

  // ── Public API ──────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    setIsListening(true);
    setRecognitionError(null);

    if (source === 'stream') {
      startStreamListening();
    } else if (source === 'screen') {
      startScreenListening();
    } else if (source === 'system-audio') {
      startSystemAudioListening();
    } else if (elevenLabsKey) {
      // ElevenLabs chunked transcription — most accurate
      startElevenLabsMicListening();
    } else {
      // Fallback: Web Speech API (free, Chrome/Edge only)
      startWebSpeechListening();
    }
  }, [source, elevenLabsKey, startElevenLabsMicListening, startWebSpeechListening, startStreamListening, startScreenListening, startSystemAudioListening]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    setInterimText('');
    fatalErrorRef.current = true;
    onPreviewStreamReady?.(null);

    // Stop Web Speech
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      try { rec.stop(); } catch { /* ignore */ }
    }

    // Stop MediaRecorder
    const recorder = mediaRecorderRef.current as (MediaRecorder & {
      _interval?: ReturnType<typeof setInterval>;
      _screenStream?: MediaStream;
    }) | null;

    if (recorder) {
      clearInterval(recorder._interval);
      recorder._screenStream?.getTracks().forEach((t) => t.stop());
      delete recorder._screenStream;
      try { recorder.stop(); } catch { /* ignore */ }
      mediaRecorderRef.current = null;
    }

    // Stop mic stream tracks
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop());
      activeStreamRef.current = null;
    }

    stopMicLevelMonitor();
  }, [onPreviewStreamReady, stopMicLevelMonitor]);

  const clearTranscript = useCallback(() => {
    setChunks([]);
    setInterimText('');
  }, []);

  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  useEffect(() => {
    return () => { stopListening(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    chunks,
    interimText,
    isListening,
    recognitionError,
    transcriptionEngine,
    startListening,
    stopListening,
    clearTranscript,
    micLevel,
  };
}
