'use client';
// src/hooks/useTranscript.ts
//
// TRANSCRIPTION STRATEGY (priority order):
//
// 1. Gemini Audio (when apiKey is set) — MediaRecorder → base64 chunks → Gemini API
//    - Reliable, works on any browser, doesn't touch Google Speech API
//    - ~5-second chunk latency inherent to chunked recording
//
// 2. Web Speech API fallback (when no apiKey) — Chrome-only, free
//    - Sends audio directly to Google's cloud speech servers
//    - Notorious "network" error when Chrome can't reach those servers
//
// Stream URL mode always uses Gemini (requires apiKey).

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioSource, TranscriptChunk } from '@/types';
import { transcribeWithGemini } from '@/lib/gemini';
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
  'network': 'Web Speech API couldn\'t reach Google\'s servers. Add a Gemini API key in Settings to use Gemini transcription instead (more reliable).',
  'not-allowed': 'Microphone access denied. Click the padlock icon in Chrome\'s address bar and allow microphone.',
  'audio-capture': 'No microphone found. Plug in a mic or check System Settings → Sound.',
  'no-speech': 'No speech detected.',
  'service-not-allowed': 'Chrome blocked the speech service.',
};

interface UseTranscriptOptions {
  source: AudioSource;
  streamAudioRef?: React.RefObject<HTMLAudioElement | null>;
  apiKey: string;
  elevenLabsKey: string;
  onChunkCommitted: (chunk: string, allChunks: TranscriptChunk[]) => void;
  onPreviewStreamReady?: (stream: MediaStream | null) => void;
}

interface UseTranscriptReturn {
  chunks: TranscriptChunk[];
  interimText: string;
  isListening: boolean;
  recognitionError: string | null;
  transcriptionEngine: 'elevenlabs' | 'gemini' | 'webspeech' | 'none';
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  micLevel: number;
}


export function useTranscript({
  source,
  streamAudioRef,
  apiKey,
  elevenLabsKey,
  onChunkCommitted,
  onPreviewStreamReady,
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
  // Stable ref so startScreenListening can call stop without a circular dep
  const stopListeningRef = useRef<() => void>(() => {});

  // Engine priority: ElevenLabs > Gemini > Web Speech
  const transcriptionEngine: UseTranscriptReturn['transcriptionEngine'] =
    isListening
      ? (elevenLabsKey ? 'elevenlabs' : apiKey ? 'gemini' : (source === 'stream' || source === 'screen' ? 'none' : 'webspeech'))
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

  // ── Strategy A: ElevenLabs / Gemini audio transcription (preferred) ─────
  // Picks ElevenLabs when its key is set, otherwise falls back to Gemini.
  // Uses MediaRecorder with 3-second chunks for low latency.
  const startGeminiMicListening = useCallback(async () => {
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
      if (audioChunks.length === 0) return;
      const blob = new Blob(audioChunks, { type: mimeType });
      audioChunks.length = 0;

      try {
        // ElevenLabs takes priority — it's significantly more accurate than Gemini
        const text = elevenLabsKey
          ? await transcribeWithElevenLabs(blob, elevenLabsKey)
          : await transcribeWithGemini(blob, apiKey);

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

      // Restart recording for continuous listening
      if (!fatalErrorRef.current && mediaRecorderRef.current === recorder) {
        try { recorder.start(); } catch { /* stopped */ }
      }
    };

    // 3-second chunks — lower latency than 5s, still enough audio for context
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
  }, [apiKey, elevenLabsKey, commitChunk, startMicLevelMonitor]);

  // ── Strategy B: Web Speech API fallback ────────────────────────────────
  const startWebSpeechListening = useCallback(async () => {
    const SpeechRecognitionCtor: (new () => ISpeechRecognition) | undefined =
      window.webkitSpeechRecognition || window.SpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setRecognitionError(
        'Speech recognition is not supported in this browser. Use Chrome/Edge, or add a Gemini API key for reliable transcription.'
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

  // ── Strategy C: Stream URL → ElevenLabs / Gemini transcription ────────────
  const startStreamListening = useCallback(async () => {
    const audioEl = streamAudioRef?.current;
    if (!audioEl) {
      setRecognitionError('No audio loaded. Paste a stream URL and click Load first.');
      return;
    }
    if (!elevenLabsKey && !apiKey) {
      setRecognitionError('An ElevenLabs or Gemini API key is required for stream transcription. Open Settings to add one.');
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
        if (audioChunks.length === 0) return;
        const blob = new Blob(audioChunks, { type: mimeType });
        audioChunks.length = 0;
        try {
          const text = elevenLabsKey
            ? await transcribeWithElevenLabs(blob, elevenLabsKey)
            : await transcribeWithGemini(blob, apiKey);
          const ignore = ['there is no speech.', '[silence]', '[music]', ''];
          if (text && !ignore.includes(text.toLowerCase().trim())) commitChunk(text);
        } catch (err) {
          setRecognitionError(`Transcription error: ${(err as Error).message}`);
        }
      };

      const interval = setInterval(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          recorder.start();
        }
      }, 4000);

      recorder.start();
      mediaRecorderRef.current = recorder;
      (recorder as MediaRecorder & { _interval?: ReturnType<typeof setInterval> })._interval = interval;
    } catch (err) {
      setRecognitionError(`Could not capture stream audio: ${(err as Error).message}`);
    }
  }, [streamAudioRef, apiKey, elevenLabsKey, commitChunk]);

  // ── Strategy D: Screen Capture (system audio + mic mixed) ────────────────
  // Uses getDisplayMedia for screen/system audio, getUserMedia for mic,
  // combines both via AudioContext, then chunks into 3s blobs for transcription.
  const startScreenListening = useCallback(async () => {
    if (!elevenLabsKey && !apiKey) {
      setRecognitionError('A Gemini or ElevenLabs API key is required for screen capture transcription. Open Settings to add one.');
      setIsListening(false);
      return;
    }

    setRecognitionError(null);
    fatalErrorRef.current = false;

    let screenStream: MediaStream;
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,   // required by most browsers even if we only want audio
        audio: {       // system/tab audio — user must tick "Share system audio" in the picker
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 44100,
        },
      });
    } catch (err) {
      setRecognitionError(`Screen capture cancelled or not permitted: ${(err as Error).message}`);
      setIsListening(false);
      return;
    }

    onPreviewStreamReady?.(screenStream);

    // If the user ends screen share via the browser's built-in stop button
    screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (!fatalErrorRef.current) stopListeningRef.current();
    });

    // Grab mic audio separately so we always have the host's voice
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      activeStreamRef.current = micStream;
      startMicLevelMonitor(micStream);
    } catch {
      // Mic access denied — continue with screen audio only
      console.warn('[Screen] Mic access denied — transcribing system audio only.');
    }

    // Mix screen audio + mic audio through AudioContext
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();

    const screenAudioTracks = screenStream.getAudioTracks();
    if (screenAudioTracks.length > 0) {
      const screenOnlyStream = new MediaStream(screenAudioTracks);
      audioCtx.createMediaStreamSource(screenOnlyStream).connect(dest);
    } else {
      console.warn('[Screen] No system audio track found — the user may not have ticked "Share system audio".');
    }

    if (micStream) {
      audioCtx.createMediaStreamSource(micStream).connect(dest);
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg';

    const recorder = new MediaRecorder(dest.stream, { mimeType });
    const audioChunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    recorder.onstop = async () => {
      if (fatalErrorRef.current) return;
      if (audioChunks.length === 0) return;
      const blob = new Blob(audioChunks, { type: mimeType });
      audioChunks.length = 0;

      try {
        const text = elevenLabsKey
          ? await transcribeWithElevenLabs(blob, elevenLabsKey)
          : await transcribeWithGemini(blob, apiKey);
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

      // Restart for continuous capture
      if (!fatalErrorRef.current && mediaRecorderRef.current === recorder) {
        try { recorder.start(); } catch { /* stopped */ }
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
    // Stash screen stream so stopListening() can close its tracks
    (recorder as MediaRecorder & { _screenStream?: MediaStream })._screenStream = screenStream;

    recorder.start();
    mediaRecorderRef.current = recorder;
  }, [apiKey, elevenLabsKey, commitChunk, onPreviewStreamReady, startMicLevelMonitor]);

  // ── Public API ──────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    setIsListening(true);
    setRecognitionError(null);

    if (source === 'stream') {
      startStreamListening();
    } else if (source === 'screen') {
      startScreenListening();
    } else if (elevenLabsKey || apiKey) {
      // ElevenLabs or Gemini chunked transcription (reliable, works on all browsers)
      startGeminiMicListening();
    } else {
      // Fallback to Web Speech API (free, Chrome only)
      startWebSpeechListening();
    }
  }, [source, elevenLabsKey, apiKey, startGeminiMicListening, startWebSpeechListening, startStreamListening, startScreenListening]);

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
