import { useState, useRef, useLayoutEffect } from 'preact/hooks';
import { NoteLines } from '../components/NoteLines.jsx';
import { IconLock, IconPlus } from '../icons.jsx';
import { filterNotes, categoryLabel, NOTE_CATEGORIES, toBlocks, toggleCheck } from '../lib/notes.js';
import { saveNote } from '../data.js';

const FILTERS = [{ value: 'all', label: 'Hepsi' }, ...NOTE_CATEGORIES];

export function Notlar({ me, ctx, house, data, nav, onSettings }) {
  const [filter, setFilter] = useState('all');
  const notes = filterNotes(house.notes, data.notes, filter);
  const left = notes.filter((_, i) => i % 2 === 0), right = notes.filter((_, i) => i % 2 === 1);

  return (
    <main class="screen">
      <div class="topbar">
        <h1 style="font-size:40px">Notlar</h1>
        <button class={`avatar p${me.slot ?? 0}`} aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
      </div>

      <div class="scroll-chips" role="radiogroup" aria-label="Kategori">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={filter === f.value}
            class={filter === f.value ? 'chip on' : 'chip'} onClick={() => setFilter(f.value)}>
            {f.value === 'kisisel' && <IconLock small />}{f.label}
          </button>
        ))}
      </div>

      <button class="btn" onClick={() => nav.go({ n: 'note', category: filter === 'all' ? 'aile' : filter })}><IconPlus />Not ekle</button>

      {notes.length === 0 && <div class="card empty"><div class="title-sm">Not yok</div><div class="sub">İlk notunu ekle.</div></div>}

      <div class="note-cols">
        {[left, right].map((col, ci) => (
          <div class="note-col" key={ci}>
            {col.map((n) => <NoteCard key={`${n.category}-${n.id}`} n={n} ctx={ctx} onOpen={() => nav.go({ n: 'note', id: n.id, category: n.category })} />)}
          </div>
        ))}
      </div>
    </main>
  );
}

const MAX_LINES = 40; // the card only renders this many lines; CSS cuts it to a fixed height anyway

function NoteCard({ n, ctx, onOpen }) {
  const personal = n.category === 'kisisel';
  const all = toBlocks(n);
  const blocks = all.map((b, idx) => ({ ...b, idx })).filter((b) => b.t);
  const shown = blocks.slice(0, MAX_LINES);
  // Ticking a round checkbox on the card saves the note right away (no need to open it).
  const tick = (idx) => saveNote(ctx, n.category, n.id, { blocks: toggleCheck(all, idx) });
  const box = useRef(null);
  const [clipped, setClipped] = useState(false);
  useLayoutEffect(() => { const el = box.current; if (el) setClipped(el.clientHeight >= 170 && el.scrollHeight > el.clientHeight + 1); }); // clipped only when the height cap was reached
  const more = clipped || blocks.length > shown.length;
  return (
    <div class={`note ${personal ? 'personal' : ''}`} data-c={n.color ?? 0} style={`--c:var(--act-${n.color ?? 0})`}>
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
    </div>
  );
}
