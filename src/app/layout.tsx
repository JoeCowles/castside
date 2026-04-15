import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import { SettingsProvider } from '@/context/SettingsContext';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Space Grotesk via Google Fonts CDN (loaded in globals.css)
const metadata_description =
  'CastSide — Real-time AI commentary for any podcast or video stream, powered by five distinct AI personas.';

export const metadata: Metadata = {
  title: 'CastSide — AI Podcast & Video Companion',
  description: metadata_description,
  keywords: ['podcast', 'AI', 'real-time', 'transcription', 'commentary', 'video', 'streaming'],
  openGraph: {
    title: 'CastSide — AI Podcast & Video Companion',
    description: metadata_description,
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
