# CastSide

CastSide is a browser-based AI commentary companion for live audio and video. It can listen to your microphone, camera, screen share, or a local/remote stream URL, transcribe the audio in real time, and let a configurable cast of AI commentators react live in an overlay.

The app is built with Next.js, React, and TypeScript, and runs fully on the client. Your keys and commentator settings are stored in browser localStorage.

## What It Does

- Captures audio from:
  - microphone
  - camera
  - screen share
  - stream URL
- Shows video for:
  - camera
  - screen share
  - video stream URLs
- Transcribes live audio with:
  - ElevenLabs Scribe, if configured
  - Gemini audio transcription, if configured
  - Web Speech API fallback for basic mic-only browser support
- Streams live AI reactions from a configurable set of commentators
- Supports two viewing modes:
  - `Regular`: source + transcript only
  - `Enhanced`: source + transcript + commentator overlay
- Includes an in-app settings editor for commentator CRUD:
  - create
  - edit
  - duplicate
  - enable/disable
  - delete

## Current Status

CastSide is ready for local use and repo publishing.

Implemented:

- local Next.js app
- browser-based settings persistence
- editable commentators
- camera, screen, mic, and stream URL input modes
- focused video view with a header stop button
- OBS guidance for camera and local HLS workflows
- saved YouTube ingest settings in the UI

Not yet implemented:

- direct YouTube live publishing from the browser app itself

Why not: YouTube live publishing uses RTMP/RTMPS ingest, which requires an encoder or relay layer that this app does not currently provide.

## Requirements

- Node.js 18+ recommended
- npm
- Chrome or Edge recommended for the best media capture support

Optional accounts and keys:

- Gemini API key for AI commentary and Gemini transcription
- ElevenLabs API key for higher-quality transcription

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/castside.git
cd castside
npm install
npm run dev
```

Then open:

- [http://localhost:3000](http://localhost:3000)

## First Run Setup

1. Open the app in your browser.
2. Click `Settings`.
3. Add your API keys:
   - Gemini API key
   - ElevenLabs API key, optional
4. Save settings.
5. Choose a source and start listening.

## Source Modes

### Mic

Use your microphone or a virtual audio device as the input source.

Best for:

- quick testing
- podcasts routed into a virtual input
- voice-only sessions

### Camera

Uses `getUserMedia()` for live video plus audio capture.

Best for:

- webcam sessions
- OBS Virtual Camera workflows

Notes:

- the camera feed becomes the main video view
- when video is visible, the app switches to focused video mode
- click the header `Stop` button to return to the source/transcript screen

### Screen

Uses `getDisplayMedia()` for screen video and optional system audio, then mixes mic audio in separately.

Best for:

- presenting a browser tab or app window
- reacting to livestreams or desktop content
- capturing screen video in the main preview

Notes:

- for tab or system audio, the browser share dialog must include the audio-sharing option
- Firefox support for system audio is limited

### Stream URL

Loads a direct media URL and can show video if the URL points to a supported video stream or file.

Typical examples:

- `.m3u8`
- `.mp4`
- `.webm`
- `.mov`

## Focused Video Mode

When video is active through:

- camera
- screen share
- video stream URL

CastSide hides:

- the source panel
- the transcript panel

And shows:

- the video preview
- the commentator overlay in `Enhanced` mode
- a `Stop` button in the top header

Clicking `Stop` returns the app to the source/transcript screen.

## Regular vs Enhanced

### Regular

- source controls visible
- transcript visible
- commentators hidden

### Enhanced

- source controls visible when not in focused video mode
- transcript visible when not in focused video mode
- commentator overlay enabled

## AI Commentators

Commentators are fully editable from `Settings`.

For each commentator you can change:

- name
- title
- icon
- accent color
- enabled/disabled state
- search grounding on/off
- cooldown
- temperature
- max tokens
- system prompt
- relevance prompt

Supported CRUD actions:

- add a new commentator
- edit an existing commentator
- duplicate a commentator
- delete a commentator

Settings are stored in localStorage per browser profile.

## API Keys and Privacy

Keys are stored locally in the browser via localStorage.

They are used for:

- Gemini requests directly from the client to Google
- ElevenLabs transcription requests directly from the client to ElevenLabs

There is no backend in this repo handling your secrets.

That is convenient for local use, but it also means:

- do not use this architecture for a public multi-user deployment without a backend
- browser users with access to the app can access their own stored keys in that browser profile

## OBS and Streaming Software

CastSide includes an OBS setup guide in the UI. There are two main workflows.

### OBS Virtual Camera

Use this when you want OBS output to appear as a webcam inside CastSide.

High-level flow:

1. Start `Virtual Camera` in OBS.
2. In CastSide, choose `Camera`.
3. Start camera and select `OBS Virtual Camera`.
4. Route audio separately with a virtual audio device if needed.

### Local HLS via MediaMTX

Use this when you want OBS to publish to a local RTMP server and CastSide to load the resulting HLS URL.

High-level flow:

1. Run MediaMTX locally.
2. Point OBS to the local RTMP endpoint.
3. Load the HLS URL in CastSide as a stream URL.

This is often the best local setup for full video + audio capture without relying on virtual camera behavior.

## YouTube Live

The settings screen includes fields for:

- YouTube ingest URL
- YouTube stream key

This currently helps you store your destination details and jump into YouTube Live Control Room, but CastSide does not yet push the stream to YouTube directly.

To support direct YouTube publishing, the project would need one of these:

- an OBS-based outbound workflow
- a local FFmpeg relay
- a backend or desktop helper that can encode and publish RTMP/RTMPS

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- `@google/genai`
- browser media APIs:
  - `getUserMedia`
  - `getDisplayMedia`
  - `MediaRecorder`
  - `Web Speech API`
  - `AudioContext`

## Project Structure

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
    page.module.css
  components/
    AudioSourcePanel.tsx
    CommentatorRail.tsx
    OBSSetupGuide.tsx
    SettingsModal.tsx
    TranscriptPanel.tsx
    VideoDisplay.tsx
    WaveformCanvas.tsx
  context/
    SettingsContext.tsx
  hooks/
    usePersonaOrchestrator.ts
    useTranscript.ts
  lib/
    gemini.ts
    elevenlabs.ts
    personas.ts
    settings.ts
  prompts/
    ...
  types/
    index.ts
```

## Development Notes

### State Persistence

- app settings are stored in localStorage
- commentators are part of persisted settings
- settings updates are distributed through `useSyncExternalStore`

### Prompt System

Default commentator prompts are stored in:

- `src/prompts/*/system.md`
- `src/prompts/*/relevance.md`

Those defaults are copied into local settings and can then be edited in the UI.

### Browser-Centric Architecture

This project currently assumes:

- local development
- a trusted single user
- no backend secret management

If you want to deploy it publicly, the first things to add are:

- a server-side API layer
- secret storage
- auth
- rate limiting
- media publishing infrastructure

## Troubleshooting

### No video appears

- confirm the selected source is camera, screen, or a video stream URL
- confirm the browser permission prompt was approved
- for screen share, confirm you actually selected a screen/window/tab

### Screen share has no system audio

- enable the browser checkbox for tab/system audio during sharing
- prefer Chrome for the best support

### Transcript does not start

- confirm you added a Gemini or ElevenLabs key for screen/stream workflows
- confirm your browser has mic permission if the selected source needs mic input

### Commentators do not show

- switch the top mode toggle to `Enhanced`
- confirm at least one commentator is enabled in `Settings`
- confirm you have a Gemini API key configured

### Stream URL fails to load

- check that the URL is reachable from your browser
- verify the file extension or stream format is supported
- if using local HLS, confirm your local media server is actually running

