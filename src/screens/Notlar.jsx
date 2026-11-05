import { useState } from 'preact/hooks';
import { IconLock, IconPlus } from '../icons.jsx';
import { filterNotes, categoryLabel, NOTE_CATEGORIES, toBlocks, numberLabels } from '../lib/notes.js';

const FILTERS = [{ value: 'all', label: 'Hepsi' }, ...NOTE_CATEGORIES];

export function Notlar({ me, house, data, nav, onSettings }) {
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
            {col.map((n) => <NoteCard key={`${n.category}-${n.id}`} n={n} onOpen={() => nav.go({ n: 'note', id: n.id, category: n.category })} />)}
          </div>
        ))}
      </div>
    </main>
  );
}

const MAX_LINES = 8;

function NoteCard({ n, onOpen }) {
  const personal = n.category === 'kisisel';
  const blocks = toBlocks(n).filter((b) => b.t);
  const labels = numberLabels(blocks);
  const shown = blocks.slice(0, MAX_LINES);
  return (
    <button class={`note ${personal ? 'personal' : ''}`} style={`--c:var(--act-${n.color ?? 0})`} onClick={onOpen}
      aria-label={`${categoryLabel(NOTE_CATEGORIES, n.category)} notu: ${n.title || 'Başlıksız'}`}>
      <span class="note-tag">{personal && <IconLock small />}{categoryLabel(NOTE_CATEGORIES, n.category).toUpperCase()}</span>
      {n.title && <span class="note-title">{n.title}</span>}
      {shown.length > 0 && (
        <span class="note-lines">
          {shown.map((b, i) => (
            <span class={`nl k-${b.k}`} key={i} style={`margin-left:${b.l * 12}px`}>
              {b.k === 'cb' && <i class={b.d ? 'nc on' : 'nc'}>{b.d && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</i>}
              {b.k === 'ul' && <i class="nm">•</i>}
              {b.k === 'ol' && <i class="nm">{labels[i]}</i>}
              <span class={`nt ${b.b ? 'b' : ''} ${b.i ? 'i' : ''} ${b.s || (b.k === 'cb' && b.d) ? 's' : ''}`}>{b.t}</span>
            </span>
          ))}
          {blocks.length > MAX_LINES && <span class="sub">+{blocks.length - MAX_LINES} satır</span>}
        </span>
      )}
    </button>
  );
}
