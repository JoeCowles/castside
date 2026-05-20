'use client';
// src/app/web/page.tsx
// Browser-based version of the app — no Electron required.
// When screen sharing is active, video fills the background with a draggable
// transcript panel on the left and commentator cards on the right.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import { useTranscript } from '@/hooks/useTranscript';
import { usePersonaOrchestrator } from '@/hooks/usePersonaOrchestrator';
import CommentatorRail from '@/components/CommentatorRail';
import SettingsModal from '@/components/SettingsModal';
import AgendaModal from '@/components/AgendaModal';
import AgendaTutorialHint from '@/components/AgendaTutorialHint';
import TopicTracker from '@/components/TopicTracker';
import CommentaryHistory from '@/components/CommentaryHistory';
import { Settings, Mic, MicOff, Monitor, MonitorOff, MessageSquare, ClipboardList } from 'lucide-react';
import type { CommentaryMessage } from '@/types';
import styles from './web.module.css';

export default function WebPage() {
  const { settings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [peekMessage, setPeekMessage] = useState<CommentaryMessage | null>(null);
  const [peekPos, setPeekPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showPeek = useCallback((msg: CommentaryMessage | null, pos?: { x: number; y: number }) => {
    if (peekTimerRef.current) { clearTimeout(peekTimerRef.current); peekTimerRef.current = null; }
    if (pos) setPeekPos(pos);
    setPeekMessage(msg);
  }, []);

  const hidePeekDelayed = useCallback(() => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => {
      setPeekMessage(null);
      peekTimerRef.current = null;
    }, 300);
  }, []);

  const cancelHidePeek = useCallback(() => {
    if (peekTimerRef.current) { clearTimeout(peekTimerRef.current); peekTimerRef.current = null; }
  }, []);
  const [showCommentary, setShowCommentary] = useState(false);
  const [includeScreenAudio, setIncludeScreenAudio] = useState(false);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const streamAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sidebar agenda/transcript split in screen-share mode (px from top of sidebar).
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const [agendaSplitPx, setAgendaSplitPx] = useState(260);
  const onSplitDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const sidebarRect = sidebar.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const next = ev.clientY - sidebarRect.top;
      // Keep both sections usable: agenda min 80px, transcript min 140px.
      const min = 80;
      const max = Math.max(min, sidebarRect.height - 140);
      setAgendaSplitPx(Math.min(max, Math.max(min, next)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // Mic device selection
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [micDeviceId, setMicDeviceId] = useState<string>('');

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      setAudioInputs(inputs);
      const preferred = inputs.find((d) => d.deviceId !== 'default' && d.deviceId !== 'communications') ?? inputs[0];
      if (preferred) setMicDeviceId(preferred.deviceId);
    }).catch(console.warn);
  }, []);

  const refreshDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const inputs = devices.filter((d) => d.kind === 'audioinput');
    setAudioInputs(inputs);
    if (inputs.length > 0 && !micDeviceId) {
      const preferred = inputs.find((d) => d.deviceId !== 'default') ?? inputs[0];
      setMicDeviceId(preferred.deviceId);
    }
  }, [micDeviceId]);

  const enabledPersonas = useMemo(
    () => settings.personas.filter((p) => p.enabled),
    [settings.personas]
  );

  const handleWaveformChange = useCallback(() => {}, []);

  const {
    personaStates,
    commentaryHistory,
    chunkHighlights,
    onChunkCommitted,
    agendaTopics,
    currentAgendaIndex,
    coveredAgendaIndices,
    currentSubtopicIndex,
    coveredSubtopicKeys,
    agendaParsing,
  } = usePersonaOrchestrator({
    personas: enabledPersonas,
    wordThreshold: settings.wordThreshold,
    apiKey: settings.apiKey,
    agenda: settings.agenda,
    onWaveformStateChange: handleWaveformChange,
  });

  const {
    chunks, interimText, isListening, startListening, stopListening,
    recognitionError, micLevel,
  } = useTranscript({
    source: includeScreenAudio ? 'screen' : 'mic',
    streamAudioRef,
    apiKey: settings.apiKey,
    elevenLabsKey: settings.elevenLabsKey,
    onChunkCommitted,
    onPreviewStreamReady: setPreviewStream,
    micDeviceId: micDeviceId || undefined,
  });

  // Attach screen stream to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  // Auto-scroll transcript
  const scrolledUp = useRef(false);
  useEffect(() => {
    if (!scrolledUp.current) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chunks, interimText]);

  const handleToggle = useCallback(async () => {
    if (isListening) {
      stopListening();
      previewStream?.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
      return;
    }
    await refreshDevices();
    startListening();
  }, [isListening, startListening, stopListening, refreshDevices, previewStream]);

  const hasApiKey = Boolean(settings.apiKey);
  const activeCount = Object.values(personaStates).filter(
    (s) => s.isStreaming || s.waveformState !== 'idle'
  ).length;
  const pulseScale = isListening ? 1 + micLevel * 0.1 : 1;
  const hasTranscript = chunks.length > 0 || !!interimText;
  const isScreenSharing = isListening && includeScreenAudio && !!previewStream;

  // Find the commentary message that triggered a given chunk highlight
  const findMessageForChunk = useCallback((chunkId: string): CommentaryMessage | null => {
    return commentaryHistory.findLast((m) => m.triggerChunkIds.includes(chunkId)) ?? null;
  }, [commentaryHistory]);

  // ── Screen-sharing layout: video bg + draggable transcript + commentator rail ──
  if (isScreenSharing) {
    return (
      <div className={styles.screenApp}>
        {/* Fullscreen video background */}
        <video
          ref={videoRef}
          className={styles.screenVideo}
          autoPlay
          muted
          playsInline
        />

        {/* Top control bar */}
        <header className={styles.screenTopbar}>
          <div className={styles.logo}>
            <Mic size={13} className={styles.logoIcon} />
            <span className={styles.logoText}>podcommentators</span>
          </div>
          <div className={styles.topRight}>
            <p className={styles.screenStatus}>
              {activeCount > 0
                ? `${activeCount} commentator${activeCount > 1 ? 's' : ''} responding`
                : 'Listening...'}
            </p>
            {/* Persona dots inline */}
            <div className={styles.screenDots}>
              {enabledPersonas.map((persona) => {
                const state = personaStates[persona.id];
                const isActive = state?.waveformState !== 'idle';
                return (
                  <span
                    key={persona.id}
                    className={[styles.dot, isActive ? styles.dotActive : ''].join(' ')}
                    style={{ '--color': persona.color, background: persona.color, opacity: isActive ? 1 : 0.25 } as React.CSSProperties}
                    title={persona.name}
                  />
                );
              })}
            </div>
            <button
              className={[styles.settingsBtn, settings.agenda ? styles.agendaBtnOn : ''].join(' ')}
              onClick={() => setAgendaOpen(true)}
              data-agenda-button
              title={settings.agenda ? `Agenda (${agendaTopics.length} topics)` : 'Add episode agenda'}
              aria-label="Episode agenda"
            >
              <ClipboardList size={15} />
            </button>
            <button className={styles.settingsBtn} onClick={() => setSettingsOpen(true)} aria-label="Settings">
              <Settings size={15} />
            </button>
          </div>
        </header>

        {/* Left sidebar — agenda (top) + draggable divider + transcript (below) */}
        <aside className={styles.screenSidebar} ref={sidebarRef}>
          {(agendaTopics.length > 0 || agendaParsing) && (
            <>
              <section
                className={[styles.sidebarSection, styles.sidebarAgendaSection].join(' ')}
                style={{ height: agendaSplitPx, flex: `0 0 ${agendaSplitPx}px` }}
              >
                <TopicTracker
                  topics={agendaTopics}
                  currentIndex={currentAgendaIndex}
                  coveredIndices={coveredAgendaIndices}
                  currentSubtopicIndex={currentSubtopicIndex}
                  coveredSubtopicKeys={coveredSubtopicKeys}
                  parsing={agendaParsing}
                  defaultExpanded
                  variant="flush"
                  onEdit={() => setAgendaOpen(true)}
                />
              </section>
              <div
                className={styles.sidebarDivider}
                onMouseDown={onSplitDragStart}
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize agenda and transcript"
              >
                <span className={styles.sidebarDividerGrip} />
              </div>
            </>
          )}

          <section className={[styles.sidebarSection, styles.sidebarTranscriptSection].join(' ')}>
            <div className={styles.sidebarSectionHeader}>
              <span className={styles.sidebarSectionTitle}>
                {showCommentary ? 'Commentary' : 'Transcript'}
              </span>
              <div className={styles.panelActions}>
                {commentaryHistory.length > 0 && (
                  <button
                    className={[styles.panelTab, showCommentary ? styles.panelTabActive : ''].join(' ')}
                    onClick={() => setShowCommentary((v) => !v)}
                  >
                    <MessageSquare size={11} />
                    {commentaryHistory.length}
                  </button>
                )}
                <button className={[styles.stopBtn, styles.panelStopBtn].join(' ')} onClick={handleToggle}>
                  <MicOff size={14} /> Stop
                </button>
              </div>
            </div>

            {showCommentary ? (
              <div className={styles.sidebarScroll}>
                <CommentaryHistory messages={commentaryHistory} />
              </div>
            ) : (
              <div
                className={styles.sidebarScroll}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  scrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 60;
                }}
              >
                {!hasTranscript && (
                  <p className={styles.panelPlaceholder}>Waiting for audio...</p>
                )}
                {chunks.map((chunk) => {
                  const hlColor = chunkHighlights[chunk.id];
                  return (
                    <p
                      key={chunk.id}
                      className={[styles.chunk, hlColor ? styles.chunkHighlighted : ''].join(' ')}
                      style={hlColor ? { color: hlColor, opacity: 1 } : undefined}
                      onMouseEnter={hlColor ? (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        showPeek(findMessageForChunk(chunk.id), { x: rect.right + 12, y: rect.top });
                      } : undefined}
                      onMouseLeave={hlColor ? hidePeekDelayed : undefined}
                    >
                      {chunk.text}
                    </p>
                  );
                })}
                {interimText && (
                  <p className={styles.interim}>{interimText}<span className={styles.cursor}>&#9611;</span></p>
                )}
                <div ref={transcriptEndRef} />
              </div>
            )}
          </section>
        </aside>

        {/* Commentator rail */}
        <CommentatorRail personas={enabledPersonas} personaStates={personaStates} />
        {peekMessage && (
          <div className={styles.peekTooltip} style={{ left: peekPos.x, top: peekPos.y }} onMouseEnter={cancelHidePeek} onMouseLeave={hidePeekDelayed}>
            <div className={styles.peekHeader} style={{ color: peekMessage.personaColor }}>
              {peekMessage.personaName} &middot; <span className={styles.peekRole}>{enabledPersonas.find(p => p.id === peekMessage.personaId)?.role}</span>
            </div>
            <p className={styles.peekText}>{peekMessage.text}</p>
            {peekMessage.citations.length > 0 && (
              <div className={styles.peekCitations}>
                {peekMessage.citations.slice(0, 3).map(c => {
                  let domain = '';
                  try { domain = new URL(c.uri).hostname.replace('www.', ''); } catch { domain = c.title || 'Source'; }
                  return <a key={c.uri} href={c.uri} target="_blank" rel="noopener noreferrer" className={styles.peekCitation}>{domain}</a>;
                })}
              </div>
            )}
          </div>
        )}
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <AgendaModal isOpen={agendaOpen} onClose={() => setAgendaOpen(false)} />
        {!settings.agenda && !agendaOpen && <AgendaTutorialHint />}
      </div>
    );
  }

  // ── Default layout: centered controls (no screen share) ──
  return (
    <div className={styles.app}>
      <div className={styles.bgMesh}>
        <div className={styles.orb1} />
        <div className={styles.orb2} />
      </div>

      <header className={styles.topbar}>
        <div className={styles.logo}>
          <Mic size={13} className={styles.logoIcon} />
          <span className={styles.logoText}>podcommentators</span>
        </div>
        <div className={styles.topRight}>
          <span
            className={[styles.apiDot, hasApiKey ? styles.apiDotOn : ''].join(' ')}
            title={hasApiKey ? 'Gemini connected' : 'No API key'}
          />
          <button
            className={[styles.settingsBtn, settings.agenda ? styles.agendaBtnOn : ''].join(' ')}
            onClick={() => setAgendaOpen(true)}
            data-agenda-button
            title={settings.agenda ? `Agenda (${agendaTopics.length} topics)` : 'Add episode agenda'}
            aria-label="Episode agenda"
          >
            <ClipboardList size={15} />
          </button>
          <button
            className={styles.settingsBtn}
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <p className={[styles.statusLabel, isListening ? styles.statusLabelActive : ''].join(' ')}>
          {isListening
            ? activeCount > 0 ? `${activeCount} commentator${activeCount > 1 ? 's' : ''} responding` : 'Listening...'
            : 'Ready'}
        </p>

        {/* Screen audio toggle */}
        <button
          className={[styles.screenToggle, includeScreenAudio ? styles.screenToggleActive : ''].join(' ')}
          onClick={() => { if (!isListening) setIncludeScreenAudio((v) => !v); }}
          disabled={isListening}
        >
          {includeScreenAudio ? <Monitor size={14} /> : <MonitorOff size={14} />}
          {includeScreenAudio ? 'Screen audio on' : 'Screen audio off'}
        </button>

        {/* Orb */}
        <button
          className={[styles.orb, isListening ? styles.orbActive : ''].join(' ')}
          style={{ transform: `scale(${pulseScale})` }}
          onClick={handleToggle}
          disabled={!hasApiKey}
        >
          <div className={styles.orbGlow} />
          <div className={styles.orbInner}>
            {isListening
              ? <MicOff size={20} className={styles.orbIcon} />
              : <Mic size={20} className={styles.orbIcon} />}
            <span className={styles.orbLabel}>
              {isListening ? 'Stop' : 'Start'}
            </span>
          </div>
        </button>

        {/* Mic device picker */}
        {audioInputs.length > 1 && (
          <div className={styles.micPickerRow}>
            <Mic size={11} className={styles.micPickerIcon} />
            <select
              className={styles.micPicker}
              value={micDeviceId}
              onChange={(e) => setMicDeviceId(e.target.value)}
              disabled={isListening}
              title="Select microphone input"
            >
              {audioInputs.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${audioInputs.indexOf(d) + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {recognitionError && <p className={styles.errorMsg}>{recognitionError}</p>}

        {!hasApiKey && (
          <p className={styles.nudge}>
            <button className={styles.nudgeBtn} onClick={() => setSettingsOpen(true)}>Open Settings</button>
            {' '}to add your Gemini API key
          </p>
        )}

        {(agendaTopics.length > 0 || agendaParsing) && (
          <div className={styles.agendaWrap}>
            <TopicTracker
              topics={agendaTopics}
              currentIndex={currentAgendaIndex}
              coveredIndices={coveredAgendaIndices}
              currentSubtopicIndex={currentSubtopicIndex}
              coveredSubtopicKeys={coveredSubtopicKeys}
              parsing={agendaParsing}
              defaultExpanded={!isListening}
              onEdit={() => setAgendaOpen(true)}
            />
          </div>
        )}

        {commentaryHistory.length > 0 && (
          <button
            className={[styles.chatToggle, showCommentary ? styles.chatToggleActive : ''].join(' ')}
            onClick={() => setShowCommentary((v) => !v)}
          >
            <MessageSquare size={13} />
            Chat{` (${commentaryHistory.length})`}
          </button>
        )}

        {showCommentary && (
          <div className={styles.commentaryArea}>
            <CommentaryHistory messages={commentaryHistory} />
          </div>
        )}

        {hasTranscript && !showCommentary && (
          <div
            className={styles.transcript}
            onScroll={(e) => {
              const el = e.currentTarget;
              scrolledUp.current = el.scrollHeight - el.scrollTop - el.clientHeight > 60;
            }}
          >
            {chunks.map((chunk) => {
              const hlColor = chunkHighlights[chunk.id];
              return (
                <p
                  key={chunk.id}
                  className={styles.chunk}
                  style={hlColor ? { color: hlColor, opacity: 1 } : undefined}
                >
                  {chunk.text}
                </p>
              );
            })}
            {interimText && (
              <p className={styles.interim}>{interimText}<span className={styles.cursor}>&#9611;</span></p>
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {isListening && !hasTranscript && !showCommentary && (
          <div className={styles.transcriptPlaceholder}>
            <div className={styles.listeningDots}><span /><span /><span /></div>
            <p>Waiting for audio...</p>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        {enabledPersonas.map((persona) => {
          const state = personaStates[persona.id];
          const isActive = state?.waveformState !== 'idle';
          return (
            <div key={persona.id} className={styles.personaDot} title={persona.name}>
              <span
                className={[styles.dot, isActive ? styles.dotActive : ''].join(' ')}
                style={{ '--color': persona.color, background: persona.color, opacity: isActive ? 1 : 0.25 } as React.CSSProperties}
              />
              <span className={styles.dotLabel} style={{ color: isActive ? persona.color : undefined }}>
                {persona.name}
              </span>
            </div>
          );
        })}
      </footer>

      <CommentatorRail personas={enabledPersonas} personaStates={personaStates} />
      {peekMessage && (
        <div className={styles.peekTooltip} style={{ left: peekPos.x, top: peekPos.y }}>
          <div className={styles.peekHeader} style={{ color: peekMessage.personaColor }}>
            {peekMessage.personaName} &middot; <span className={styles.peekRole}>{enabledPersonas.find(p => p.id === peekMessage.personaId)?.role}</span>
          </div>
          <p className={styles.peekText}>{peekMessage.text}</p>
          {peekMessage.citations.length > 0 && (
            <div className={styles.peekCitations}>
              {peekMessage.citations.slice(0, 3).map(c => {
                let domain = '';
                try { domain = new URL(c.uri).hostname.replace('www.', ''); } catch { domain = c.title || 'Source'; }
                return <a key={c.uri} href={c.uri} target="_blank" rel="noopener noreferrer" className={styles.peekCitation}>{domain}</a>;
              })}
            </div>
          )}
        </div>
      )}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AgendaModal isOpen={agendaOpen} onClose={() => setAgendaOpen(false)} />
      {!settings.agenda && !agendaOpen && <AgendaTutorialHint />}
    </div>
  );
}
