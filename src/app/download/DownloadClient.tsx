'use client';

import { useEffect, useState } from 'react';
import { Download, Monitor } from 'lucide-react';
import Link from 'next/link';

type ReleaseAsset = { name: string; browser_download_url: string };
type OS = 'mac' | 'win' | 'linux';

export default function DownloadClient() {
  const [links, setLinks] = useState<Record<OS, string | null>>({ mac: null, win: null, linux: null });
  const fallbackUrl = 'https://github.com/JoeCowles/castside/releases/latest';

  useEffect(() => {
    fetch('https://api.github.com/repos/JoeCowles/castside/releases/latest')
      .then(res => res.json())
      .then(data => {
        if (!data.assets) return;
        const newLinks = { mac: null, win: null, linux: null } as Record<OS, string | null>;
        data.assets.forEach((asset: ReleaseAsset) => {
          if (asset.name.endsWith('.dmg')) newLinks.mac = asset.browser_download_url;
          if (asset.name.endsWith('.exe')) newLinks.win = asset.browser_download_url;
          if (asset.name.endsWith('.AppImage')) newLinks.linux = asset.browser_download_url;
        });
        setLinks(newLinks);
      })
      .catch(console.error);
  }, []);

  const Button = ({ os, title, ext, icon }: { os: OS, title: string, ext: string, icon: React.ReactNode }) => {
    const url = links[os] || fallbackUrl;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '24px',
          width: '100%',
          maxWidth: '360px',
          textDecoration: 'none',
          color: '#e8eaf6',
          transition: 'all 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg, #2b304c 0%, #1a1d2e 100%)',
          borderRadius: '12px',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          {icon}
        </div>
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '18px', marginBottom: '4px' }}>{title}</div>
          <div style={{ color: '#9299bc', fontSize: '13px' }}>{ext} download</div>
        </div>
        <Download size={20} color="#7c5cfc" />
      </a>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%', marginBottom: '48px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center', width: '100%' }}>
        <Button os="mac" title="Download for macOS" ext=".dmg" icon={<Monitor size={24} color="#e8eaf6" />} />
        <Button os="win" title="Download for Windows" ext=".exe" icon={<Monitor size={24} color="#e8eaf6" />} />
        <Button os="linux" title="Download for Linux" ext=".AppImage" icon={<Monitor size={24} color="#e8eaf6" />} />
      </div>

      <div style={{ marginTop: '24px', opacity: 0.8 }}>
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#7c5cfc', fontSize: '14px', textDecoration: 'none' }}>
          View all versions &amp; release notes on GitHub →
        </a>
      </div>
    </div>
  );
}
