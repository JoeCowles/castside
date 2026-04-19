// src/app/download/page.tsx
// Download page — linked from the landing "Download for Mac" button.
// Provides the .dmg download and shows build instructions until a hosted build exists.

import Link from 'next/link';
import { Download, ArrowLeft, Terminal, Monitor, Mic } from 'lucide-react';

export const metadata = {
  title: 'Download Podcommentators — Desktop App for macOS',
  description: 'Download the Podcommentators desktop app for macOS. AI commentators that are invisible when you share your screen.',
};

export default function DownloadPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a14',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: '#c5c8e8',
      textAlign: 'center',
    }}>
      {/* Back link */}
      <Link
        href="/"
        style={{
          position: 'absolute',
          top: '32px',
          left: '32px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: '#6b7280',
          textDecoration: 'none',
          fontSize: '14px',
          transition: 'color 0.2s',
        }}
        id="btn-back-home"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      {/* Icon */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '24px',
        background: 'linear-gradient(135deg, #4F8EF7 0%, #7c5cfc 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '32px',
        boxShadow: '0 20px 40px rgba(124, 92, 252, 0.4)',
      }}>
        <Download size={36} color="white" />
      </div>

      <h1 style={{
        fontSize: 'clamp(32px, 5vw, 52px)',
        fontWeight: 800,
        background: 'linear-gradient(180deg, #ffffff 0%, #a1a5b8 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginBottom: '16px',
        letterSpacing: '-0.03em',
      }}>
        Podcommentators for Mac
      </h1>

      <p style={{ color: '#9299bc', fontSize: '18px', maxWidth: '500px', lineHeight: 1.6, marginBottom: '48px' }}>
        macOS 13+ &nbsp;·&nbsp; Apple Silicon &amp; Intel &nbsp;·&nbsp; Screen-share invisible
      </p>

      {/* Feature pills */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '48px' }}>
        {[
          { icon: <Monitor size={14} />, label: 'Invisible to Zoom & Meet' },
          { icon: <Mic size={14} />, label: 'All system audio capture' },
          { icon: <Terminal size={14} />, label: 'No virtual audio driver needed' },
        ].map((pill) => (
          <span key={pill.label} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '100px',
            fontSize: '13px',
            color: '#9299bc',
          }}>
            {pill.icon} {pill.label}
          </span>
        ))}
      </div>

      {/* Build instructions card */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '20px',
        padding: '32px',
        maxWidth: '600px',
        width: '100%',
        textAlign: 'left',
        marginBottom: '32px',
      }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e8eaf6', marginBottom: '16px' }}>
          Build from source
        </h2>
        <p style={{ fontSize: '14px', color: '#9299bc', marginBottom: '20px', lineHeight: 1.6 }}>
          A signed .dmg will be available here shortly. In the meantime you can run the desktop app locally in 3 commands:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            'git clone https://github.com/your-org/podcommentators',
            'cd podcommentators && npm install',
            'npm run electron:dev',
          ].map((cmd, i) => (
            <pre key={i} style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '13px',
              color: '#a5f3a0',
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              margin: 0,
              overflowX: 'auto',
            }}>
              {cmd}
            </pre>
          ))}
        </div>
      </div>

      <Link
        href="/app"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '14px 28px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '100px',
          color: '#6b7280',
          textDecoration: 'none',
          fontSize: '15px',
          transition: 'all 0.2s',
        }}
        id="btn-use-web-version"
      >
        Or continue on the web →
      </Link>
    </div>
  );
}
