import { useState } from 'preact/hooks';
import { IconLock, IconPlus } from '../icons.jsx';
import { filterNotes, categoryLabel, NOTE_CATEGORIES } from '../lib/notes.js';

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

function NoteCard({ n, onOpen }) {
  const personal = n.category === 'kisisel';
  const lines = n.items ? n.items.slice(0, 6) : null;
  return (
    <button class={`note ${personal ? 'personal' : ''}`} style={`--c:var(--act-${n.color ?? 0})`} onClick={onOpen}
      aria-label={`${categoryLabel(NOTE_CATEGORIES, n.category)} notu: ${n.title || 'Başlıksız'}`}>
      <span class="note-tag">{personal && <IconLock small />}{categoryLabel(NOTE_CATEGORIES, n.category).toUpperCase()}</span>
      {n.title && <span class="note-title">{n.title}</span>}
      {lines ? (
        <span class="note-lines">
          {lines.map((l, i) => (
            <span class={l.done ? 'note-line done' : 'note-line'} key={i}><i class="box" />{l.t}</span>
          ))}
          {n.items.length > 6 && <span class="sub">+{n.items.length - 6} madde</span>}
        </span>
      ) : <span class="note-body">{n.body}</span>}
    </button>
  );
}
