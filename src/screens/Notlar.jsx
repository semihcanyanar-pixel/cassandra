import { useState, useRef, useLayoutEffect, useEffect } from 'preact/hooks';
import { NoteLines } from '../components/NoteLines.jsx';
import { Seg } from '../components/Seg.jsx';
import { actColor, inkKey } from '../components/ui.jsx';
import { IconLock, IconPlus } from '../icons.jsx';
import { filterNotes, categoryLabel, NOTE_CATEGORIES, toBlocks, toggleCheck } from '../lib/notes.js';
import { saveNote, saveNoteSize } from '../data.js';

const FILTERS = [{ value: 'all', label: 'Hepsi' }, ...NOTE_CATEGORIES];
const LAYOUT_KEY = 'cassandra.notes.layout';
const readLayout = () => { try { return localStorage.getItem(LAYOUT_KEY) === 'manual' ? 'manual' : 'auto'; } catch { return 'auto'; } };

const AutoIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="16" rx="1.5" /><rect x="13" y="4" width="7" height="9" rx="1.5" /></svg>
);
const ResizeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M20 13l-7 7M20 17l-3 3" /></svg>
);

export function Notlar({ me, ctx, house, data, nav, onSettings }) {
  const [filter, setFilter] = useState('all');
  const [layout, setLayoutState] = useState(readLayout); // 'auto': two columns, long notes fade out | 'manual': windows you resize yourself
  const setLayout = (v) => { setLayoutState(v); try { localStorage.setItem(LAYOUT_KEY, v); } catch { /* ignore */ } };
  const notes = filterNotes(house.notes, data.notes, filter);
  const left = notes.filter((_, i) => i % 2 === 0), right = notes.filter((_, i) => i % 2 === 1);
  const card = (n, manual) => <NoteCard key={`${n.category}-${n.id}`} n={n} ctx={ctx} manual={manual} onOpen={() => nav.go({ n: 'note', id: n.id, category: n.category })} />;

  return (
    <main class="screen">
      <div class="topbar">
        <h1 style="font-size:40px">Notlar</h1>
        <button class={`avatar p${me.slot ?? 0}`} aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
      </div>

      <Seg items={FILTERS} value={filter} onChange={setFilter} label="Kategori" />

      <div class="row" style="gap:10px">
        <button class="btn grow" onClick={() => nav.go({ n: 'note', category: filter === 'all' ? 'aile' : filter })}><IconPlus />Not ekle</button>
        <button type="button" class={layout === 'manual' ? 'chip on layout-btn' : 'chip layout-btn'} aria-pressed={layout === 'manual'}
          aria-label={layout === 'manual' ? 'Notlar elle boyutlandırılıyor, otomatik düzene geç' : 'Notlar otomatik, elle boyutlandırmaya geç'}
          onClick={() => setLayout(layout === 'manual' ? 'auto' : 'manual')}>{layout === 'manual' ? <ResizeIcon /> : <AutoIcon />}</button>
      </div>

      {notes.length === 0 && <div class="card empty"><div class="title-sm">Not yok</div><div class="sub">İlk notunu ekle.</div></div>}

      {layout === 'manual' ? (
        <div class="note-flow">{notes.map((n) => card(n, true))}</div>
      ) : (
        <div class="note-cols">
          {[left, right].map((col, ci) => <div class="note-col" key={ci}>{col.map((n) => card(n, false))}</div>)}
        </div>
      )}
    </main>
  );
}

const MAX_LINES = 40; // the card only renders this many lines; CSS cuts it to a fixed height anyway
const MIN_W = 0.28, MIN_H = 64, MAX_H = 1200;
// Width as a fraction of the row; the gap share is subtracted so two cards of 0.5 (or 0.4 + 0.6) fill a row with a 10px gap.
const widthCss = (w) => `calc(${(w * 100).toFixed(2)}% - ${((1 - w) * 10).toFixed(2)}px)`;

function NoteCard({ n, ctx, onOpen, manual }) {
  const personal = n.category === 'kisisel';
  const all = toBlocks(n);
  const blocks = all.map((b, idx) => ({ ...b, idx })).filter((b) => b.t);
  const shown = blocks.slice(0, MAX_LINES);
  // Ticking a round checkbox on the card saves the note right away (no need to open it).
  const tick = (idx) => saveNote(ctx, n.category, n.id, { blocks: toggleCheck(all, idx) });
  const box = useRef(null);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => { const el = box.current; if (el) setClipped(el.clientHeight >= 170 && el.scrollHeight > el.clientHeight + 1); }); // clipped only when the height cap was reached
  const more = !manual && (clipped || blocks.length > shown.length);

  // Manual layout: size = { w: fraction of the row width, h: px }. While dragging, the element is resized directly (no re-render).
  const root = useRef(null);
  const [local, setLocal] = useState(null);
  useEffect(() => { setLocal(null); }, [n.size?.w, n.size?.h]);
  const size = manual ? (local || n.size || null) : null;
  const drag = useRef(null);
  const onDown = (mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = root.current.getBoundingClientRect();
    drag.current = { mode, x: e.clientX, y: e.clientY, w: r.width, h: r.height, row: root.current.parentElement.getBoundingClientRect().width, out: null };
  };
  const onMove = (e) => {
    const d = drag.current; if (!d) return;
    const w = d.mode === 'b' ? d.w : Math.min(d.row, Math.max(d.row * MIN_W, d.w + e.clientX - d.x));
    const h = d.mode === 'r' ? d.h : Math.min(MAX_H, Math.max(MIN_H, d.h + e.clientY - d.y));
    d.out = { w: Math.round((w / d.row) * 1000) / 1000, h: Math.round(h) };
    root.current.style.width = widthCss(d.out.w); root.current.style.height = `${d.out.h}px`;
    root.current.classList.add('sized');
  };
  const onUp = () => {
    const d = drag.current; drag.current = null;
    if (d?.out) { setLocal(d.out); saveNoteSize(ctx, n.category, n.id, d.out); }
  };
  const grip = (mode) => ({ onPointerDown: onDown(mode), onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp });
  const style = `--c:${actColor(n.color)};${manual ? `width:${widthCss(size?.w ?? 0.5)};${size?.h ? `height:${size.h}px;` : ''}` : ''}`;

  return (
    <div ref={root} class={`note ${personal ? 'personal' : ''} ${manual ? 'manual' : ''} ${size ? 'sized' : ''}`} data-c={inkKey(n.color)} style={style}>
      <button type="button" class="note-open" onClick={onOpen} aria-label={`${categoryLabel(NOTE_CATEGORIES, n.category)} notu: ${n.title || 'Başlıksız'} — aç`} />
      <span class="note-tag">{n.pinned && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-label="Sabit"><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" /></svg>}{personal && <IconLock small />}{categoryLabel(NOTE_CATEGORIES, n.category).toUpperCase()}</span>
      {n.title && <span class="note-title">{n.title}</span>}
      {n.files?.length > 0 && (
        <span class="note-att"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" /></svg>{n.files.length} ek</span>
      )}
      {shown.length > 0 && (
        <>
          <span class={more ? 'note-lines clipped' : 'note-lines'} ref={box}><NoteLines blocks={shown} onTick={tick} /></span>
          {more && <span class="note-more">Devamı</span>}
        </>
      )}
      {manual && <><span class="rz rz-r" {...grip('r')} /><span class="rz rz-b" {...grip('b')} /><span class="rz rz-c" {...grip('c')} /></>}
    </div>
  );
}
