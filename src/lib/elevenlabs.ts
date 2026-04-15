// src/lib/elevenlabs.ts
// ElevenLabs Scribe v2 - audio transcription.
//
// API reference: https://elevenlabs.io/docs/api-reference/speech-to-text/convert
// Model: scribe_v2 — best-in-class accuracy, supports 99 languages
// Auth:  xi-api-key header
//
// Usage: transcribeWithElevenLabs(audioBlob, apiKey) → Promise<string>

const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';

/**
 * Transcribe an audio blob using ElevenLabs Scribe v2.
 * Sends the blob as multipart/form-data.
 * Returns the plain-text transcript, or '' if the audio contained no speech.
 */
export async function transcribeWithElevenLabs(
  audioBlob: Blob,
  apiKey: string
): Promise<string> {
  if (!apiKey) throw new Error('No ElevenLabs API key set.');

  const formData = new FormData();
  // ElevenLabs accepts webm, ogg, mp4, m4a, wav, etc.
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model_id', 'scribe_v2');
  // Remove filler words and non-speech sounds for cleaner transcript
  formData.append('remove_background_noise', 'false');
  formData.append('tag_audio_events', 'false');

  const response = await fetch(ELEVENLABS_STT_URL, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`ElevenLabs STT error ${response.status}: ${err}`);
  }

  const data = await response.json();
  // Response shape: { text: string, words: [...], language_code: string }
  return (data.text ?? '').trim();
}
