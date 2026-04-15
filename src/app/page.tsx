import Link from 'next/link';
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
          <Link href="/app" className={styles.ctaButton}>
            <span>Launch Podcommentators</span>
            <svg 
              className={styles.ctaIcon}
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <span className={styles.featureIcon}>🎙️</span>
            </div>
            <h3 className={styles.featureTitle}>Any Source</h3>
            <p className={styles.featureDesc}>
              Listen directly to your mic, grab your screen with audio, or hook into OBS Virtual Camera instantly.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <span className={styles.featureIcon}>🧠</span>
            </div>
            <h3 className={styles.featureTitle}>Custom Personas</h3>
            <p className={styles.featureDesc}>
              Create your own panel of commentators. Adjust their personality, prompt, and token settings on the fly.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIconWrapper}>
              <span className={styles.featureIcon}>⚡️</span>
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
