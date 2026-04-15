'use client';
// src/components/WaveformCanvas.tsx
// Canvas-based animated sine wave for each persona card.
// Smoothly transitions between idle / thinking / active states.

import { useEffect, useRef } from 'react';
import { WaveformState } from '@/types';

interface WaveformCanvasProps {
  state: WaveformState;
  color: string;
  width?: number;
  height?: number;
  className?: string;
}

interface AnimState {
  amplitude: number;
  targetAmp: number;
  speed: number;
  targetSpeed: number;
  opacity: number;
  targetOpacity: number;
  glowBlur: number;
  targetGlow: number;
  phase: number;
  phase2: number;
  jitterTimer: number;
  jitterDelta: number;
  running: boolean;
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export default function WaveformCanvas({
  state,
  color,
  width = 260,
  height = 52,
  className,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<AnimState>({
    amplitude: 3, targetAmp: 3,
    speed: 0.012, targetSpeed: 0.012,
    opacity: 0.35, targetOpacity: 0.35,
    glowBlur: 0, targetGlow: 0,
    phase: 0, phase2: Math.PI,
    jitterTimer: 0, jitterDelta: 0,
    running: true,
  });

  // Update targets when state changes
  useEffect(() => {
    const a = animRef.current;
    switch (state) {
      case 'idle':
        a.targetAmp = 3; a.targetSpeed = 0.012; a.targetOpacity = 0.35; a.targetGlow = 0;
        break;
      case 'thinking':
        a.targetAmp = 8; a.targetSpeed = 0.025; a.targetOpacity = 0.6; a.targetGlow = 6;
        break;
      case 'active':
        a.targetAmp = 18 + Math.random() * 6;
        a.targetSpeed = 0.048 + Math.random() * 0.015;
        a.targetOpacity = 1.0;
        a.targetGlow = 18;
        break;
    }
  }, [state]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const a = animRef.current;
    a.running = true;

    const ease = (cur: number, tgt: number, f = 0.06) => cur + (tgt - cur) * f;
    const rgb = hexToRgb(color);

    let raf: number;
    const loop = () => {
      if (!a.running) return;

      // Smooth transitions
      a.amplitude = ease(a.amplitude, a.targetAmp);
      a.speed = ease(a.speed, a.targetSpeed);
      a.opacity = ease(a.opacity, a.targetOpacity);
      a.glowBlur = ease(a.glowBlur, a.targetGlow);

      // Jitter in active state
      if (state === 'active') {
        a.jitterTimer++;
        if (a.jitterTimer % 8 === 0) a.jitterDelta = (Math.random() - 0.5) * 8;
        a.amplitude += a.jitterDelta * 0.1;
      }

      const amp = Math.max(1, a.amplitude);
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Primary wave
      ctx.save();
      ctx.shadowBlur = a.glowBlur;
      ctx.shadowColor = `rgba(${rgb},0.8)`;
      ctx.strokeStyle = `rgba(${rgb},${a.opacity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const y = h / 2
          + Math.sin(x * 0.035 + a.phase) * amp
          + Math.sin(x * 0.055 + a.phase * 1.4) * (amp * 0.4);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Secondary wave
      ctx.save();
      ctx.strokeStyle = `rgba(${rgb},${a.opacity * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= w; x++) {
        const y = h / 2
          + Math.sin(x * 0.04 + a.phase2) * (amp * 0.6)
          + Math.sin(x * 0.07 + a.phase2 * 0.9) * (amp * 0.25);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // Dotted center line when idle
      if (a.amplitude < 4) {
        ctx.save();
        ctx.strokeStyle = `rgba(${rgb},0.12)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.restore();
      }

      a.phase += a.speed;
      a.phase2 += a.speed * 0.7;

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      a.running = false;
      cancelAnimationFrame(raf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]); // only re-mount loop when color changes; state handled via animRef

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ display: 'block', width: '100%', height: `${height}px` }}
    />
  );
}
