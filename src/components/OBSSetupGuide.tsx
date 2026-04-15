'use client';
// src/components/OBSSetupGuide.tsx

import { useState } from 'react';
import styles from './OBSSetupGuide.module.css';

type Method = 'virtualcam' | 'hls';

function Code({ children }: { children: React.ReactNode }) {
  return <span className={styles.inlineCode}>{children}</span>;
}

export default function OBSSetupGuide() {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method>('virtualcam');

  return (
    <div className={styles.guide}>
      <button
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.triggerIcon}>{open ? '▾' : '▸'}</span>
        How to connect OBS / streaming software
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.methodTabs}>
            <button
              className={[styles.methodTab, method === 'virtualcam' ? styles.methodActive : ''].join(' ')}
              onClick={() => setMethod('virtualcam')}
            >
              📷 Virtual Camera <span className={styles.recommended}>Easiest</span>
            </button>
            <button
              className={[styles.methodTab, method === 'hls' ? styles.methodActive : ''].join(' ')}
              onClick={() => setMethod('hls')}
            >
              📡 Local HLS Stream <span className={styles.recommended}>Best quality</span>
            </button>
          </div>

          {method === 'virtualcam' && (
            <div className={styles.steps}>
              <p className={styles.intro}>
                OBS has a built-in <strong>Virtual Camera</strong> that makes your stream look like a
                webcam to any browser. Zero extra software needed.
              </p>

              <ol className={styles.stepList}>
                <li>
                  <span className={styles.stepNum}>1</span>
                  <div>
                    <strong>In OBS:</strong> Go to{' '}
                    <Code>Tools → Virtual Camera → Start Virtual Camera</Code>.
                    (OBS 26+ has this built in.)
                  </div>
                </li>
                <li>
                  <span className={styles.stepNum}>2</span>
                  <div>
                    <strong>In CastSide:</strong> Click the <strong>📷 Camera</strong> tab above and
                    hit <strong>Start Camera</strong>. Select <em>OBS Virtual Camera</em> when the
                    browser asks which camera to use.
                  </div>
                </li>
                <li>
                  <span className={styles.stepNum}>3</span>
                  <div>
                    <strong>For audio</strong> (OBS Virtual Camera carries video only): route OBS
                    audio to a virtual mic input.
                  </div>
                  <div className={styles.platformSplit}>
                    <div className={styles.platform}>
                      <span className={styles.osLabel}>🍎 macOS</span>
                      Install{' '}
                      <a href="https://existential.audio/blackhole/" target="_blank" rel="noopener noreferrer">
                        BlackHole
                      </a>
                      . In OBS Audio Settings, add BlackHole as a Monitoring Device and turn on{' '}
                      <em>Monitor and Output</em> for your audio sources. Then select BlackHole as
                      your Microphone in the browser permission popup.
                    </div>
                    <div className={styles.platform}>
                      <span className={styles.osLabel}>🪟 Windows</span>
                      Install{' '}
                      <a href="https://vb-audio.com/Cable/" target="_blank" rel="noopener noreferrer">
                        VB-Audio Cable
                      </a>
                      . In OBS, go to <em>Advanced Audio Settings</em>, set sources to{' '}
                      <em>Monitor and Output</em>, set Monitoring Device to VB-Audio Cable Output.
                      Select that cable as your mic in the browser.
                    </div>
                  </div>
                </li>
              </ol>

              <div className={styles.tip}>
                💡 <strong>Tip:</strong> Speech recognition works best with mono audio. In OBS,
                set your audio sample rate to 44.1 kHz.
              </div>
            </div>
          )}

          {method === 'hls' && (
            <div className={styles.steps}>
              <p className={styles.intro}>
                Run a tiny local media server that accepts OBS RTMP and serves it as HLS. Paste the
                URL into the <strong>📡 Stream URL</strong> tab — full audio + video, no virtual
                cable needed.
              </p>

              <ol className={styles.stepList}>
                <li>
                  <span className={styles.stepNum}>1</span>
                  <div>
                    <strong>MediaMTX is already installed</strong> via Homebrew. Start it:
                    <div className={styles.codeBlock}>
                      {'brew services start mediamtx\n'}
                      <span className={styles.codeComment}>{'# or run directly:\nmediamtx'}</span>
                    </div>
                    HLS will be available on port <Code>8888</Code>, RTMP on <Code>1935</Code>.
                  </div>
                </li>
                <li>
                  <span className={styles.stepNum}>2</span>
                  <div>
                    <strong>In OBS</strong> → <em>Settings → Stream</em>:
                    <div className={styles.codeBlock}>
                      {'Service: Custom\n'}
                      {'Server:  '}
                      <span className={styles.codeHighlight}>rtmp://127.0.0.1/mystream</span>
                      {'\nStream Key: (leave blank)'}
                    </div>
                    Click <strong>Start Streaming</strong> in OBS.
                  </div>
                </li>
                <li>
                  <span className={styles.stepNum}>3</span>
                  <div>
                    <strong>In CastSide</strong>, go to the <strong>📡 Stream URL</strong> tab and paste:
                    <div className={[styles.codeBlock, styles.codeUrl].join(' ')}>
                      http://localhost:8888/mystream/index.m3u8
                    </div>
                    Click <strong>Load</strong>, then <strong>Start Transcribing</strong>.
                  </div>
                </li>
              </ol>

              <div className={styles.tip}>
                💡 <strong>Note:</strong> HLS has ~3–6 s of latency vs the live feed. AI commentary
                still syncs well since it reacts to spoken words, not frames.
              </div>

              <div className={styles.altServers}>
                <strong>Alternative local servers:</strong>
                <ul>
                  <li>
                    <a href="https://github.com/illuspas/Node-Media-Server" target="_blank" rel="noopener noreferrer">
                      Node-Media-Server
                    </a>{' '}— npm-based, easy install
                  </li>
                  <li>
                    <a href="https://ffmpeg.org" target="_blank" rel="noopener noreferrer">FFmpeg</a>
                    {' '}— pipe RTMP → HLS with a single command
                  </li>
                  <li>
                    <a href="https://nginx.org/en/docs/ngx_http_flv_module.html" target="_blank" rel="noopener noreferrer">
                      nginx-rtmp
                    </a>{' '}— if you already use nginx
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
