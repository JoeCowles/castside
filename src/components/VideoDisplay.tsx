'use client';
// src/components/VideoDisplay.tsx
// Shows a live camera feed (MediaStream) or a video stream URL.
// Persona commentary is handled globally by CommentatorRail (position: fixed overlay).

import { useEffect, useRef } from 'react';
import { Monitor, Camera, Radio } from 'lucide-react';
import styles from './VideoDisplay.module.css';

interface VideoDisplayProps {
  /** Live camera or screen-share MediaStream — takes priority over streamUrl */
  mediaStream: MediaStream | null;
  /** <video> element ref for stream URL playback */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Whether a stream URL video is loaded */
  hasStreamUrlVideo: boolean;
  /** Whether the session is live (shows LIVE dot) */
  isListening: boolean;
  /** Active source label for the live stream */
  source: 'camera' | 'screen' | 'stream' | 'mic';
}

export default function VideoDisplay({
  mediaStream,
  videoRef,
  hasStreamUrlVideo,
  isListening,
  source,
}: VideoDisplayProps) {
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  // Attach live media stream to <video>
  useEffect(() => {
    const videoEl = liveVideoRef.current;
    if (videoEl && mediaStream) {
      videoEl.srcObject = mediaStream;
      videoEl.play().catch(() => {/* autoplay blocked */});
    }
    return () => {
      if (videoEl) videoEl.srcObject = null;
    };
  }, [mediaStream]);

  const hasLiveStream = Boolean(mediaStream);
  const hasVideo = hasLiveStream || hasStreamUrlVideo;

  const getLabel = () => {
    if (source === 'screen') return <><Monitor size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} /> Screen</>;
    if (hasLiveStream) return <><Camera size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} /> Camera</>;
    return <><Radio size={14} style={{ display: 'inline-block', verticalAlign: 'text-bottom' }} /> Stream</>;
  };

  if (!hasVideo) return null;

  return (
    <div className={styles.videoWrapper}>
      {/* Camera feed */}
      {hasLiveStream && (
        <video
          ref={liveVideoRef}
          className={styles.video}
          muted
          playsInline
          autoPlay
        />
      )}

      {/* Stream URL video */}
      {!hasLiveStream && (
        <video
          ref={videoRef as React.RefObject<HTMLVideoElement>}
          className={styles.video}
          controls
          playsInline
        />
      )}

      {/* Overlay badge */}
      <div className={styles.badge}>
        {getLabel()}
        {isListening && <span className={styles.liveDot} />}
      </div>
    </div>
  );
}
