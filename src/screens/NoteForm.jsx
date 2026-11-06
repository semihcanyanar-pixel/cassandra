import { useEffect, useRef, useState } from 'preact/hooks';
import { Page, actColor, inkKey } from '../components/ui.jsx';
import { ColorPicker } from '../components/ColorPicker.jsx';
import { NOTE_CATEGORIES, NOTE_LIMITS, noteLength, noteScope, normalizeCategory, toBlocks, cleanBlocks, numberLabels, normBlock, plainText, toggleCheck, categoryLabel, effectivePin, visibleBlocks } from '../lib/notes.js';
import { NoteLines } from '../components/NoteLines.jsx';
import { LineEditor, serialize, placeCaret, splitAtCaret } from '../components/LineEditor.jsx';
import { saveNote, deleteNote, setNotePrefs } from '../data.js';
import { IconLock, IconClose } from '../icons.jsx';
import { Attachments } from '../components/Attachments.jsx';
import { filesEnabled, uploadFile, deleteFile, compressImage, isImage, MAX_FILE_BYTES } from '../files.js';

const Ico = ({ d }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
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

export function NoteForm({ ctx, data, house, id, category: initialCategory, nav }) {
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
  const refs = useRef([]);
  const focusAfter = useRef(null);
  const caretAfter = useRef(null);
  // Select all: each line is its own field, so the phone's own "Select all" only reaches one line. When a whole line is selected a button offers
  // "Tüm notu seç"; the whole note is then marked and can be copied, cut or deleted.
  const [allSel, setAllSel] = useState(false);
  const [wholeLine, setWholeLine] = useState(false);
  useEffect(() => {
    const on = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setWholeLine(false); return; }
      const node = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
      const el = node?.closest?.('.line-input');
      if (!el) { setWholeLine(false); return; }
      const strip = (t) => t.replace(/[\u200B\n]/g, '');
      const txt = strip(el.textContent);
      setWholeLine(txt.length > 0 && strip(sel.toString()).length >= txt.length);
    };
    document.addEventListener('selectionchange', on);
    return () => document.removeEventListener('selectionchange', on);
  }, []);
  const selectAllNote = () => { setAllSel(true); setWholeLine(false); window.getSelection()?.removeAllRanges(); document.activeElement?.blur?.(); }; // plain-text caret offset to restore in the line that gets focus

  useEffect(() => {
    if (focusAfter.current != null) {
      const el = refs.current[focusAfter.current];
      el?.focus();
      if (el && caretAfter.current != null) placeCaret(el, caretAfter.current);
      focusAfter.current = null; caretAfter.current = null;
    }
  });

  const upd = (i, patch) => setBlocks((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const row = blocks[cur] || blocks[0];
  const labels = numberLabels(blocks);

  const setKind = (k) => { upd(cur, { k: row.k === k ? 'p' : k, d: false }); focusAfter.current = cur; };
  // With text selected the format applies to the selection (word level); with just a cursor it applies to the whole line.
  const toggleFlag = (f) => {
    const el = refs.current[cur];
    const sel = window.getSelection();
    if (row[f]) { upd(cur, { [f]: false }); focusAfter.current = cur; return; } // a whole-line format is switched off by tapping its button again, selection or not
    if (el && sel && sel.rangeCount && !sel.isCollapsed && el.contains(sel.anchorNode) && el.contains(sel.focusNode)) {
      document.execCommand({ b: 'bold', i: 'italic', s: 'strikeThrough' }[f]); // applied to the selection, shows right away
      upd(cur, { t: serialize(el) });
    } else { upd(cur, { [f]: !row[f] }); focusAfter.current = cur; }
  };
  const noteText = () => {
    const lab = numberLabels(blocks);
    const body = blocks.map((b, i) => (b.k === 'ul' ? '• ' : b.k === 'ol' ? `${lab[i]} ` : b.k === 'cb' ? (b.d ? '[x] ' : '[ ] ') : '') + plainText(b.t)).join('\n');
    return (title.trim() ? `${title.trim()}\n` : '') + body;
  };
  const copyAll = async () => {
    const t = noteText();
    try { await navigator.clipboard.writeText(t); } catch {
      const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ } ta.remove();
    }
  };
  const clearAll = () => { setBlocks([normBlock({})]); setTitle(''); setAllSel(false); setCur(0); focusAfter.current = 0; };
  const setAlign = (a) => { upd(cur, { a }); focusAfter.current = cur; };
  const indent = (d) => { upd(cur, { l: Math.min(2, Math.max(0, row.l + d)) }); focusAfter.current = cur; };
  const move = (d) => {
    const j = cur + d;
    if (j < 0 || j >= blocks.length) return;
    setBlocks((b) => { const c = b.slice(); [c[cur], c[j]] = [c[j], c[cur]]; return c; });
    setCur(j); focusAfter.current = j;
  };
  const removeLine = () => {
    if (blocks.length === 1) { upd(0, { t: '', k: 'p', d: false, b: false, i: false, s: false, l: 0 }); focusAfter.current = 0; return; }
    setBlocks((b) => b.filter((_, j) => j !== cur));
    const n = Math.max(0, cur - 1); setCur(n); focusAfter.current = n;
  };

  function onEnter(el, i) {
    const r = blocks[i];
    if (['ul', 'ol', 'cb'].includes(r.k) && !r.t.trim()) { upd(i, { k: 'p', d: false, l: 0 }); return; } // Enter on an empty list line ends the list
    const [head, tail] = splitAtCaret(el) || [r.t, ''];
    const keep = ['ul', 'ol', 'cb'].includes(r.k); // lists continue; headings/text start a plain line
    const next = normBlock({ t: tail, k: keep ? r.k : 'p', l: r.l });
    setBlocks((b) => [...b.slice(0, i), { ...r, t: head }, next, ...b.slice(i + 1)]);
    focusAfter.current = i + 1; caretAfter.current = 0; setCur(i + 1);
  }
  function onBackspaceStart(i) {
    const r = blocks[i];
    if (r.k !== 'p') upd(i, { k: 'p', d: false }); // first Backspace removes the line style
    else if (r.l > 0) upd(i, { l: r.l - 1 });
    else if (i > 0) {
      const prev = blocks[i - 1];
      if (!plainText(prev.t).trim()) { // a blank line above: drop it, this line keeps its own style and the caret stays at its start
        setBlocks((b) => [...b.slice(0, i - 1), ...b.slice(i)]);
        focusAfter.current = i - 1; caretAfter.current = 0; setCur(i - 1);
      } else {
        setBlocks((b) => [...b.slice(0, i - 1), { ...prev, t: prev.t + r.t }, ...b.slice(i + 1)]);
        focusAfter.current = i - 1; caretAfter.current = plainText(prev.t).length; setCur(i - 1);
      }
    }
  }

  // Several lines pasted at once: the current line is split at the caret and the pasted lines go in between.
  function onPasteLines(el, i, parts) {
    const r = blocks[i];
    const [head, tail] = splitAtCaret(el) || [r.t, ''];
    const listKind = ['ul', 'ol', 'cb'].includes(r.k) ? r.k : 'p';
    const room = Math.max(0, NOTE_LIMITS.lines - blocks.length);
    const mid = parts.slice(1, -1).slice(0, room).map((t) => normBlock({ t: t.slice(0, NOTE_LIMITS.line), k: listKind, l: r.l }));
    const last = normBlock({ t: (parts[parts.length - 1] + tail).slice(0, NOTE_LIMITS.line), k: listKind, l: r.l });
    const first = { ...r, t: (head + parts[0]).slice(0, NOTE_LIMITS.line) };
    setBlocks((b) => [...b.slice(0, i), first, ...mid, last, ...b.slice(i + 1)]);
    const at = i + mid.length + 1;
    focusAfter.current = at; caretAfter.current = plainText(parts[parts.length - 1]).length; setCur(at); setError('');
  }

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

  // Reading view: the whole screen is the note, in its own colour, like a sheet of paper. The title is part of the sheet.
  if (reading && existing) {
    const rb = visibleBlocks(toBlocks(existing));
    return (
      <main class="note-sheet" data-c={inkKey(existing.color)} style={`--c:${actColor(existing.color)}`}>
        <div class="sheet-top">
          <span class="note-tag">{base.category === 'kisisel' && <IconLock small />}{categoryLabel(NOTE_CATEGORIES, base.category).toUpperCase()}</span>
          <button type="button" class="sheet-x" aria-label="Kapat" onClick={nav.back}><IconClose /></button>
        </div>
        {existing.title && <h1 class="sheet-title">{existing.title}</h1>}
        <div class="note-read-lines"><NoteLines blocks={rb} onTick={tickRead} /></div>
        {rb.length === 0 && !existing.title && <div class="sheet-empty">Bu notta yazı yok.</div>}
        {(existing.files || []).length > 0 && <div class="sheet-files"><Attachments files={existing.files} /></div>}
        <div class="sheet-footer"><button class="sheet-edit" type="button" onClick={() => setReading(false)}>Düzenle</button></div>
      </main>
    );
  }

  return (
    <form onSubmit={submit}>
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

          <input id="baslik" class={allSel ? 'nf-title allsel' : 'nf-title'} value={title} maxLength={NOTE_LIMITS.title} placeholder="Başlık" aria-label="Başlık" onInput={(e) => { setTitle(e.target.value); setError(''); }} />

          {wholeLine && !allSel && (
            <div class="nf-selbar"><button type="button" class="nf-selbtn" onMouseDown={keep} onClick={selectAllNote}>Tüm notu seç</button></div>
          )}
          {allSel && (
            <div class="nf-selbar on" role="group" aria-label="Tüm not seçili">
              <span class="nf-selinfo">Tüm not seçili</span>
              <button type="button" class="nf-selbtn" onClick={async () => { await copyAll(); setAllSel(false); }}>Kopyala</button>
              <button type="button" class="nf-selbtn" onClick={async () => { await copyAll(); clearAll(); }}>Kes</button>
              <button type="button" class="nf-selbtn" onClick={() => { if (confirm('Tüm not metni silinsin mi?')) clearAll(); }}>Sil</button>
              <button type="button" class="nf-selbtn" onClick={() => setAllSel(false)}>Vazgeç</button>
            </div>
          )}
          <div class={allSel ? 'lines nf-lines allsel' : 'lines nf-lines'}>
            {blocks.map((b, i) => (
              <div class={`line k-${b.k}`} key={i} style={`margin-left:${b.l * 22}px`}>
                {b.k === 'cb' && (
                  <button type="button" class={b.d ? 'circ on' : 'circ'} role="checkbox" aria-checked={b.d} aria-label="Tamamlandı" onClick={() => upd(i, { d: !b.d })}>
                    {b.d && <Tick />}
                  </button>
                )}
                {b.k === 'ul' && <span class="mark" aria-hidden="true">•</span>}
                {b.k === 'ol' && <span class="mark num" aria-hidden="true">{labels[i]}</span>}
                <LineEditor key={`e${i}`} onRef={(el) => { refs.current[i] = el; }}
                  className={['line-input', b.b ? 'b' : '', b.i ? 'i' : '', b.s || (b.k === 'cb' && b.d) ? 's' : '', b.a ? `ta-${b.a}` : ''].join(' ')}
                  label={`Satır ${i + 1}`} value={b.t} placeholder={i === 0 && blocks.length === 1 ? 'Notunu yaz…' : ''}
                  onFocus={() => { setCur(i); setAllSel(false); }} onSelectAll={selectAllNote} onValue={(v) => { upd(i, { t: v }); setError(''); }}
                  onEnter={(el) => onEnter(el, i)} onPasteLines={(el, parts) => onPasteLines(el, i, parts)} onBackspaceStart={() => onBackspaceStart(i)} />
              </div>
            ))}
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
