import Link from 'next/link';
import { Mic, Brain, Zap, Download, ArrowRight, Monitor } from 'lucide-react';
import styles from './landing.module.css';

export const metadata = {
  title: 'Podcommentators | AI Powered Live Commentary',
  description: 'Give your stream an AI cast. Live transcription and real-time AI commentators for your audio and video streams.',
};

export default function LandingPage() {
  return (
    <div className={styles.container}>
      {/* Animated Glowing Orbs Background */}
      <div className={styles.backgroundMesh}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.orb3} />
      </div>

      <main className={styles.content}>
        <div className={styles.badge}>
          <span className={styles.badgeNew}>NEW</span>
          Zero-Latency Live Vibe Check
        </div>

        <h1 className={styles.title}>
          Give Your Stream an AI Cast
        </h1>
        
        <p className={styles.subtitle}>
          Connect your microphone, camera, or stream URL and let tailored AI personas react live to everything you say in real-time. No backend required.
        </p>

        <div className={styles.ctaWrapper}>
          <div className={styles.ctaRow}>
            <a
              href="/download"
              className={styles.downloadBtn}
              id="btn-download-app"
            >
              <Download size={18} />
              <span>Download for Mac</span>
            </a>
            <Link
              href="/app"
              className={styles.webBtn}
              id="btn-continue-web"
            >
              <Monitor size={16} />
              <span>Continue on Web</span>
              <ArrowRight size={14} className={styles.webBtnArrow} />
            </Link>
          </div>
          <p className={styles.ctaNote}>
            macOS 13+ &nbsp;·&nbsp; Free desktop app &nbsp;·&nbsp; Screen-share safe
          </p>
        </div>

        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <Mic className={styles.featureIcon} size={24} color="#4F8EF7" />
            </div>
            <h3 className={styles.featureTitle}>Any Source</h3>
            <p className={styles.featureDesc}>
              Listen directly to your mic, grab your screen with audio, or hook into OBS Virtual Camera instantly.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <Brain className={styles.featureIcon} size={24} color="#A78BFA" />
            </div>
            <h3 className={styles.featureTitle}>Custom Personas</h3>
            <p className={styles.featureDesc}>
              Create your own panel of commentators. Adjust their personality, prompt, and token settings on the fly.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <Zap className={styles.featureIcon} size={24} color="#34D399" />
            </div>
            <h3 className={styles.featureTitle}>100% Client-Side</h3>
            <p className={styles.featureDesc}>
              Bring your own API keys. Everything runs securely in your browser with zero server latency or data collection.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
