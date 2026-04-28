'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '../annotated.css';
import './app.css';

/* ============================================================
   Types
   ============================================================ */

interface Person {
  id: string;
  name: string;
  handle: string;
  color: string;
  ink: string;
  bio: string;
}

interface HighlightPart {
  t: string;
  hl?: string;
  ul?: string;
  id?: string;
}

interface Paragraph {
  kind: string;
  parts: HighlightPart[];
}

interface Timestamp {
  t: string;
  label: string;
  color: string;
}

interface NoteReply {
  author: string;
  text: string;
  tilt: number;
}

interface Note {
  id: string;
  author: string;
  text: string;
  tilt: number;
  replies: NoteReply[];
}

interface Piece {
  id: string;
  type: string;
  source: string;
  title: string;
  author: string;
  annotator: string;
  date: string;
  readTime: string;
  duration?: string;
  thumbnailColor?: string;
  excerpt: string;
  paragraphs?: Paragraph[];
  timestamps?: Timestamp[];
  notes: Note[];
  likes: number;
  replies: number;
  reannotated: number;
  tags?: string[];
}

interface ActivityItem {
  id: string;
  kind: string;
  who: string;
  target?: string;
  preview?: string;
  time: string;
}

interface DiscoverTag {
  tag: string;
  count: number;
  ink: string;
}

interface PieceState {
  liked?: boolean;
  bookmarked?: boolean;
}

/* ============================================================
   Data
   ============================================================ */

const PEOPLE: Record<string, Person> = {
  you:   { id: 'you',   name: 'You',          handle: 'you',       color: 'var(--red-pencil)',  ink: 'var(--red-pencil)',  bio: 'Reading and re-reading. Mostly fiction, mostly slowly.' },
  maya:  { id: 'maya',  name: 'Maya Okonjo',  handle: 'maya',      color: 'var(--red-pencil)',  ink: 'var(--red-pencil)',  bio: 'Film criticism, urbanism, the slow web. Currently re-reading Sontag.' },
  jules: { id: 'jules', name: 'Jules Park',   handle: 'julespark', color: 'var(--pencil-blue)', ink: 'var(--pencil-blue)', bio: 'Bio PhD at Cambridge. Margin notes are how I think.' },
  theo:  { id: 'theo',  name: 'Theo Marsh',   handle: 'theo',      color: 'var(--sage)',        ink: 'var(--sage)',        bio: 'Designer in Brooklyn. Building small, quiet things.' },
  robin: { id: 'robin', name: 'Robin Chen',   handle: 'rchen',     color: 'var(--ochre)',       ink: 'var(--ochre)',       bio: 'Editor, Aperture Quarterly. Photographs and the words around them.' },
  ines:  { id: 'ines',  name: 'Inés Vargas',  handle: 'inesv',     color: 'var(--pencil-blue)', ink: 'var(--pencil-blue)', bio: 'Translator, lapsed academic, full-time reader.' },
  kai:   { id: 'kai',   name: 'Kai Tanaka',   handle: 'kaitanaka', color: 'var(--graphite-700)',ink: 'var(--graphite-800)',bio: 'Architect. Books on cities, mostly.' },
};

const PIECES: Piece[] = [
  {
    id: 'p1', type: 'article', source: 'Aperture Quarterly',
    title: 'The slow web is still the better web', author: 'Maya Okonjo', annotator: 'maya',
    date: 'Mar 14', readTime: '7 min',
    excerpt: 'There is a particular feeling — call it readerly attention — that the early-2010s web used to invite. Long blog posts, RSS feeds, the assumption that an essay was a thing you finished, not a thing you swiped past.',
    paragraphs: [
      { kind: 'p', parts: [
        { t: 'There is a particular feeling — call it ' },
        { t: 'readerly attention', hl: 'yellow', id: 'h1' },
        { t: ' — that the web of the early 2010s used to invite. Long blog posts, RSS feeds, the assumption that an essay was a thing you finished, not a thing you swiped past.' },
      ] },
      { kind: 'p', parts: [
        { t: 'What replaced it isn\'t reading at all. It is ' },
        { t: 'scrolling', ul: 'red', id: 'h2' },
        { t: ', which is a related but lesser act. The eye moves; the mind doesn\'t always follow. We pick up the gist of forty things and the shape of none.' },
      ] },
      { kind: 'p', parts: [
        { t: 'And yet — and ' },
        { t: 'this is the part I keep coming back to', hl: 'red', id: 'h3' },
        { t: ' — the slow web hasn\'t gone anywhere. It just stopped being the default. It became a thing you have to choose. A subscription. A walk. A book on the desk.' },
      ] },
      { kind: 'p', parts: [
        { t: 'The interesting question isn\'t whether reading-as-attention will return at scale. It almost certainly won\'t. The interesting question is what reading looks like when it has to be ' },
        { t: 'defended', hl: 'sage', id: 'h4' },
        { t: '.' },
      ] },
    ],
    notes: [
      { id: 'h1', author: 'maya', text: 'cf. Sontag — "interpretation is the revenge of intellect"', tilt: -2,
        replies: [
          { author: 'jules', text: 'or: the revenge of the unfinished essay', tilt: 1 },
          { author: 'theo', text: 'this is exactly the Long Now feeling →', tilt: -1.5 },
        ]
      },
      { id: 'h3', author: 'maya', text: '★ this is the line', tilt: 1, replies: [] },
      { id: 'h4', author: 'maya', text: 'see also: "what we owe each other when reading"', tilt: -1, replies: [
        { author: 'robin', text: 'yes — and to the writer too', tilt: 2 }
      ] },
    ],
    likes: 47, replies: 12, reannotated: 6,
    tags: ['#attention', '#slow-web'],
  },
  {
    id: 'p2', type: 'youtube', source: 'YouTube · Lex Fridman',
    title: 'On building things that last (with Brian Eno)', author: 'Lex Fridman', annotator: 'jules',
    date: 'Mar 12', readTime: '1h 42m', duration: '1:42:18',
    thumbnailColor: 'linear-gradient(135deg, #2E2B26 0%, #3E5C76 100%)',
    excerpt: 'Eno on the difference between problems and predicaments — "you solve a problem; you negotiate a predicament" — and why most of art is the second.',
    timestamps: [
      { t: '12:04', label: 'on the long now', color: 'yellow' },
      { t: '37:51', label: 'problems vs. predicaments', color: 'red' },
      { t: '1:08:33', label: 'oblique strategies, in practice', color: 'blue' },
    ],
    notes: [
      { id: 't1', author: 'jules', text: '"you negotiate a predicament" — keeping this one', tilt: -1.5,
        replies: [{ author: 'maya', text: 'gospel for the next 5 years', tilt: 2 }] },
    ],
    likes: 89, replies: 23, reannotated: 14,
    tags: ['#craft', '#long-now'],
  },
  {
    id: 'p3', type: 'book', source: 'Cixin Liu',
    title: 'The Three-Body Problem', author: 'translated by Ken Liu', annotator: 'theo',
    date: 'Mar 10', readTime: 'Ch. 27',
    excerpt: 'The dark forest theory — finally, a metaphor for the cosmos that earns its scale. A reading-club thread on chapter 27.',
    paragraphs: [
      { kind: 'p', parts: [
        { t: '"The universe is a ' },
        { t: 'dark forest', hl: 'blue', id: 'b1' },
        { t: '. Every civilization is an armed hunter stalking through the trees like a ghost…"' },
      ] },
      { kind: 'p', parts: [
        { t: 'It is the metaphor doing the work, not the physics. The physics is the alibi. The metaphor — the forest, the hunter, the silence — is what makes the book ' },
        { t: 'earn its scale', hl: 'red', id: 'b2' },
        { t: '.' },
      ] },
    ],
    notes: [
      { id: 'b1', author: 'theo', text: 'the dark forest — finally, a metaphor that earns its scale ★', tilt: -1.5,
        replies: [
          { author: 'jules', text: 'I keep thinking about this w.r.t. the open internet', tilt: 1 },
          { author: 'ines', text: 'the Spanish translation loses some of this btw', tilt: -1 },
          { author: 'maya', text: 'reading club thursday?', tilt: 2 },
        ] },
    ],
    likes: 134, replies: 47, reannotated: 22,
    tags: ['#sci-fi', '#dark-forest', '#reading-club'],
  },
  {
    id: 'p4', type: 'podcast', source: 'Ezra Klein Show',
    title: 'What we lose when we lose paper', author: 'Ezra Klein', annotator: 'robin',
    date: 'Mar 8', readTime: '54 min', duration: '54:12',
    thumbnailColor: 'linear-gradient(135deg, #C49A4B 0%, #9A2E18 100%)',
    excerpt: 'A surprisingly tender hour on books as objects — the dog-ear, the broken spine, the underline you don\'t remember making.',
    timestamps: [
      { t: '08:14', label: 'the underline you don\'t remember', color: 'red' },
      { t: '24:30', label: 'why margins matter', color: 'yellow' },
      { t: '41:02', label: 'the bookshelf as autobiography', color: 'sage' },
    ],
    notes: [
      { id: 'p1n', author: 'robin', text: 'yes — the bookshelf-as-autobiography idea', tilt: -2, replies: [] },
    ],
    likes: 56, replies: 9, reannotated: 4,
    tags: ['#paper', '#reading'],
  },
  {
    id: 'p5', type: 'tweet', source: 'X · @patio11',
    title: '"Software companies that work…" — a thread', author: 'Patrick McKenzie', annotator: 'theo',
    date: 'Mar 6', readTime: '2 min',
    excerpt: 'A four-tweet thread that reads like a chapter of a how-to that nobody wrote.',
    paragraphs: [
      { kind: 'p', parts: [
        { t: 'Software companies that work usually pick a ' },
        { t: 'narrow, deeply-felt problem', hl: 'red', id: 't1' },
        { t: ' before they pick a market.' },
      ] },
      { kind: 'p', parts: [
        { t: 'The market arrives later, and is usually larger and weirder than anyone predicted at the start.' },
      ] },
    ],
    notes: [
      { id: 't1', author: 'theo', text: 'narrow + deeply felt > broad + lukewarm. always.', tilt: 1, replies: [
        { author: 'jules', text: 'this is also true of papers', tilt: -1 }
      ]},
    ],
    likes: 31, replies: 4, reannotated: 2,
    tags: ['#startups', '#craft'],
  },
  {
    id: 'p6', type: 'pdf', source: 'PDF · 14 pages',
    title: 'Calvino — Six Memos for the Next Millennium', author: 'Italo Calvino', annotator: 'ines',
    date: 'Mar 4', readTime: '14 pp.',
    excerpt: 'Lightness, quickness, exactitude, visibility, multiplicity. Annotated for a translation seminar.',
    paragraphs: [
      { kind: 'p', parts: [
        { t: 'My working method has more often than not involved the ' },
        { t: 'subtraction of weight', hl: 'yellow', id: 'c1' },
        { t: '. I have tried to remove weight, sometimes from people, sometimes from heavenly bodies, sometimes from cities.' },
      ] },
    ],
    notes: [
      { id: 'c1', author: 'ines', text: 'leggerezza — closer to "buoyancy" than "lightness"?', tilt: -1.5, replies: [
        { author: 'maya', text: 'oh that\'s good', tilt: 1 }
      ] },
    ],
    likes: 42, replies: 8, reannotated: 3,
    tags: ['#calvino', '#translation'],
  },
];

const ACTIVITY: ActivityItem[] = [
  { id: 'a1', kind: 'reply', who: 'jules', target: 'p1', preview: 'or: the revenge of the unfinished essay', time: '12 min ago' },
  { id: 'a2', kind: 'follow', who: 'robin', time: '1 h ago' },
  { id: 'a3', kind: 'reannotate', who: 'theo', target: 'p3', preview: 'the dark forest — finally, a metaphor that earns its scale ★', time: '3 h ago' },
  { id: 'a4', kind: 'like', who: 'ines', target: 'p1', time: '5 h ago' },
  { id: 'a5', kind: 'reply', who: 'maya', target: 'p2', preview: 'gospel for the next 5 years', time: 'Yesterday' },
  { id: 'a6', kind: 'mention', who: 'kai', target: 'p4', preview: 'reminded me of @you on bookshelves', time: 'Yesterday' },
  { id: 'a7', kind: 'follow', who: 'kai', time: '2 d ago' },
];

const DISCOVER_TAGS: DiscoverTag[] = [
  { tag: '#slow-web', count: 247, ink: 'var(--red-pencil)' },
  { tag: '#dark-forest', count: 188, ink: 'var(--pencil-blue)' },
  { tag: '#craft', count: 412, ink: 'var(--sage)' },
  { tag: '#calvino', count: 64, ink: 'var(--ochre)' },
  { tag: '#attention', count: 530, ink: 'var(--red-pencil)' },
  { tag: '#long-now', count: 92, ink: 'var(--pencil-blue)' },
];

/* ============================================================
   SVG Icon Component
   ============================================================ */

const ICON_PATHS: Record<string, React.ReactNode> = {
  home: <><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></>,
  feed: <><path d="M4 6h16M4 12h16M4 18h10"/></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="M16 8l-2 6-6 2 2-6 6-2z"/></>,
  pen: <><path d="M14 4l6 6-12 12H2v-6L14 4z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
  bookmark: <><path d="M19 21l-7-5-7 5V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>,
  'bookmark-fill': <><path d="M19 21l-7-5-7 5V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor"/></>,
  heart: <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>,
  'heart-fill': <><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor"/></>,
  reply: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/></>,
  share: <><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.6 13.5L15.4 17M15.4 7L8.6 10.5"/></>,
  play: <><polygon points="6 4 20 12 6 20 6 4" fill="currentColor"/></>,
  book: <><path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
  youtube: <><rect x="2" y="6" width="20" height="12" rx="3"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none"/></>,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
  twitter: <><path d="M23 4.5a9 9 0 0 1-2.6.7 4.5 4.5 0 0 0 2-2.5 9 9 0 0 1-2.9 1.1 4.5 4.5 0 0 0-7.7 4.1A12.7 12.7 0 0 1 1.6 3.2a4.5 4.5 0 0 0 1.4 6 4.5 4.5 0 0 1-2-.6v.1a4.5 4.5 0 0 0 3.6 4.4 4.5 4.5 0 0 1-2 .1 4.5 4.5 0 0 0 4.2 3.1A9 9 0 0 1 1 18a12.7 12.7 0 0 0 6.9 2c8.3 0 12.8-6.9 12.8-12.8v-.6a9 9 0 0 0 2.3-2.3z"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  x: <><path d="M18 6L6 18M6 6l12 12"/></>,
  star: <><polygon points="12 2 15 9 22 10 17 15 18 22 12 18 6 22 7 15 2 10 9 9 12 2"/></>,
  'arrow-right': <><path d="M5 12h14M13 5l7 7-7 7"/></>,
  note: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h6M8 17h4"/></>,
};

function Icon({ name, size = 18, stroke = 1.7, color = 'currentColor' }: {
  name: string; size?: number; stroke?: number; color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name] || null}
    </svg>
  );
}

/* ============================================================
   Shared UI Primitives
   ============================================================ */

function Avatar({ person, size = 32, ring }: { person: Person; size?: number; ring?: boolean }) {
  const initial = person.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="avatar" style={{
      width: size, height: size, background: person.color, fontSize: size * 0.42,
      boxShadow: ring ? `0 0 0 2px var(--bg), 0 0 0 4px ${person.color}` : 'none'
    }}>{initial}</span>
  );
}

function MediaIcon({ type, size = 14 }: { type: string; size?: number }) {
  const map: Record<string, string> = { article: 'file', youtube: 'youtube', book: 'book', pdf: 'file', tweet: 'twitter', podcast: 'mic' };
  const colorMap: Record<string, string> = {
    article: 'var(--graphite-700)', youtube: '#C8462C', book: 'var(--pencil-blue)',
    pdf: 'var(--ochre)', tweet: 'var(--graphite-700)', podcast: 'var(--sage)'
  };
  return <Icon name={map[type]} size={size} stroke={1.6} color={colorMap[type]} />;
}

function MediaLabel({ type }: { type: string }) {
  const labels: Record<string, string> = { article: 'Article', youtube: 'Video', book: 'Book', pdf: 'PDF', tweet: 'Post', podcast: 'Podcast' };
  return <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-secondary)' }}>{labels[type]}</span>;
}

function Highlight({ part, onClick }: { part: HighlightPart; onClick?: () => void }) {
  if (part.hl) return <span className={`hl-${part.hl}`} style={{ cursor: onClick ? 'pointer' : 'inherit' }} onClick={onClick}>{part.t}</span>;
  if (part.ul) return <span className="underline-red" style={{ cursor: onClick ? 'pointer' : 'inherit' }} onClick={onClick}>{part.t}</span>;
  return <span>{part.t}</span>;
}

/* ============================================================
   Feed Card Components
   ============================================================ */

function PieceMeta({ piece, person }: { piece: Piece; person: Person }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar person={person} size={28}/>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--graphite-900)' }}>
          {person.name}
        </span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--fg-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
          annotated · {piece.date} · <MediaIcon type={piece.type} size={11}/> {piece.source}
        </span>
      </div>
    </div>
  );
}

function PieceActions({ piece, state, onLike, onBookmark, onOpen }: {
  piece: Piece; state: PieceState; onLike: () => void; onBookmark: () => void; onOpen: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <button className="btn btn-quiet" onClick={onLike} aria-pressed={state.liked}
        style={{ color: state.liked ? 'var(--red-pencil)' : 'var(--graphite-700)' }}>
        <Icon name={state.liked ? 'heart-fill' : 'heart'} size={15}/>
        <span>{piece.likes + (state.liked ? 1 : 0)}</span>
      </button>
      <button className="btn btn-quiet" onClick={onOpen}>
        <Icon name="reply" size={15}/>
        <span>{piece.replies}</span>
      </button>
      <button className="btn btn-quiet">
        <Icon name="share" size={15}/>
        <span>Reannotate · {piece.reannotated}</span>
      </button>
      <div style={{ marginLeft: 'auto' }}/>
      <button className="btn btn-quiet" onClick={onBookmark} aria-pressed={state.bookmarked}
        style={{ color: state.bookmarked ? 'var(--red-pencil)' : 'var(--graphite-700)' }}>
        <Icon name={state.bookmarked ? 'bookmark-fill' : 'bookmark'} size={15}/>
      </button>
      <button className="btn btn-ghost" onClick={onOpen} style={{ padding: '7px 12px', fontSize: 13 }}>
        Open<Icon name="arrow-right" size={13}/>
      </button>
    </div>
  );
}

function MediaPreview({ piece, onOpen }: { piece: Piece; onOpen: () => void }) {
  if (piece.type === 'youtube') {
    return (
      <div onClick={onOpen} style={{ cursor: 'pointer' }}>
        <div style={{
          aspectRatio: '16/9', borderRadius: 8, background: piece.thumbnailColor,
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16, overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), transparent 60%)'
          }}/>
          <div style={{
            width: 64, height: 64, borderRadius: 999, background: 'rgba(255,255,255,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <Icon name="play" size={26} color="var(--graphite-900)" stroke={0}/>
          </div>
          <span style={{
            position: 'absolute', bottom: 12, right: 12,
            background: 'rgba(31,29,26,0.75)', color: '#fff',
            fontFamily: 'var(--font-mono)', fontSize: 12, padding: '3px 8px', borderRadius: 4
          }}>{piece.duration}</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 600, lineHeight: 1.18, letterSpacing: '-0.01em', margin: '0 0 4px' }}>
          {piece.title}
        </h2>
        <div className="sans" style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 14 }}>{piece.author}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {piece.timestamps?.map((ts, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px', background: 'var(--paper-50)', borderRadius: 6 }}>
              <span className={`hl-${ts.color}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, padding: '2px 6px' }}>{ts.t}</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--graphite-800)' }}>{ts.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (piece.type === 'podcast') {
    return (
      <div onClick={onOpen} style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: '120px 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ aspectRatio: '1', borderRadius: 8, background: piece.thumbnailColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="mic" size={32} color="#fff"/>
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600, lineHeight: 1.18, margin: '0 0 4px' }}>{piece.title}</h2>
          <div className="sans" style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 8 }}>{piece.author} · {piece.duration}</div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.55, color: 'var(--graphite-700)', margin: '0 0 12px' }}>
            {piece.excerpt}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {piece.timestamps?.map((ts, i) => (
              <span key={i} className={`hl-${ts.color}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, padding: '3px 7px', borderRadius: 3 }}>
                {ts.t} {ts.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return null;
}

/* Editorial card */
function FeedCardEditorial({ piece, state, onLike, onBookmark, onOpen, onPerson }: {
  piece: Piece; state: PieceState; onLike: () => void; onBookmark: () => void; onOpen: () => void; onPerson: (id: string) => void;
}) {
  const person = PEOPLE[piece.annotator];
  const firstNote = piece.notes?.[0];
  const noteAuthor = firstNote ? PEOPLE[firstNote.author] : null;

  return (
    <article className="card" style={{ padding: '24px 28px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div onClick={() => onPerson(person.id)} style={{ cursor: 'pointer' }}>
          <PieceMeta piece={piece} person={person}/>
        </div>
        <span className="eyebrow" style={{ color: 'var(--fg-tertiary)' }}>{piece.readTime}</span>
      </div>

      {piece.type === 'youtube' || piece.type === 'podcast' ? (
        <MediaPreview piece={piece} onOpen={onOpen}/>
      ) : (
        <div onClick={onOpen} style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: 32, alignItems: 'start' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 600, lineHeight: 1.18, letterSpacing: '-0.01em', margin: '0 0 4px' }}>
              {piece.title}
            </h2>
            <div className="sans" style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 14 }}>{piece.author}</div>
            {piece.paragraphs?.slice(0, 2).map((para, i) => (
              <p key={i} style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.6, margin: '0 0 10px', color: 'var(--graphite-800)' }}>
                {para.parts.map((p, j) => <Highlight key={j} part={p}/>)}
              </p>
            ))}
          </div>
          {firstNote && noteAuthor && (
            <div style={{ paddingTop: 36, position: 'relative' }}>
              <svg viewBox="0 0 80 50" width="60" height="38" fill="none"
                   style={{ color: noteAuthor.ink, opacity: 0.55, position: 'absolute', top: -6, left: -8 }}>
                <path d="M 6 8 Q 30 6, 50 18 T 76 38" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M 76 38 L 66 36 M 76 38 L 70 46" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <div style={{
                fontFamily: 'var(--font-hand)', fontSize: 21, lineHeight: 1.22,
                color: noteAuthor.ink, transform: `rotate(${firstNote.tilt || -1}deg)`
              }}>
                {firstNote.text}
              </div>
              {firstNote.replies && firstNote.replies.length > 0 && (
                <div className="sans" style={{ marginTop: 14, fontSize: 11, color: 'var(--fg-secondary)' }}>
                  + {firstNote.replies.length} margin {firstNote.replies.length === 1 ? 'reply' : 'replies'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {piece.tags && (
        <div style={{ display: 'flex', gap: 6, marginTop: 18, flexWrap: 'wrap' }}>
          {piece.tags.map(t => (
            <span key={t} style={{
              fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
              padding: '3px 9px', borderRadius: 4,
              background: 'var(--paper-100)', color: 'var(--graphite-700)'
            }}>{t}</span>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '18px 0 12px' }}/>
      <PieceActions piece={piece} state={state} onLike={onLike} onBookmark={onBookmark} onOpen={onOpen}/>
    </article>
  );
}

/* Dense list-style card */
function FeedCardDense({ piece, state, onLike, onBookmark, onOpen, onPerson }: {
  piece: Piece; state: PieceState; onLike: () => void; onBookmark: () => void; onOpen: () => void; onPerson: (id: string) => void;
}) {
  const person = PEOPLE[piece.annotator];
  const firstNote = piece.notes?.[0];
  return (
    <article className="card" style={{ padding: '18px 22px', display: 'flex', gap: 16 }}>
      <div onClick={() => onPerson(person.id)} style={{ cursor: 'pointer', flex: 'none' }}>
        <Avatar person={person} size={36}/>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'block' }}>
        <div className="sans" style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 6, lineHeight: 1.4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--graphite-900)' }}>{person.name}</span>
          <span> · annotated </span>
          <MediaIcon type={piece.type} size={11}/>
          <span> {piece.source} · {piece.date}</span>
        </div>
        <h3 onClick={onOpen} style={{ display: 'block', cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 600, lineHeight: 1.25, margin: '0 0 8px' }}>{piece.title}</h3>
        {firstNote && (
          <div style={{
            fontFamily: 'var(--font-hand)', fontSize: 19, color: PEOPLE[firstNote.author].ink,
            marginBottom: 8, transform: `rotate(${firstNote.tilt || -0.5}deg)`, display: 'inline-block'
          }}>
            {firstNote.text}
          </div>
        )}
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.5, color: 'var(--graphite-700)', margin: '0 0 10px' }}>
          {piece.excerpt}
        </p>
        <PieceActions piece={piece} state={state} onLike={onLike} onBookmark={onBookmark} onOpen={onOpen}/>
      </div>
    </article>
  );
}

/* Paper-stack card */
function FeedCardPaper({ piece, state, onLike, onBookmark, onOpen, onPerson }: {
  piece: Piece; state: PieceState; onLike: () => void; onBookmark: () => void; onOpen: () => void; onPerson: (id: string) => void;
}) {
  const person = PEOPLE[piece.annotator];
  const firstNote = piece.notes?.[0];
  return (
    <article style={{ position: 'relative', marginBottom: 8 }}>
      <div style={{ position: 'absolute', inset: 0, transform: 'rotate(-1deg) translate(-4px, 6px)', background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow-xs)' }}/>
      <div style={{ position: 'absolute', inset: 0, transform: 'rotate(0.6deg) translate(3px, 3px)', background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow-xs)' }}/>
      <div className="card" style={{ position: 'relative', padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div onClick={() => onPerson(person.id)} style={{ cursor: 'pointer' }}>
            <PieceMeta piece={piece} person={person}/>
          </div>
          <MediaLabel type={piece.type}/>
        </div>

        <h2 onClick={onOpen} style={{ cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 600, lineHeight: 1.12, letterSpacing: '-0.014em', margin: '0 0 6px' }}>
          {piece.title}
        </h2>
        <div className="sans" style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 18 }}>{piece.author} · {piece.readTime}</div>

        {piece.type === 'youtube' || piece.type === 'podcast' ? (
          <MediaPreview piece={piece} onOpen={onOpen}/>
        ) : piece.paragraphs ? (
          <p onClick={onOpen} style={{ cursor: 'pointer', fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.6, margin: 0, color: 'var(--graphite-800)' }}>
            {piece.paragraphs[0].parts.map((p, j) => <Highlight key={j} part={p}/>)}
          </p>
        ) : null}

        {firstNote && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <Avatar person={PEOPLE[firstNote.author]} size={24}/>
            <div style={{
              fontFamily: 'var(--font-hand)', fontSize: 22, lineHeight: 1.2,
              color: PEOPLE[firstNote.author].ink, flex: 1
            }}>
              {firstNote.text}
            </div>
          </div>
        )}

        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '18px 0 12px' }}/>
        <PieceActions piece={piece} state={state} onLike={onLike} onBookmark={onBookmark} onOpen={onOpen}/>
      </div>
    </article>
  );
}

function FeedCard(props: {
  piece: Piece; variant?: string; state: PieceState;
  onLike: () => void; onBookmark: () => void; onOpen: () => void; onPerson: (id: string) => void;
}) {
  const { variant = 'editorial', ...rest } = props;
  if (variant === 'dense') return <FeedCardDense {...rest}/>;
  if (variant === 'paper') return <FeedCardPaper {...rest}/>;
  return <FeedCardEditorial {...rest}/>;
}

/* ============================================================
   Screens
   ============================================================ */

function HomeFeed({ feedVariant, state, onLike, onBookmark, onOpen, onPerson }: {
  feedVariant: string; state: Record<string, PieceState>;
  onLike: (id: string) => void; onBookmark: (id: string) => void;
  onOpen: (id: string) => void; onPerson: (id: string) => void;
}) {
  const [tab, setTab] = useState('all');
  const filtered = tab === 'all' ? PIECES : PIECES.filter(p => p.type === tab);
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 96px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 600, letterSpacing: '-0.014em', margin: 0 }}>Friday morning</h1>
          <p className="sans" style={{ fontSize: 14, color: 'var(--fg-secondary)', margin: '4px 0 0' }}>6 new annotations from the people you follow.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, padding: 3, background: 'var(--paper-200)', borderRadius: 8, width: 'fit-content' }}>
        {[
          { id: 'all', l: 'All' },
          { id: 'article', l: 'Articles' },
          { id: 'youtube', l: 'Video' },
          { id: 'podcast', l: 'Podcasts' },
          { id: 'book', l: 'Books' },
          { id: 'pdf', l: 'PDFs' },
          { id: 'tweet', l: 'Posts' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn"
            style={{
              background: tab === t.id ? '#fff' : 'transparent',
              color: tab === t.id ? 'var(--graphite-900)' : 'var(--fg-secondary)',
              boxShadow: tab === t.id ? 'var(--shadow-xs)' : 'none',
              padding: '5px 12px', fontSize: 13, fontWeight: 600
            }}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {filtered.map(p => (
          <FeedCard key={p.id} piece={p} variant={feedVariant}
            state={state[p.id] || {}}
            onLike={() => onLike(p.id)}
            onBookmark={() => onBookmark(p.id)}
            onOpen={() => onOpen(p.id)}
            onPerson={onPerson}
          />
        ))}
      </div>
    </div>
  );
}

function PieceDetail({ piece, state, onLike, onBookmark, onPerson, onBack }: {
  piece: Piece; state: PieceState; onLike: () => void; onBookmark: () => void;
  onPerson: (id: string) => void; onBack: () => void;
}) {
  const person = PEOPLE[piece.annotator];
  const [replies, setReplies] = useState<Record<string, NoteReply[]>>(() => {
    const r: Record<string, NoteReply[]> = {};
    piece.notes.forEach(n => r[n.id] = [...(n.replies || [])]);
    return r;
  });
  const [composingFor, setComposingFor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  function submitReply(noteId: string) {
    if (!draft.trim()) return;
    setReplies(r => ({ ...r, [noteId]: [...(r[noteId] || []), { author: 'you', text: draft.trim(), tilt: (Math.random() - 0.5) * 4 }] }));
    setDraft('');
    setComposingFor(null);
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 96px' }}>
      <button onClick={onBack} className="btn btn-quiet" style={{ marginBottom: 16, fontSize: 13 }}>
        <span>&larr; Back to feed</span>
      </button>

      <div style={{
        background: '#fff', borderRadius: 14, boxShadow: 'var(--shadow-sm)',
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px',
      }}>
        <article style={{ padding: '40px 44px 48px', borderRight: '1px solid var(--border-subtle)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div onClick={() => onPerson(person.id)} style={{ cursor: 'pointer' }}>
              <PieceMeta piece={piece} person={person}/>
            </div>
            <MediaLabel type={piece.type}/>
          </div>

          <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--pencil-blue)' }}>{piece.source} · {piece.readTime}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 40, fontWeight: 600, lineHeight: 1.1, letterSpacing: '-0.014em', margin: '0 0 8px' }}>
            {piece.title}
          </h1>
          <div className="sans" style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 32 }}>{piece.author}</div>

          {piece.type === 'youtube' || piece.type === 'podcast' ? (
            <MediaPreview piece={piece} onOpen={() => {}}/>
          ) : piece.paragraphs ? (
            piece.paragraphs.map((para, i) => (
              <p key={i} style={{ fontFamily: 'var(--font-serif)', fontSize: 19, lineHeight: 1.62, margin: '0 0 18px', color: 'var(--graphite-900)' }}>
                {para.parts.map((p, j) => <Highlight key={j} part={p}/>)}
              </p>
            ))
          ) : null}

          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
            <PieceActions piece={piece} state={state} onLike={onLike} onBookmark={onBookmark} onOpen={() => {}}/>
          </div>
        </article>

        <aside style={{ padding: '48px 28px', background: 'var(--paper-50)', borderRadius: '0 14px 14px 0' }}>
          <div className="eyebrow" style={{ marginBottom: 18 }}>Margin · {piece.notes.length + Object.values(replies).flat().length} marks</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {piece.notes.map(note => {
              const noteAuthor = PEOPLE[note.author];
              const noteReplies = replies[note.id] || [];
              return (
                <div key={note.id}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Avatar person={noteAuthor} size={24}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="sans" style={{ fontSize: 11, color: 'var(--fg-secondary)', marginBottom: 4 }}>{noteAuthor.name}</div>
                      <div style={{ fontFamily: 'var(--font-hand)', fontSize: 21, lineHeight: 1.22, color: noteAuthor.ink, transform: `rotate(${note.tilt}deg)`, transformOrigin: 'left' }}>
                        {note.text}
                      </div>
                    </div>
                  </div>

                  {noteReplies.length > 0 && (
                    <div style={{ marginLeft: 20, marginTop: 14, paddingLeft: 14, borderLeft: '1px dashed var(--border)' }}>
                      {noteReplies.map((r, i) => {
                        const ra = PEOPLE[r.author];
                        return (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
                            <Avatar person={ra} size={18}/>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="sans" style={{ fontSize: 10, color: 'var(--fg-secondary)', marginBottom: 2 }}>{ra.name}</div>
                              <div style={{ fontFamily: 'var(--font-hand)', fontSize: 18, lineHeight: 1.2, color: ra.ink, transform: `rotate(${r.tilt}deg)`, transformOrigin: 'left' }}>
                                {r.text}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {composingFor === note.id ? (
                    <div style={{ marginLeft: 20, marginTop: 10, paddingLeft: 14 }}>
                      <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReply(note.id); } if (e.key === 'Escape') { setComposingFor(null); setDraft(''); } }}
                        placeholder="scribble a reply…"
                        style={{
                          width: '100%', border: '1px dashed var(--border)', borderRadius: 6, padding: '8px 10px',
                          fontFamily: 'var(--font-hand)', fontSize: 18, lineHeight: 1.25,
                          color: PEOPLE.you.ink, minHeight: 50, resize: 'none', outline: 'none',
                          background: '#fff', boxSizing: 'border-box'
                        }}/>
                      <div className="sans" style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>&crarr; to save · esc to cancel</span>
                        <button className="btn btn-primary" onClick={() => submitReply(note.id)} style={{ padding: '4px 10px', fontSize: 11 }}>Add</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setComposingFor(note.id)} className="btn btn-quiet"
                      style={{ marginLeft: 20, marginTop: 6, fontSize: 12, color: 'var(--fg-secondary)' }}>
                      <Icon name="reply" size={12}/> reply in margin
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProfilePage({ personId, state, onOpen, onPerson, onBack }: {
  personId: string; state: Record<string, PieceState>;
  onOpen: (id: string) => void; onPerson: (id: string) => void; onBack: () => void;
}) {
  const person = PEOPLE[personId] || PEOPLE.maya;
  const [following, setFollowing] = useState(personId !== 'you');
  const [tab, setTab] = useState('library');
  const personPieces = PIECES.filter(p => p.annotator === personId);
  const counts = { library: personPieces.length || 14, followers: 248, following: 91, marks: 1247 };

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 24px 96px' }}>
      <button onClick={onBack} className="btn btn-quiet" style={{ marginBottom: 16, fontSize: 13 }}>
        <span>&larr; Back</span>
      </button>

      <div style={{ background: '#fff', borderRadius: 14, padding: '40px 40px 28px', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: 999, background: person.color, opacity: 0.08 }}/>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', position: 'relative' }}>
          <Avatar person={person} size={84}/>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 600, letterSpacing: '-0.014em', margin: 0 }}>{person.name}</h1>
            <div className="sans" style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 12 }}>@{person.handle} · ink: <span style={{ color: person.ink }}>&bull;</span></div>
            <p style={{ fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.55, color: 'var(--graphite-800)', maxWidth: 520, margin: 0 }}>
              {person.bio}
            </p>
          </div>
          {personId !== 'you' && (
            <button onClick={() => setFollowing(f => !f)} className={following ? 'btn btn-ghost' : 'btn btn-primary'}>
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 32, marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
          {[
            { l: 'Annotations', n: counts.marks },
            { l: 'Library', n: counts.library },
            { l: 'Followers', n: counts.followers },
            { l: 'Following', n: counts.following },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 600 }}>{s.n.toLocaleString()}</div>
              <div className="eyebrow" style={{ color: 'var(--fg-secondary)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginTop: 28, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        {[
          { id: 'library', l: 'Library' },
          { id: 'highlights', l: 'Highlights' },
          { id: 'tags', l: 'Tags' },
          { id: 'replies', l: 'Replies' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn"
            style={{
              background: 'transparent', borderRadius: 0, padding: '10px 18px',
              borderBottom: tab === t.id ? '2px solid var(--red-pencil)' : '2px solid transparent',
              color: tab === t.id ? 'var(--graphite-900)' : 'var(--fg-secondary)',
              fontWeight: 600, fontSize: 13, marginBottom: -1
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'library' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(personPieces.length ? personPieces : PIECES.slice(0, 4)).map(p => (
            <FeedCard key={p.id} piece={p} variant="dense" state={state[p.id] || {}} onLike={() => {}} onBookmark={() => {}} onOpen={() => onOpen(p.id)} onPerson={onPerson}/>
          ))}
        </div>
      )}
      {tab === 'highlights' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[
            { q: 'readerly attention', src: 'The slow web is still the better web', col: 'yellow' },
            { q: 'the dark forest', src: 'The Three-Body Problem', col: 'blue' },
            { q: 'subtraction of weight', src: 'Six Memos', col: 'yellow' },
            { q: 'this is the part I keep coming back to', src: 'The slow web', col: 'red' },
            { q: 'narrow, deeply-felt problem', src: '@patio11 thread', col: 'red' },
            { q: 'the bookshelf-as-autobiography', src: 'What we lose when we lose paper', col: 'sage' },
          ].map((h, i) => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.5, margin: 0 }}>
                &ldquo;<span className={`hl-${h.col}`}>{h.q}</span>&rdquo;
              </p>
              <div className="sans" style={{ fontSize: 12, color: 'var(--fg-secondary)', marginTop: 10 }}>
                from <em style={{ color: 'var(--graphite-900)' }}>{h.src}</em>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'tags' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {DISCOVER_TAGS.map(t => (
            <span key={t.tag} style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, padding: '8px 14px', borderRadius: 4, background: '#fff', boxShadow: 'var(--shadow-xs)', color: 'var(--graphite-900)' }}>
              <span style={{ color: t.ink }}>&bull;</span> {t.tag} <span style={{ color: 'var(--fg-tertiary)', marginLeft: 4 }}>{t.count}</span>
            </span>
          ))}
        </div>
      )}
      {tab === 'replies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { piece: 'The slow web is still the better web', text: 'or: the revenge of the unfinished essay', author: 'jules' },
            { piece: 'On building things that last', text: 'gospel for the next 5 years', author: 'maya' },
            { piece: 'The Three-Body Problem', text: 'reading club thursday?', author: 'maya' },
          ].map((r, i) => (
            <div key={i} className="card" style={{ padding: 18 }}>
              <div className="sans" style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 6 }}>
                replied on <em style={{ color: 'var(--graphite-900)' }}>{r.piece}</em>
              </div>
              <div style={{ fontFamily: 'var(--font-hand)', fontSize: 21, color: PEOPLE[r.author].ink }}>
                {r.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FollowButton() {
  const [f, setF] = useState(false);
  return <button onClick={() => setF(x => !x)} className={f ? 'btn btn-ghost' : 'btn btn-primary'} style={{ padding: '6px 14px', fontSize: 13 }}>{f ? 'Following' : 'Follow'}</button>;
}

function Discover({ onOpen, onPerson }: { onOpen: (id: string) => void; onPerson: (id: string) => void }) {
  const trending = [PIECES[2], PIECES[1], PIECES[5]];
  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 24px 96px' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 600, letterSpacing: '-0.014em', margin: 0 }}>Discover</h1>
      <p className="sans" style={{ fontSize: 14, color: 'var(--fg-secondary)', margin: '4px 0 32px' }}>Pieces marked up by readers like the ones you follow.</p>

      <div className="eyebrow" style={{ marginBottom: 16 }}>Most marked this week</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
        {trending.map(p => (
          <FeedCard key={p.id} piece={p} variant="dense" state={{}} onLike={() => {}} onBookmark={() => {}} onOpen={() => onOpen(p.id)} onPerson={onPerson}/>
        ))}
      </div>

      <div className="eyebrow" style={{ marginBottom: 16 }}>Threads to follow</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 40 }}>
        {DISCOVER_TAGS.map(t => (
          <button key={t.tag} className="card" style={{ padding: '12px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: '#fff' }}>
            <span style={{ color: t.ink, fontSize: 18 }}>&bull;</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--graphite-900)' }}>{t.tag}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--fg-tertiary)' }}>{t.count} marks</span>
          </button>
        ))}
      </div>

      <div className="eyebrow" style={{ marginBottom: 16 }}>People you might follow</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {Object.values(PEOPLE).filter(p => p.id !== 'you' && p.id !== 'maya').map(p => (
          <div key={p.id} className="card" style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div onClick={() => onPerson(p.id)} style={{ cursor: 'pointer' }}>
              <Avatar person={p} size={44}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div onClick={() => onPerson(p.id)} style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600 }}>{p.name}</div>
              <div className="sans" style={{ fontSize: 12, color: 'var(--fg-secondary)', marginBottom: 8 }}>@{p.handle}</div>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.45, color: 'var(--graphite-800)', margin: 0 }}>{p.bio}</p>
            </div>
            <FollowButton/>
          </div>
        ))}
      </div>
    </div>
  );
}

function Notifications({ onOpen, onPerson }: { onOpen: (id: string) => void; onPerson: (id: string) => void }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 96px' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 600, letterSpacing: '-0.014em', margin: 0 }}>Activity</h1>
      <p className="sans" style={{ fontSize: 14, color: 'var(--fg-secondary)', margin: '4px 0 32px' }}>Replies, follows, and reannotations from your reading network.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {ACTIVITY.map((a, i) => {
          const who = PEOPLE[a.who];
          const target = a.target ? PIECES.find(p => p.id === a.target) : null;
          const verb = a.kind === 'reply' ? 'replied to your annotation on'
                     : a.kind === 'follow' ? 'started following you'
                     : a.kind === 'reannotate' ? 'reannotated your piece'
                     : a.kind === 'like' ? 'liked your annotation on'
                     : a.kind === 'mention' ? 'mentioned you on'
                     : '';
          const iconName = a.kind === 'reply' ? 'reply' : a.kind === 'follow' ? 'plus' : a.kind === 'reannotate' ? 'share' : a.kind === 'like' ? 'heart-fill' : a.kind === 'mention' ? 'note' : 'bell';
          const iconColor = a.kind === 'like' ? 'var(--red-pencil)' : a.kind === 'follow' ? 'var(--sage)' : 'var(--graphite-700)';
          return (
            <div key={a.id} style={{
              padding: '18px 22px', display: 'flex', gap: 14, alignItems: 'flex-start',
              borderBottom: i < ACTIVITY.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              cursor: target ? 'pointer' : 'default'
            }} onClick={() => target ? onOpen(target.id) : onPerson(who.id)}>
              <div style={{ position: 'relative' }}>
                <Avatar person={who} size={36}/>
                <span style={{
                  position: 'absolute', bottom: -2, right: -4, width: 18, height: 18,
                  background: '#fff', borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'var(--shadow-xs)'
                }}>
                  <Icon name={iconName} size={10} stroke={2} color={iconColor}/>
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sans" style={{ fontSize: 13, color: 'var(--graphite-800)' }}>
                  <strong style={{ color: 'var(--graphite-900)' }}>{who.name}</strong> {verb}
                  {target && <em style={{ color: 'var(--graphite-900)', fontStyle: 'normal', fontWeight: 600 }}> &ldquo;{target.title}&rdquo;</em>}
                </div>
                {a.preview && (
                  <div style={{ fontFamily: 'var(--font-hand)', fontSize: 18, color: who.ink, marginTop: 4, transform: 'rotate(-0.5deg)', display: 'inline-block' }}>
                    {a.preview}
                  </div>
                )}
                <div className="sans" style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 4 }}>{a.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Shell — Nav, TopBar, Compose Modal
   ============================================================ */

function AppNav({ route, onNavigate }: { route: string | null; onNavigate: (r: string) => void }) {
  const items = [
    { id: 'feed', l: 'Home', icon: 'home' },
    { id: 'discover', l: 'Discover', icon: 'compass' },
    { id: 'notifications', l: 'Activity', icon: 'bell', badge: 3 },
    { id: 'library', l: 'Library', icon: 'bookmark' },
  ];
  return (
    <aside style={{
      width: 240, flex: 'none',
      background: 'var(--paper-50)',
      borderRight: '1px solid var(--border-subtle)',
      padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 4,
      height: '100vh', position: 'sticky', top: 0,
    }}>
      <a href="/annotated" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', textDecoration: 'none', marginBottom: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/annotated/assets/logo-mark.svg" style={{ width: 26, height: 26 }} alt=""/>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 600, color: 'var(--graphite-900)' }}>Annotated</span>
      </a>

      {items.map(it => (
        <button key={it.id} onClick={() => onNavigate(it.id)} className="btn"
          style={{
            justifyContent: 'flex-start', background: route === it.id ? 'var(--paper-200)' : 'transparent',
            color: 'var(--graphite-900)', padding: '9px 12px', fontSize: 14, fontWeight: 500,
            position: 'relative'
          }}>
          <Icon name={it.icon} size={18} stroke={1.6} color={route === it.id ? 'var(--red-pencil)' : 'var(--graphite-700)'}/>
          <span>{it.l}</span>
          {it.badge && (
            <span style={{ marginLeft: 'auto', background: 'var(--red-pencil)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999 }}>{it.badge}</span>
          )}
        </button>
      ))}

      <div style={{ marginTop: 18, padding: '0 8px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Reading network</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Object.values(PEOPLE).filter(p => p.id !== 'you').slice(0, 5).map(p => (
            <button key={p.id} onClick={() => onNavigate('profile:' + p.id)} className="btn"
              style={{ justifyContent: 'flex-start', background: 'transparent', padding: '6px 8px', fontSize: 13 }}>
              <Avatar person={p} size={20}/>
              <span style={{ color: 'var(--graphite-800)' }}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
        <button onClick={() => onNavigate('profile:you')} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Avatar person={PEOPLE.you} size={28}/>
          <div>
            <div className="sans" style={{ fontSize: 13, fontWeight: 600 }}>You</div>
            <div className="sans" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>@you</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

function TopBar({ onSearch, onCompose }: { onSearch: (v: string) => void; onCompose: () => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const results = q.trim() ? [
    ...PIECES.filter(p => p.title.toLowerCase().includes(q.toLowerCase())).slice(0, 4).map(p => ({ kind: 'piece' as const, p })),
    ...Object.values(PEOPLE).filter(p => p.id !== 'you' && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 3).map(p => ({ kind: 'person' as const, p })),
  ] : [];
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'rgba(244,239,230,0.85)',
      backdropFilter: 'blur(10px) saturate(140%)',
      WebkitBackdropFilter: 'blur(10px) saturate(140%)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 16
    }}>
      <div style={{ position: 'relative', flex: 1, maxWidth: 480 }}>
        <input type="text" value={q} onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search pieces, people, tags…"
          style={{
            width: '100%', padding: '8px 12px 8px 34px',
            border: '1px solid var(--border)', borderRadius: 8,
            fontFamily: 'var(--font-sans)', fontSize: 13, background: '#fff',
            outline: 'none', boxSizing: 'border-box'
          }}/>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <Icon name="search" size={14} color="var(--fg-tertiary)"/>
        </span>
        {open && results.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: '#fff', borderRadius: 8, boxShadow: 'var(--shadow-lg)',
            padding: 6, maxHeight: 360, overflow: 'auto'
          }}>
            {results.map((r, i) => (
              <div key={i} style={{ padding: '8px 10px', display: 'flex', gap: 10, alignItems: 'center', borderRadius: 6, cursor: 'pointer' }}
                onMouseDown={() => {
                  if (r.kind === 'piece') onSearch('open:' + r.p.id);
                  else onSearch('person:' + r.p.id);
                  setOpen(false); setQ('');
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-100)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {r.kind === 'piece' ? (
                  <>
                    <MediaIcon type={(r.p as Piece).type} size={14}/>
                    <div style={{ flex: 1 }}>
                      <div className="sans" style={{ fontSize: 13, fontWeight: 500 }}>{r.p.title}</div>
                      <div className="sans" style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{(r.p as Piece).source}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <Avatar person={r.p as Person} size={22}/>
                    <div className="sans" style={{ fontSize: 13 }}>{r.p.name} <span style={{ color: 'var(--fg-tertiary)' }}>@{(r.p as Person).handle}</span></div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onCompose} className="btn btn-primary">
        <Icon name="pen" size={14} color="#fff"/>
        Annotate something
      </button>
    </div>
  );
}

function ComposeModal({ open, onClose, onCreate }: {
  open: boolean; onClose: () => void; onCreate: (data: Record<string, string>) => void;
}) {
  const [step, setStep] = useState(1);
  const [url, setUrl] = useState('');
  const [type, setType] = useState('article');
  const [title, setTitle] = useState('');
  const [highlight, setHighlight] = useState('');
  const [note, setNote] = useState('');
  const [ink, setInk] = useState('yellow');

  useEffect(() => {
    if (open) { setStep(1); setUrl(''); setTitle(''); setHighlight(''); setNote(''); setType('article'); setInk('yellow'); }
  }, [open]);

  if (!open) return null;

  function autodetect(u: string) {
    setUrl(u);
    if (/youtube\.com|youtu\.be/i.test(u)) { setType('youtube'); setTitle('On building things that last (with Brian Eno)'); }
    else if (/twitter|x\.com/i.test(u)) { setType('tweet'); setTitle('Thread on software companies that work'); }
    else if (/\.pdf/i.test(u)) { setType('pdf'); setTitle('PDF — 14 pages'); }
    else if (u) { setType('article'); setTitle('On the small joys of finishing things'); }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(31,29,26,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 14, width: 640, maxWidth: '100%',
        boxShadow: 'var(--shadow-xl)', position: 'relative', maxHeight: '90vh', overflow: 'auto'
      }}>
        <button onClick={onClose} className="btn btn-quiet" style={{ position: 'absolute', top: 12, right: 12, padding: 6 }}>
          <Icon name="x" size={16} color="var(--graphite-700)"/>
        </button>

        <div style={{ padding: '32px 36px 28px' }}>
          <div className="eyebrow" style={{ color: 'var(--red-pencil)', marginBottom: 6 }}>Step {step} of 3</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em', margin: 0 }}>
            {step === 1 ? 'Paste something worth marking up' : step === 2 ? 'Pick the line that mattered' : 'Add a note in the margin'}
          </h2>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: 'var(--graphite-700)', margin: '6px 0 24px' }}>
            {step === 1 ? 'A YouTube clip, an article, a PDF, a podcast — anything with a URL.' : step === 2 ? 'Highlight a phrase that\'s worth your friends\' attention.' : 'A line in your own voice. Pencil-first.'}
          </p>

          {step === 1 && (
            <div>
              <input type="text" value={url} onChange={e => autodetect(e.target.value)} autoFocus
                placeholder="https://…  (try youtube.com or substack.com)"
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid var(--border)', borderRadius: 8,
                  fontFamily: 'var(--font-mono)', fontSize: 14, background: 'var(--paper-50)',
                  outline: 'none', boxSizing: 'border-box'
                }}/>
              {url && (
                <div style={{ marginTop: 16, padding: 16, background: 'var(--paper-50)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <MediaIcon type={type} size={20}/>
                  <div>
                    <MediaLabel type={type}/>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, marginTop: 2 }}>{title || 'Loading title…'}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 17, lineHeight: 1.6, padding: 18, background: 'var(--paper-50)', borderRadius: 8, margin: 0 }}>
                We&rsquo;ve made a culture of starts. Bookmarks. Saved-for-laters. Tabs left open like{' '}
                <span onClick={() => setHighlight('monuments to good intentions')}
                  className={highlight === 'monuments to good intentions' ? `hl-${ink}` : ''}
                  style={{ cursor: 'pointer', textDecoration: highlight === 'monuments to good intentions' ? 'none' : 'underline', textDecorationStyle: 'dashed', textDecorationColor: 'var(--graphite-300)' }}>
                  monuments to good intentions
                </span>. The unread queue is a moral position now. To{' '}
                <span onClick={() => setHighlight('read a thing all the way to the end')}
                  className={highlight === 'read a thing all the way to the end' ? `hl-${ink}` : ''}
                  style={{ cursor: 'pointer', textDecoration: highlight === 'read a thing all the way to the end' ? 'none' : 'underline', textDecorationStyle: 'dashed', textDecorationColor: 'var(--graphite-300)' }}>
                  read a thing all the way to the end
                </span>{' '}
                is its own small art.
              </p>
              <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="eyebrow">Ink:</span>
                {['yellow','red','blue','sage'].map(c => (
                  <button key={c} onClick={() => setInk(c)} style={{
                    all: 'unset', cursor: 'pointer', width: 22, height: 22, borderRadius: 999,
                    background: c === 'yellow' ? 'var(--margin-yellow)' : c === 'red' ? 'var(--red-pencil)' : c === 'blue' ? 'var(--pencil-blue)' : 'var(--sage)',
                    boxShadow: ink === c ? '0 0 0 2px var(--bg), 0 0 0 4px var(--graphite-900)' : 'inset 0 0 0 1px rgba(255,255,255,0.3)',
                  }}/>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <textarea value={note} onChange={e => setNote(e.target.value)} autoFocus
                placeholder="add a note…"
                style={{
                  width: '100%', padding: 16, border: '1px dashed var(--border)', borderRadius: 8,
                  fontFamily: 'var(--font-hand)', fontSize: 22, lineHeight: 1.25,
                  color: 'var(--red-pencil)', minHeight: 120, resize: 'none', outline: 'none',
                  background: 'var(--paper-50)', boxSizing: 'border-box'
                }}/>
              <div className="sans" style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginTop: 8 }}>
                Tip: write the way you&rsquo;d write in pencil — short, specific, your voice.
              </div>

              {highlight && (
                <div style={{ marginTop: 20, padding: 18, background: 'var(--paper-50)', borderRadius: 8 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>Preview</div>
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: 15, lineHeight: 1.55, margin: 0 }}>
                    &ldquo;<span className={`hl-${ink}`}>{highlight}</span>&rdquo;
                  </p>
                  {note && (
                    <div style={{ fontFamily: 'var(--font-hand)', fontSize: 19, color: 'var(--red-pencil)', marginTop: 10, transform: 'rotate(-1deg)', display: 'inline-block' }}>
                      {note}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 36px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', background: 'var(--paper-50)', borderRadius: '0 0 14px 14px' }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="btn btn-ghost">
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          <button onClick={() => step < 3 ? setStep(step + 1) : (onCreate({ url, type, title, highlight, ink, note }), onClose())}
            className="btn btn-primary" disabled={step === 1 && !url}>
            {step < 3 ? 'Next' : 'Share annotation'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Main App Page
   ============================================================ */

export default function AnnotatedApp() {
  const [route, setRoute] = useState('feed');
  const [openId, setOpenId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState('maya');
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [appState, setAppState] = useState<Record<string, PieceState>>({});
  const [feedVariant] = useState('paper');

  function navigate(r: string) {
    if (r.startsWith('profile:')) { setProfileId(r.slice(8)); setRoute('profile'); }
    else { setRoute(r); }
  }

  function openPiece(id: string) { setOpenId(id); setRoute('piece'); }
  function openPerson(id: string) { setProfileId(id); setRoute('profile'); }
  function back() { setRoute('feed'); }

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  function toggleLike(id: string) {
    setAppState(s => ({ ...s, [id]: { ...s[id], liked: !(s[id]?.liked) } }));
  }
  function toggleBookmark(id: string) {
    setAppState(s => {
      const wasBookmarked = !!s[id]?.bookmarked;
      showToast(wasBookmarked ? 'Removed from library' : 'Saved to your library');
      return { ...s, [id]: { ...s[id], bookmarked: !wasBookmarked } };
    });
  }

  function handleSearch(v: string) {
    if (v.startsWith('open:')) openPiece(v.slice(5));
    if (v.startsWith('person:')) openPerson(v.slice(7));
  }

  function handleCreate() {
    showToast('Annotation shared.');
  }

  let screen;
  if (route === 'piece' && openId) {
    const piece = PIECES.find(p => p.id === openId);
    if (piece) {
      screen = <PieceDetail piece={piece} state={appState[openId] || {}}
        onLike={() => toggleLike(openId)} onBookmark={() => toggleBookmark(openId)}
        onPerson={openPerson} onBack={back}/>;
    }
  } else if (route === 'profile') {
    screen = <ProfilePage personId={profileId} state={appState} onOpen={openPiece} onPerson={openPerson} onBack={back}/>;
  } else if (route === 'discover') {
    screen = <Discover onOpen={openPiece} onPerson={openPerson}/>;
  } else if (route === 'notifications') {
    screen = <Notifications onOpen={openPiece} onPerson={openPerson}/>;
  } else if (route === 'library') {
    screen = <ProfilePage personId="you" state={appState} onOpen={openPiece} onPerson={openPerson} onBack={back}/>;
  } else {
    screen = <HomeFeed feedVariant={feedVariant} state={appState}
      onLike={toggleLike} onBookmark={toggleBookmark}
      onOpen={openPiece} onPerson={openPerson}/>;
  }

  const activeRoute = route === 'profile' && profileId !== 'you' ? null : (route === 'profile' && profileId === 'you' ? 'library' : route);

  return (
    <div className="annotated-root paper-grain" style={{ background: 'var(--paper-100)', minHeight: '100vh' }}>
      <div className="app-shell">
        <AppNav route={activeRoute} onNavigate={navigate}/>
        <main className="app-main">
          <TopBar onSearch={handleSearch} onCompose={() => setComposing(true)}/>
          <div className="app-content">
            {screen}
          </div>
        </main>

        <ComposeModal open={composing} onClose={() => setComposing(false)} onCreate={handleCreate}/>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
