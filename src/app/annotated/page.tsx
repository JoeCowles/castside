'use client';

import React, { useState } from 'react';
import './annotated.css';

/* ============================================================
   Shared Components
   ============================================================ */

function Scribble({
  children,
  color = 'var(--red-pencil)',
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span className="scribble-underline">
      {children}
      <svg
        viewBox="0 0 200 16"
        preserveAspectRatio="none"
        fill="none"
        style={{
          position: 'absolute',
          left: '-2%',
          right: '-2%',
          bottom: '-0.18em',
          width: '104%',
          height: '0.22em',
          color,
        }}
      >
        <path
          d="M 4 9 Q 22 6, 42 8 T 84 8.5 Q 110 9.5, 138 7.8 T 178 8.2 Q 188 8.5, 196 7.5"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function Avatar({
  name,
  color,
  size = 32,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const initial = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.42,
      }}
    >
      {initial}
    </span>
  );
}

/* ============================================================
   Site Header
   ============================================================ */

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a
          href="/annotated"
          style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/annotated/assets/logo-wordmark.svg"
            alt="Annotated"
            style={{ height: 26 }}
          />
        </a>
        <nav className="nav">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#demo">A piece, annotated</a>
          <a href="#voices">Voices</a>
        </nav>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <a
            href="/annotated/app"
            className="btn btn-quiet"
            style={{ textDecoration: 'none' }}
          >
            Sign in
          </a>
          <a
            href="/annotated/app"
            className="btn btn-primary"
            style={{ textDecoration: 'none' }}
          >
            Open Annotated →
          </a>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   Hero
   ============================================================ */

function LivePage() {
  return (
    <div style={{ position: 'relative', margin: '0 -56px', padding: 0 }}>
      {/* Left margin note */}
      <div
        className="margin-note"
        style={{
          top: 60,
          left: -120,
          transform: 'rotate(-3deg)',
          color: 'var(--red-pencil)',
          zIndex: 2,
          padding: 0,
        }}
      >
        the line of the year
        <span className="arrow">
          <svg
            viewBox="0 0 80 50"
            width="80"
            height="50"
            fill="none"
            style={{ color: 'var(--red-pencil)' }}
          >
            <path
              d="M 8 8 Q 30 6, 50 18 T 76 38"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M 76 38 L 66 36 M 76 38 L 70 46"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>

      {/* Right margin note */}
      <div
        className="margin-note"
        style={{
          bottom: 100,
          right: -120,
          transform: 'rotate(2deg)',
          color: 'var(--pencil-blue)',
          textAlign: 'left',
          zIndex: 2,
          padding: '0 0 0 4px',
        }}
      >
        cf. Sontag —
        <br />
        &ldquo;&hellip;the revenge of intellect.&rdquo;
      </div>

      <div className="live-page">
        <div className="source-eyebrow">
          <Avatar name="Maya Okonjo" color="var(--red-pencil)" size={20} />
          Maya · annotated 14 min ago
        </div>
        <h3>The slow web is still the better web</h3>
        <p>
          There is a particular feeling — call it{' '}
          <span className="hl-yellow">readerly attention</span> — that the
          early-2010s web used to invite. Long blog posts, RSS feeds, the
          assumption that an essay was a thing you finished.
        </p>
        <p>
          What replaced it isn&rsquo;t reading at all. It is{' '}
          <span className="underline-red">scrolling</span>, which is a related
          but lesser act. The eye moves; the mind doesn&rsquo;t always follow.
        </p>
        <p style={{ marginBottom: 0 }}>
          And yet — and{' '}
          <span className="hl-red">this is the part I keep coming back to</span>{' '}
          — the slow web hasn&rsquo;t gone anywhere. It just stopped being the
          default.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginTop: 22,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <Avatar name="Jules Park" color="var(--pencil-blue)" size={22} />
            <Avatar name="Theo Marsh" color="var(--sage)" size={22} />
            <Avatar name="Robin Chen" color="var(--ochre)" size={22} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--fg-secondary)',
            }}
          >
            Jules, Theo, and 4 others annotated this back
          </span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="section-inner">
        <div className="hero-grid">
          <div>
            <div
              className="eyebrow"
              style={{ marginBottom: 24, color: 'var(--red-pencil)' }}
            >
              ★ &nbsp; A reading-room on the open web
            </div>
            <h1>
              The web,&nbsp;<Scribble>marked&nbsp;up</Scribble>.
            </h1>
            <p className="lede">
              Highlight a YouTube clip. Scribble in a margin. Send an essay to a
              friend with your thinking already attached. Annotated is a quiet
              social network for people who read like it matters.
            </p>
            <div className="hero-ctas">
              <a
                href="/annotated/app"
                className="btn btn-primary"
                style={{ textDecoration: 'none' }}
              >
                Open Annotated
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="#demo"
                className="btn btn-ghost"
                style={{ textDecoration: 'none' }}
              >
                See a sample piece
              </a>
            </div>
            <div className="hero-fineprint">
              Free to start · works on YouTube, Substack, NYT, PDFs, podcasts,
              and the open web.
            </div>
          </div>

          <LivePage />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Star Row Divider
   ============================================================ */

function StarRow() {
  return (
    <div className="star-row">
      <div className="line" />
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <path d="M12 4 L13.5 10.5 L20 12 L13.5 13.5 L12 20 L10.5 13.5 L4 12 L10.5 10.5 Z" />
      </svg>
      <div className="line" />
    </div>
  );
}

/* ============================================================
   How It Works
   ============================================================ */

function HowItWorks() {
  return (
    <section className="how-section" id="how">
      <div className="section-inner">
        <div className="section-eyebrow">How it works</div>
        <h2 className="section-h2">Three motions. Then it&rsquo;s a habit.</h2>
        <p className="section-sub">
          Save a thing. Mark it up. Pass it along. The product is shaped exactly
          like the way a thoughtful reader already reads.
        </p>

        <div className="how-grid">
          <div className="how-step">
            <div className="how-num">01</div>
            <h3>Save anything you read or watch.</h3>
            <p>
              YouTube, Substack, NYT, a PDF on your desktop, a podcast episode,
              a tweet. One extension, one keyboard shortcut, one tap.
            </p>
            <div className="ill">
              <div
                style={{
                  display: 'inline-flex',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: 'var(--graphite-100)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--graphite-700)',
                }}
              >
                ⌘ + ⇧ + A
              </div>
            </div>
          </div>

          <div className="how-step">
            <div className="how-num">02</div>
            <h3>Mark it up — your way.</h3>
            <p>
              Highlight in four inks. Underline in red pencil. Drop a margin
              note in your own handwriting voice. Star the line that mattered.
            </p>
            <div className="ill" style={{ display: 'flex', gap: 8 }}>
              {[
                'var(--red-pencil)',
                'var(--margin-yellow)',
                'var(--pencil-blue)',
                'var(--sage)',
              ].map((c, i) => (
                <span
                  key={i}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: c,
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="how-step">
            <div className="how-num">03</div>
            <h3>Pass it along — they can scribble back.</h3>
            <p>
              Send the annotated piece to a friend. They read what you read, see
              what you saw, and reply in the margin — not in a comments well at
              the bottom.
            </p>
            <div className="ill">
              <span
                className="hand"
                style={{
                  fontSize: 22,
                  color: 'var(--pencil-blue)',
                  transform: 'rotate(-2deg)',
                  display: 'inline-block',
                }}
              >
                yes — but also ↓
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Features
   ============================================================ */

function Features() {
  return (
    <section className="features-section" id="features">
      <div className="section-inner">
        <div className="section-eyebrow">What&rsquo;s in the margin</div>
        <h2 className="section-h2">
          A reading network. Not a reading list with social bolted on.
        </h2>

        <div className="features">
          <div className="feat feat-wide">
            <div>
              <div className="feat-eyebrow">The feed</div>
              <h3 style={{ fontSize: 28, marginBottom: 14 }}>
                Friends&rsquo; marginalia, not strangers&rsquo; takes.
              </h3>
              <p style={{ fontSize: 16 }}>
                Your home is the people you follow, reading what they&rsquo;re
                reading. No engagement bait, no quote-dunks, no algorithm. Just
                what your friends thought was worth marking.
              </p>
            </div>
            <div
              style={{
                marginTop: 24,
                padding: 20,
                background: 'var(--paper-100)',
                borderRadius: 8,
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <Avatar name="Jules Park" color="var(--pencil-blue)" size={28} />
                <div style={{ flex: 1 }}>
                  <div
                    className="sans"
                    style={{
                      fontSize: 12,
                      color: 'var(--fg-secondary)',
                      marginBottom: 4,
                    }}
                  >
                    <strong style={{ color: 'var(--graphite-900)' }}>
                      Jules
                    </strong>{' '}
                    annotated <em>The Three-Body Problem</em>
                  </div>
                  <div
                    className="hand"
                    style={{ fontSize: 19, color: 'var(--pencil-blue)' }}
                  >
                    &ldquo;the dark forest&rdquo; — finally, a metaphor that
                    earns its scale ★
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="feat">
            <div className="feat-eyebrow">Margin replies</div>
            <h3>Threads in the gutter, not the basement.</h3>
            <p>
              Reply to a highlight where the highlight is. Each friend gets
              their own ink color so the page reads like a real conversation.
            </p>
          </div>

          <div className="feat">
            <div className="feat-eyebrow">Every medium</div>
            <h3>Video, audio, paper, post.</h3>
            <p>
              YouTube timestamps. Podcast clips. PDF page-anchors. Article
              highlights. The annotation travels with the source.
            </p>
          </div>

          <div className="feat" style={{ gridColumn: '2 / 4' }}>
            <div className="feat-eyebrow">Your library</div>
            <h3 style={{ fontSize: 24 }}>
              The book of you that nobody else can write.
            </h3>
            <p>
              Every highlight from every year, searchable, tagged, threaded.
              Re-read your past self. They have things to tell you.
            </p>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                flexWrap: 'wrap',
              }}
            >
              {[
                '#attention',
                '#craft',
                '#reading-2026',
                '#dark-forest',
                '#slow-web',
              ].map((t, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '5px 10px',
                    borderRadius: 4,
                    background: 'var(--paper-200)',
                    color: 'var(--graphite-800)',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Interactive Demo
   ============================================================ */

function InteractiveDemo() {
  const [highlights, setHighlights] = useState<
    Record<string, string | null>
  >({
    a: 'yellow',
    b: 'red',
    c: null,
  });
  const [note, setNote] = useState('');
  const [savedNote, setSavedNote] = useState('the line of the year ★');

  function cycle(key: string) {
    const order: (string | null)[] = [null, 'yellow', 'red', 'blue', 'sage'];
    setHighlights((h) => ({
      ...h,
      [key]: order[(order.indexOf(h[key] ?? null) + 1) % order.length],
    }));
  }

  function hlClass(c: string | null) {
    return c ? `hl-${c}` : '';
  }

  return (
    <section className="demo-section" id="demo">
      <div className="section-inner">
        <div className="section-eyebrow">Try it right here</div>
        <h2 className="section-h2">
          Highlight this paragraph. Scribble in the margin.
        </h2>
        <p className="section-sub">
          Click any underlined phrase to cycle its ink. Type a note in the
          margin to see Annotated&rsquo;s hand-voice show up.
        </p>

        <div
          style={{
            marginTop: 56,
            background: '#fff',
            borderRadius: 14,
            padding: '48px 56px',
            boxShadow: 'var(--shadow-md)',
            display: 'grid',
            gridTemplateColumns: '1fr 280px',
            gap: 56,
            maxWidth: 980,
          }}
        >
          <article>
            <div
              className="eyebrow"
              style={{ color: 'var(--pencil-blue)', marginBottom: 14 }}
            >
              The Atlantic · 6 min read
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 28,
                fontWeight: 600,
                lineHeight: 1.18,
                marginBottom: 22,
                letterSpacing: '-0.01em',
              }}
            >
              On the small joys of finishing things
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 17,
                lineHeight: 1.62,
                marginBottom: 14,
              }}
            >
              We&rsquo;ve made a culture of starts. Bookmarks. Saved-for-laters.
              Tabs left open like{' '}
              <span
                onClick={() => cycle('a')}
                className={hlClass(highlights.a)}
                style={{ cursor: 'pointer' }}
              >
                monuments to good intentions
              </span>
              . The unread queue is a moral position now.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 17,
                lineHeight: 1.62,
                marginBottom: 14,
              }}
            >
              But finishing — finishing! — is its own small art. To{' '}
              <span
                onClick={() => cycle('b')}
                className={hlClass(highlights.b)}
                style={{ cursor: 'pointer' }}
              >
                read a thing all the way to the end
              </span>{' '}
              and then to know what you think of it. To close the tab. To put
              the book back on the shelf with the spine slightly warmer than it
              was.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 17,
                lineHeight: 1.62,
                marginBottom: 0,
              }}
            >
              That feeling — the warm spine — is{' '}
              <span
                onClick={() => cycle('c')}
                className={hlClass(highlights.c)}
                style={{ cursor: 'pointer' }}
              >
                worth more than a thousand bookmarks
              </span>
              .
            </p>
          </article>

          <aside>
            <div style={{ marginBottom: 24 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Inks
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'yellow', value: 'var(--margin-yellow)' },
                  { id: 'red', value: 'var(--red-pencil)' },
                  { id: 'blue', value: 'var(--pencil-blue)' },
                  { id: 'sage', value: 'var(--sage)' },
                ].map((c) => (
                  <span
                    key={c.id}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: c.value,
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
                    }}
                  />
                ))}
              </div>
              <div
                className="sans"
                style={{
                  fontSize: 12,
                  color: 'var(--fg-tertiary)',
                  marginTop: 8,
                }}
              >
                Click a phrase to cycle
              </div>
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Margin note
              </div>
              {savedNote && (
                <div
                  style={{
                    fontFamily: 'var(--font-hand)',
                    fontSize: 22,
                    lineHeight: 1.2,
                    color: 'var(--red-pencil)',
                    transform: 'rotate(-1.5deg)',
                    marginBottom: 16,
                  }}
                >
                  {savedNote}
                </div>
              )}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (note.trim()) {
                      setSavedNote(note);
                      setNote('');
                    }
                  }
                }}
                placeholder="add a note…"
                style={{
                  width: '100%',
                  border: '1px dashed var(--border)',
                  borderRadius: 8,
                  padding: 12,
                  fontFamily: 'var(--font-hand)',
                  fontSize: 19,
                  lineHeight: 1.25,
                  color: 'var(--graphite-900)',
                  minHeight: 80,
                  resize: 'none',
                  outline: 'none',
                  background: 'var(--paper-50)',
                  boxSizing: 'border-box',
                }}
              />
              <div
                className="sans"
                style={{
                  fontSize: 11,
                  color: 'var(--fg-tertiary)',
                  marginTop: 6,
                }}
              >
                ↵ to save
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Voices / Social Proof
   ============================================================ */

function Voices() {
  return (
    <section className="social-section" id="voices">
      <div className="section-inner">
        <div className="section-eyebrow">Voices from the margin</div>
        <h2 className="section-h2">
          A small, unhurried community of readers.
        </h2>

        <div className="quotes">
          <div className="quote-big">
            <blockquote>
              I used to send my friends links. Now I send them{' '}
              <span className="hl-yellow">my brain on the link</span>. They
              read what I read, but they also read me reading.
            </blockquote>
            <div className="who">
              <Avatar name="Robin Chen" color="var(--pencil-blue)" size={40} />
              <div>
                <div className="who-name">Robin Chen</div>
                <div className="who-meta">
                  Editor, <em>Aperture Quarterly</em>
                </div>
              </div>
            </div>
          </div>

          <div className="quote-stack">
            <div className="quote-small">
              <blockquote>
                &ldquo;It&rsquo;s the first social product in years where I
                leave feeling smarter, not lonelier.&rdquo;
              </blockquote>
              <div className="who">
                <Avatar name="Theo Marsh" color="var(--sage)" size={28} />
                <div>
                  <div className="who-name">Theo Marsh</div>
                  <div className="who-meta">Designer · Brooklyn</div>
                </div>
              </div>
            </div>
            <div className="quote-small">
              <blockquote>
                &ldquo;My PhD reading group runs on this now. The margin replies
                are the seminar.&rdquo;
              </blockquote>
              <div className="who">
                <Avatar name="Jules Park" color="var(--ochre)" size={28} />
                <div>
                  <div className="who-name">Jules Park</div>
                  <div className="who-meta">Bio PhD · Cambridge</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <StarRow />

        <div
          className="strip"
          style={{ justifyContent: 'center', marginTop: 32 }}
        >
          <span>read in book clubs at</span>
          {['The New School', 'NYRB', 'Aperture', 'The Verge', 'Cambridge'].map(
            (org, i) => (
              <span
                key={i}
                style={{
                  fontStyle: 'normal',
                  fontWeight: 600,
                  fontSize: 16,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {org}
              </span>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   CTA
   ============================================================ */

function CTA() {
  return (
    <section className="cta-section">
      <div className="section-inner">
        <div className="cta-card">
          <h2>
            Read like it&nbsp;
            <Scribble color="var(--red-pencil-soft)">matters</Scribble>.
          </h2>
          <p>
            Annotated is free to start. Bring your reading list, your friends,
            and a soft pencil.
          </p>
          <div style={{ display: 'inline-flex', gap: 12 }}>
            <a
              href="/annotated/app"
              className="btn btn-primary"
              style={{
                textDecoration: 'none',
                padding: '13px 22px',
                fontSize: 15,
              }}
            >
              Open Annotated →
            </a>
            <a
              href="#demo"
              className="btn"
              style={{
                textDecoration: 'none',
                background: 'transparent',
                color: 'var(--paper-50)',
                border: '1px solid rgba(251,248,242,0.25)',
                padding: '13px 22px',
                fontSize: 15,
              }}
            >
              See an example
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Footer
   ============================================================ */

function SiteFooter() {
  const cols = [
    {
      title: 'Product',
      links: ['Open the app', 'Browser extension', 'Mobile (iOS, Android)', 'Changelog'],
    },
    {
      title: 'Reading',
      links: ["Editor's picks", 'Public library', 'Reading clubs', 'Help'],
    },
    {
      title: 'Annotated',
      links: ['About', 'Manifesto', 'Press', 'Contact'],
    },
  ];

  return (
    <footer className="site-footer">
      <div className="section-inner">
        <div className="footer-grid">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/annotated/assets/logo-wordmark.svg"
              alt="Annotated"
              style={{ height: 26, marginBottom: 14 }}
            />
            <p
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 15,
                color: 'var(--fg-secondary)',
                maxWidth: 280,
                margin: 0,
              }}
            >
              Reading, with the margin restored.
            </p>
          </div>
          {cols.map((c, i) => (
            <div className="footer-col" key={i}>
              <h4>{c.title}</h4>
              <ul>
                {c.links.map((l, j) => (
                  <li key={j}>
                    <a href="#">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© 2026 Annotated, Inc.</span>
          <span>Made for readers.</span>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Landing Page (root)
   ============================================================ */

export default function AnnotatedLanding() {
  return (
    <div className="annotated-root paper-grain">
      <SiteHeader />
      <Hero />
      <HowItWorks />
      <Features />
      <InteractiveDemo />
      <Voices />
      <CTA />
      <SiteFooter />
    </div>
  );
}
