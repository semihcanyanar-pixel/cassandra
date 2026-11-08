import { useEffect, useRef, useState } from 'preact/hooks';
import { Page, actColor, inkKey } from '../components/ui.jsx';
import { ColorPicker } from '../components/ColorPicker.jsx';
import { NOTE_CATEGORIES, NOTE_LIMITS, noteLength, noteScope, normalizeCategory, toBlocks, cleanBlocks, normBlock, toggleCheck, categoryLabel, effectivePin, visibleBlocks } from '../lib/notes.js';
import { NoteLines } from '../components/NoteLines.jsx';
import { NoteEditor } from '../components/NoteEditor.jsx';
import { saveNote, deleteNote, setNotePrefs } from '../data.js';
import { IconLock, IconClose } from '../icons.jsx';
import { Attachments } from '../components/Attachments.jsx';
import { useTheme } from '../theme.js';
import { filesEnabled, uploadFile, deleteFile, compressImage, isImage, MAX_FILE_BYTES } from '../files.js';

const Ico = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>
);
// Line kinds the toolbar can switch to (tap again = back to plain text).
const KIND_BUTTONS = [
  { k: 'h', label: 'Başlık', short: 'Başlık', icon: <b class="fi">H</b> },
  { k: 's', label: 'Alt başlık', short: 'Alt', icon: <b class="fi sm">H</b> },
  { k: 'ul', label: 'Madde', short: 'Madde', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="7" r="2" /><circle cx="5" cy="17" r="2" /><path d="M10 7h10M10 17h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" /></svg> },
  { k: 'ol', label: 'Numara', short: 'Numara', icon: <b class="fi sm">1.</b> },
  { k: 'cb', label: 'Yuvarlak', short: 'Daire', icon: <span class="circ-icon" aria-hidden="true" /> },
];
const FLAG_BUTTONS = [
  { f: 'b', label: 'Kalın', short: 'Kalın', icon: <b class="fi">B</b> },
  { f: 'i', label: 'İtalik', short: 'İtalik', icon: <i class="fi">I</i> },
  { f: 's', label: 'Üstü çizili', short: 'Çizgi', icon: <s class="fi">S</s> },
];
const AlignIc = ({ rows }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">{rows.map((r, i) => <path key={i} d={`M${r[0]} ${5 + i * 5}H${r[1]}`} />)}</svg>
);
const ALIGN_BUTTONS = [
  { a: '', label: 'Sola yasla', icon: <AlignIc rows={[[4, 20], [4, 14], [4, 18], [4, 12]]} /> },
  { a: 'c', label: 'Ortala', icon: <AlignIc rows={[[4, 20], [7, 17], [5, 19], [8, 16]]} /> },
  { a: 'r', label: 'Sağa yasla', icon: <AlignIc rows={[[4, 20], [10, 20], [6, 20], [12, 20]]} /> },
  { a: 'j', label: 'İki yana yasla', icon: <AlignIc rows={[[4, 20], [4, 20], [4, 20], [4, 20]]} /> },
];
const Lbl = ({ children }) => <span class="fl">{children}</span>;
const lsGet = (k, fallback) => { try { return localStorage.getItem(k) || fallback; } catch { return fallback; } };

// How the notes list looks for ME (same rules as Notlar.jsx): the opened note is a much bigger version of its small card.
function useNoteLook(data) {
  const mozaik = useTheme() === 'mozaik';
  const ui = data.notePrefs?.ui || {};
  const paper = ui.paper ?? lsGet('cassandra.notes.paper', 'color');
  const corners = ui.corners ?? lsGet('cassandra.notes.corners', 'round');
  const full = mozaik && paper !== 'frame'; // the whole card is painted in the note colour (Mozaik, full colour paper)
  const wrap = `${corners === 'square' ? 'notes-square' : ''} ${mozaik && paper === 'frame' ? 'notes-framed' : ''}`.trim();
  return { full, wrap };
}

export function NoteForm({ ctx, data, house, id, category: initialCategory, nav }) {
  const look = useNoteLook(data);
  const existing = id ? (initialCategory === 'kisisel' ? data.notes : house.notes).find((n) => n.id === id) : null;
  // A half-written note is kept as a draft on this phone, so leaving by accident (or an app reload) does not lose it.
  const dkey = `cassandra.draft.${ctx.uid}.${id || 'yeni'}`;
  const draft = useRef(undefined);
  if (draft.current === undefined) { try { draft.current = JSON.parse(localStorage.getItem(dkey) || 'null'); } catch { draft.current = null; } }
  const d0 = draft.current;
  const base = { title: existing?.title || '', color: existing?.color ?? 0, pinned: existing ? effectivePin({ ...existing, category: normalizeCategory(initialCategory) }, data.notePrefs) : false, blocks: toBlocks(existing), files: existing?.files || [], category: normalizeCategory(existing?.category || initialCategory) };
  const [restored, setRestored] = useState(Boolean(d0));
  // An existing note opens in a read-only view first (a restored draft goes straight to editing).
  const [reading, setReading] = useState(Boolean(existing) && !d0);
  const [category, setCategory] = useState(d0 && !existing ? normalizeCategory(d0.category) : base.category);
  const [title, setTitle] = useState(d0 ? d0.title : base.title);
  const [blocks, setBlocks] = useState(() => { const b = d0 ? (d0.blocks || []).map(normBlock) : base.blocks; return b.length ? b : [normBlock({})]; });
  const [color, setColor] = useState(d0 ? d0.color : base.color);
  const [pinned, setPinned] = useState(d0 ? Boolean(d0.pinned) : base.pinned);
  const [error, setError] = useState('');
  const [cur, setCur] = useState(0); // the line being edited
  const [files, setFiles] = useState(d0 ? d0.files || [] : base.files);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const originals = useRef(new Set((existing?.files || []).map((f) => f.id)));
  const removedOriginals = useRef([]);
  const scope = noteScope(category) === 'personal' ? 'personal' : 'family';
  const ed = useRef(null); // the editor's commands (see components/NoteEditor.jsx)
  const [hist, setHist] = useState({ undo: false, redo: false });
  const row = blocks[cur] || blocks[0];
  const setKind = (k) => ed.current?.setKind(k);
  const toggleFlag = (f) => ed.current?.toggleFlag(f);
  const setAlign = (a) => ed.current?.setAlign(a);
  const indent = (d) => ed.current?.indent(d);
  const move = (d) => ed.current?.move(d);
  const removeLine = () => ed.current?.removeLines();

  async function addFiles(list) {
    setBusy(true); setError('');
    for (const f of [...list]) {
      try {
        const isPdf = f.type === 'application/pdf' || /.pdf$/i.test(f.name);
        if (!isImage(f.type) && !isPdf) throw Object.assign(new Error('type'), { code: 'type' });
        const file = isImage(f.type) ? await compressImage(f) : f;
        if (file.size > MAX_FILE_BYTES) throw Object.assign(new Error('big'), { code: 'too-large' });
        const meta = await uploadFile(file, scope);
        setFiles((cur) => [...cur, meta]);
      } catch (e) {
        setError(e.code === 'too-large' ? 'Dosya 20 MB’tan büyük olamaz.' : e.code === 'type' ? 'Yalnızca resim ve PDF eklenebilir.' : 'Dosya yüklenemedi, tekrar dene.');
      }
    }
    setBusy(false); setAddOpen(false);
  }
  const removeFile = (f) => {
    setFiles((cur) => cur.filter((x) => x.id !== f.id));
    if (originals.current.has(f.id)) removedOriginals.current.push(f.id); else deleteFile(f.id); // new this session: gone right away
  };
  const sig = (t, c, b, f, p, cat) => JSON.stringify([t.trim(), c, cleanBlocks(b), f.map((x) => x.id), p, cat]);
  const dirty = sig(title, color, blocks, files, pinned, category) !== sig(base.title, base.color, base.blocks, base.files, base.pinned, base.category);
  useEffect(() => {
    try {
      if (dirty) localStorage.setItem(dkey, JSON.stringify({ title, color, pinned, blocks, files, category }));
      else localStorage.removeItem(dkey);
    } catch { /* storage unavailable: no draft */ }
  });
  const clearDraft = () => { try { localStorage.removeItem(dkey); } catch { /* ignore */ } };
  // Back to the saved version (drops the draft and the files uploaded since).
  const discardDraft = () => {
    files.filter((f) => !originals.current.has(f.id)).forEach((f) => deleteFile(f.id));
    removedOriginals.current = [];
    setTitle(base.title); setColor(base.color); setPinned(base.pinned); setFiles(base.files); setCategory(base.category);
    setBlocks(base.blocks.length ? base.blocks : [normBlock({})]);
    setRestored(false); clearDraft();
  };
  // Leaving without saving asks first; files uploaded in this session would be orphans, so they are deleted.
  const close = () => {
    if (dirty && !confirm('Kaydedilmemiş değişiklikler silinsin mi?')) return;
    files.filter((f) => !originals.current.has(f.id)).forEach((f) => deleteFile(f.id));
    clearDraft();
    nav.back();
  };

  function submit(e) {
    e.preventDefault();
    const clean = cleanBlocks(blocks);
    if (!title.trim() && clean.length === 0 && files.length === 0) { setError('Boş not kaydedilemez.'); return; }
    if (noteLength(clean) > NOTE_LIMITS.total) { setError(`Not çok uzun: en çok ${NOTE_LIMITS.total.toLocaleString('tr-TR')} karakter olabilir. Fazlasını ikinci bir nota taşı.`); return; }
    if (clean.length > NOTE_LIMITS.lines) { setError(`Not en çok ${NOTE_LIMITS.lines} satır olabilir.`); return; }
    const moved = Boolean(existing) && category !== base.category; // the category was changed: the note moves between personal and shared
    if (moved && !confirm(category === 'kisisel' ? 'Bu not kişisel olacak, eşin artık göremeyecek. Devam edilsin mi?' : 'Bu not aileye taşınacak, eşin de görecek ve düzenleyebilecek. Devam edilsin mi?')) return;
    clearDraft();
    const payload = { title: title.trim(), color, blocks: clean, body: '', items: null, files };
    const written = moved ? saveNote(ctx, category, null, payload) : saveNote(ctx, category, id, payload);
    if (moved) deleteNote(ctx, base.category, id); // new note in the other place, then remove the old one
    // The pin is part of MY layout (users/{uid}/prefs/notes), not of the note, so the partner's list is not affected.
    if (!existing || moved) { if (pinned) written.then((r) => r?.id && setNotePrefs(ctx.uid, { pins: { [`${category}_${r.id}`]: true } })); }
    else if (pinned !== base.pinned) setNotePrefs(ctx.uid, { pins: { [`${category}_${id}`]: pinned } });
    removedOriginals.current.forEach(deleteFile);
    nav.back();
  }
  const remove = () => { if (confirm('Not silinsin mi?')) { files.forEach((f) => deleteFile(f.id)); clearDraft(); deleteNote(ctx, base.category, id); nav.back(); } };
  const keep = (e) => e.preventDefault(); // keep the keyboard open when a toolbar button is tapped

  const total = noteLength(blocks);
  const tickRead = (idx) => saveNote(ctx, base.category, id, { blocks: toggleCheck(toBlocks(existing), idx) });
  const canSwitch = files.length === 0;
  const toggleCategory = () => {
    if (!canSwitch) { setError('Eki olan notun kategorisi değiştirilemez, çünkü dosyalara erişim kategoriye bağlıdır.'); return; }
    setCategory((c) => (c === 'kisisel' ? 'aile' : 'kisisel'));
  };

  // Reading view: the note opens as a big card over a dimmed screen, drawn like its small card (full colour only when the notes list is full colour).
  if (reading && existing) {
    const rb = visibleBlocks(toBlocks(existing));
    const col = look.full;
    return (
      <div class={`nsheet-bg ${look.wrap}`} onClick={(e) => { if (e.target === e.currentTarget) nav.back(); }}>
        <article class={`note big ${col ? 'big-col' : ''}`} data-c={inkKey(existing.color)} style={`--c:${actColor(existing.color)}`}>
          <div class="sheet-top">
            <span class="note-tag">{base.category === 'kisisel' && <IconLock small />}{categoryLabel(NOTE_CATEGORIES, base.category).toUpperCase()}</span>
            <button type="button" class="sheet-x" aria-label="Kapat" onClick={nav.back}><IconClose /></button>
          </div>
          {existing.title && <h1 class="sheet-title">{existing.title}</h1>}
          <div class="note-read-lines"><NoteLines blocks={rb} onTick={tickRead} circleOnly /></div>
          {rb.length === 0 && !existing.title && <div class="sheet-empty">Bu notta yazı yok.</div>}
          {(existing.files || []).length > 0 && <div class="sheet-files"><Attachments files={existing.files} /></div>}
          <div class="sheet-footer"><button class="sheet-edit" type="button" onClick={() => setReading(false)}>Düzenle</button></div>
        </article>
      </div>
    );
  }

  return (
    <form onSubmit={submit} class={look.full ? 'nf-colored' : ''} data-c={inkKey(color)} style={look.full ? `--c:${actColor(color)}` : ''}>
      <Page title={existing ? 'Notu düzenle' : 'Yeni not'} onClose={close} footer={<button class="btn wide" type="submit" disabled={busy}>Kaydet</button>}>
        {restored && (
          <div class="nf-draft">
            <span>Yarım kalan not geri yüklendi.</span>
            <button type="button" class="nf-link" onClick={() => { if (confirm('Taslak silinsin mi?')) discardDraft(); }}>Taslağı at</button>
          </div>
        )}
        <div class="nf-box">
          <div class="nf-bar" role="toolbar" aria-label="Not ayarları">
            <button type="button" class="nf-cat" onClick={toggleCategory} aria-label={`Kategori: ${categoryLabel(NOTE_CATEGORIES, category)}. Değiştirmek için dokun`}>
              {category === 'kisisel' && <IconLock small />}{categoryLabel(NOTE_CATEGORIES, category)}
            </button>
            {filesEnabled && (
              <button type="button" class={addOpen || files.length ? 'nf-ico on' : 'nf-ico'} aria-label="Resim ya da PDF ekle" aria-expanded={addOpen} onClick={() => setAddOpen((o) => !o)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" /></svg>
              </button>
            )}
            <button type="button" class={pinned ? 'nf-ico on' : 'nf-ico'} aria-pressed={pinned} aria-label="Başa sabitle" onClick={() => setPinned(!pinned)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" /></svg>
            </button>
            <span class="fmt-sep" aria-hidden="true" />
            <button type="button" class="nf-ico" disabled={!hist.undo} aria-label="Geri al" title="Geri al" onMouseDown={keep} onClick={() => ed.current?.undo()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
            </button>
            <button type="button" class="nf-ico" disabled={!hist.redo} aria-label="İleri al" title="İleri al" onMouseDown={keep} onClick={() => ed.current?.redo()}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></svg>
            </button>
            <span class="fmt-sep" aria-hidden="true" />
            <ColorPicker value={color} onChange={setColor} label="Not rengi" />
          </div>
          {addOpen && filesEnabled && (
            <div class="row nf-add">
              <label class="chip small filebtn">Resim ekle<input class="vh" type="file" accept="image/*" multiple disabled={busy} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} /></label>
              <label class="chip small filebtn">PDF ekle<input class="vh" type="file" accept="application/pdf" multiple disabled={busy} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} /></label>
              <span class="sub">En çok 20 MB</span>
            </div>
          )}
          {files.length > 0 && <div class="nf-files"><Attachments files={files} onRemove={removeFile} busy={busy} /></div>}
          {files.length === 0 && busy && <div class="loadbar" role="progressbar" aria-label="Yükleniyor"><i /></div>}

          <div class="fmtbar" role="toolbar" aria-label="Biçim araçları">
            {KIND_BUTTONS.map((x) => (
              <button key={x.k} type="button" class={row.k === x.k ? 'fmt on' : 'fmt'} aria-pressed={row.k === x.k} aria-label={x.label} title={x.label} onMouseDown={keep} onClick={() => setKind(x.k)}>{x.icon}<Lbl>{x.short}</Lbl></button>
            ))}
            <span class="fmt-sep" aria-hidden="true" />
            {FLAG_BUTTONS.map((x) => (
              <button key={x.f} type="button" class={row[x.f] ? 'fmt on' : 'fmt'} aria-pressed={Boolean(row[x.f])} aria-label={x.label} title={x.label} onMouseDown={keep} onClick={() => toggleFlag(x.f)}>{x.icon}<Lbl>{x.short}</Lbl></button>
            ))}
            <span class="fmt-sep" aria-hidden="true" />
            {ALIGN_BUTTONS.map((x) => (
              <button key={x.a || 'l'} type="button" class={(row.a || '') === x.a ? 'fmt on' : 'fmt'} aria-pressed={(row.a || '') === x.a} aria-label={x.label} title={x.label} onMouseDown={keep} onClick={() => setAlign(x.a)}>{x.icon}</button>
            ))}
            <span class="fmt-sep" aria-hidden="true" />
            <button type="button" class="fmt" aria-label="Girinti ekle" title="Girinti ekle" disabled={row.l >= 2} onMouseDown={keep} onClick={() => indent(1)}><Ico d="M5 12h14M13 6l6 6-6 6" /><Lbl>Girinti</Lbl></button>
            <button type="button" class="fmt" aria-label="Girintiyi azalt" title="Girintiyi azalt" disabled={row.l <= 0} onMouseDown={keep} onClick={() => indent(-1)}><Ico d="M19 12H5M11 6l-6 6 6 6" /><Lbl>Geri</Lbl></button>
            <span class="fmt-sep" aria-hidden="true" />
            <button type="button" class="fmt" aria-label="Satırı yukarı taşı" title="Satırı yukarı taşı" disabled={cur === 0} onMouseDown={keep} onClick={() => move(-1)}><Ico d="M12 19V5M6 11l6-6 6 6" /><Lbl>Yukarı</Lbl></button>
            <button type="button" class="fmt" aria-label="Satırı aşağı taşı" title="Satırı aşağı taşı" disabled={cur >= blocks.length - 1} onMouseDown={keep} onClick={() => move(1)}><Ico d="M12 5v14M6 13l6 6 6-6" /><Lbl>Aşağı</Lbl></button>
            <button type="button" class="fmt" aria-label="Satırı sil" title="Satırı sil" onMouseDown={keep} onClick={removeLine}><Ico d="M6 6l12 12M18 6L6 18" /><Lbl>Satırı sil</Lbl></button>
          </div>

          <input id="baslik" class="nf-title" value={title} maxLength={NOTE_LIMITS.title} placeholder="Başlık" aria-label="Başlık" onInput={(e) => { setTitle(e.target.value); setError(''); }} />

          <div class="nf-ed">
            <NoteEditor value={blocks} onChange={(b) => { setBlocks(b); setError(''); }} onActive={setCur} onHistory={setHist} apiRef={ed} placeholder="Notunu yaz…" />
          </div>
          {total > NOTE_LIMITS.total * 0.7 && (
            <div class={total > NOTE_LIMITS.total ? 'sub counter over' : 'sub counter'} aria-live="polite">{total.toLocaleString('tr-TR')} / {NOTE_LIMITS.total.toLocaleString('tr-TR')} karakter</div>
          )}
        </div>
        {error && <div class="error" role="alert">{error}</div>}
        {existing && <button type="button" class="chip" style="min-height:48px" onClick={remove}>Notu sil</button>}
      </Page>
    </form>
  );
}
