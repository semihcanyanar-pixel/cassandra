import { useEffect, useRef, useState } from 'preact/hooks';
import { Page, Card, Chips, actColor } from '../components/ui.jsx';
import { NOTE_CATEGORIES, noteScope, normalizeCategory, toBlocks, cleanBlocks, numberLabels, normBlock, parseInline, toggleMark } from '../lib/notes.js';
import { saveNote, deleteNote } from '../data.js';
import { Attachments } from '../components/Attachments.jsx';
import { filesEnabled, uploadFile, deleteFile, compressImage, isImage, MAX_FILE_BYTES } from '../files.js';

const NOTE_COLORS = 4;

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
const Lbl = ({ children }) => <span class="fl">{children}</span>;

export function NoteForm({ ctx, data, house, id, category: initialCategory, nav }) {
  const existing = id ? (initialCategory === 'kisisel' ? data.notes : house.notes).find((n) => n.id === id) : null;
  const [category, setCategory] = useState(normalizeCategory(existing?.category || initialCategory));
  const [title, setTitle] = useState(existing?.title || '');
  const [blocks, setBlocks] = useState(() => { const b = toBlocks(existing); return b.length ? b : [normBlock({})]; });
  const [color, setColor] = useState(existing?.color ?? 0);
  const [error, setError] = useState('');
  const [cur, setCur] = useState(0); // the line being edited
  const [files, setFiles] = useState(existing?.files || []);
  const [busy, setBusy] = useState(false);
  const originals = useRef(new Set((existing?.files || []).map((f) => f.id)));
  const removedOriginals = useRef([]);
  const scope = noteScope(category) === 'personal' ? 'personal' : 'family';
  const refs = useRef([]);
  const focusAfter = useRef(null);
  const selAfter = useRef(null); // [start, end] to restore in the focused line after a word-level format change

  const grow = (el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } };
  useEffect(() => {
    refs.current.forEach(grow);
    if (focusAfter.current != null) {
      const el = refs.current[focusAfter.current];
      el?.focus();
      if (el && selAfter.current) el.setSelectionRange(selAfter.current[0], selAfter.current[1]);
      focusAfter.current = null; selAfter.current = null;
    }
  });

  const upd = (i, patch) => setBlocks((b) => b.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const row = blocks[cur] || blocks[0];
  const labels = numberLabels(blocks);

  const setKind = (k) => { upd(cur, { k: row.k === k ? 'p' : k, d: false }); focusAfter.current = cur; };
  // With text selected the format applies to the selection (word level); with just a cursor it applies to the whole line.
  const toggleFlag = (f) => {
    const el = refs.current[cur];
    const a = el?.selectionStart ?? 0, z = el?.selectionEnd ?? 0;
    if (el && a !== z) {
      const r = toggleMark(row.t, a, z, f);
      upd(cur, { t: r.t }); selAfter.current = [r.start, r.end];
    } else upd(cur, { [f]: !row[f] });
    focusAfter.current = cur;
  };
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

  function onKeyDown(e, i) {
    const r = blocks[i];
    if (e.key === 'Enter') {
      e.preventDefault();
      if (['ul', 'ol', 'cb'].includes(r.k) && !r.t.trim()) { upd(i, { k: 'p', d: false, l: 0 }); return; } // Enter on an empty list line ends the list
      const pos = e.target.selectionStart ?? r.t.length;
      const keep = ['ul', 'ol', 'cb'].includes(r.k); // lists continue; headings/text start a plain line
      const next = normBlock({ t: r.t.slice(pos), k: keep ? r.k : 'p', l: r.l });
      setBlocks((b) => [...b.slice(0, i), { ...r, t: r.t.slice(0, pos) }, next, ...b.slice(i + 1)]);
      focusAfter.current = i + 1; setCur(i + 1);
    } else if (e.key === 'Backspace' && (e.target.selectionStart ?? 0) === 0 && e.target.selectionEnd === 0) {
      if (r.k !== 'p') { e.preventDefault(); upd(i, { k: 'p', d: false }); } // first Backspace removes the line style
      else if (r.l > 0) { e.preventDefault(); upd(i, { l: r.l - 1 }); }
      else if (i > 0) {
        e.preventDefault();
        setBlocks((b) => [...b.slice(0, i - 1), { ...b[i - 1], t: b[i - 1].t + r.t }, ...b.slice(i + 1)]);
        focusAfter.current = i - 1; setCur(i - 1);
      }
    }
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
    setBusy(false);
  }
  const removeFile = (f) => {
    setFiles((cur) => cur.filter((x) => x.id !== f.id));
    if (originals.current.has(f.id)) removedOriginals.current.push(f.id); else deleteFile(f.id); // new this session: gone right away
  };
  // Leaving without saving: files uploaded in this session would be orphans, so delete them.
  const close = () => { files.filter((f) => !originals.current.has(f.id)).forEach((f) => deleteFile(f.id)); nav.back(); };

  function submit(e) {
    e.preventDefault();
    const clean = cleanBlocks(blocks);
    if (!title.trim() && clean.length === 0 && files.length === 0) { setError('Boş not kaydedilemez.'); return; }
    saveNote(ctx, category, id, { title: title.trim(), color, blocks: clean, body: '', items: null, files });
    removedOriginals.current.forEach(deleteFile);
    nav.back();
  }
  const remove = () => { if (confirm('Not silinsin mi?')) { files.forEach((f) => deleteFile(f.id)); deleteNote(ctx, category, id); nav.back(); } };
  const keep = (e) => e.preventDefault(); // keep the keyboard open when a toolbar button is tapped

  return (
    <form onSubmit={submit}>
      <Page title={existing ? 'Notu düzenle' : 'Yeni not'} onClose={close} footer={<button class="btn wide" type="submit" disabled={busy}>Kaydet</button>}>
        <Card label="KATEGORİ">
          {existing ? (
            <div class="title-sm">{NOTE_CATEGORIES.find((c) => c.value === category)?.label}</div>
          ) : (
            <Chips options={NOTE_CATEGORIES} value={category} onChange={files.length ? () => {} : setCategory} label="Kategori" />
          )}
          <div class="sub" style="margin-top:8px">
            {noteScope(category) === 'personal' ? 'Yalnızca sen görürsün, eşin göremez.' : 'Eşin de görür ve düzenleyebilir.'}
          </div>
        </Card>
        <Card>
          <label class="label" for="baslik" style="padding:0;margin:0">BAŞLIK</label>
          <input id="baslik" class="big-input" value={title} maxLength={60} placeholder="İsteğe bağlı" onInput={(e) => { setTitle(e.target.value); setError(''); }} />
        </Card>

        <div class="fmtbar" role="toolbar" aria-label="Biçim araçları">
          {KIND_BUTTONS.map((x) => (
            <button key={x.k} type="button" class={row.k === x.k ? 'fmt on' : 'fmt'} aria-pressed={row.k === x.k} aria-label={x.label} title={x.label} onMouseDown={keep} onClick={() => setKind(x.k)}>{x.icon}<Lbl>{x.short}</Lbl></button>
          ))}
          <span class="fmt-sep" aria-hidden="true" />
          {FLAG_BUTTONS.map((x) => (
            <button key={x.f} type="button" class={row[x.f] ? 'fmt on' : 'fmt'} aria-pressed={Boolean(row[x.f])} aria-label={x.label} title={x.label} onMouseDown={keep} onClick={() => toggleFlag(x.f)}>{x.icon}<Lbl>{x.short}</Lbl></button>
          ))}
          <span class="fmt-sep" aria-hidden="true" />
          <button type="button" class="fmt" aria-label="Girinti ekle" title="Girinti ekle" disabled={row.l >= 2} onMouseDown={keep} onClick={() => indent(1)}><Ico d="M5 12h14M13 6l6 6-6 6" /><Lbl>Girinti</Lbl></button>
          <button type="button" class="fmt" aria-label="Girintiyi azalt" title="Girintiyi azalt" disabled={row.l <= 0} onMouseDown={keep} onClick={() => indent(-1)}><Ico d="M19 12H5M11 6l-6 6 6 6" /><Lbl>Geri</Lbl></button>
          <span class="fmt-sep" aria-hidden="true" />
          <button type="button" class="fmt" aria-label="Satırı yukarı taşı" title="Satırı yukarı taşı" disabled={cur === 0} onMouseDown={keep} onClick={() => move(-1)}><Ico d="M12 19V5M6 11l6-6 6 6" /><Lbl>Yukarı</Lbl></button>
          <button type="button" class="fmt" aria-label="Satırı aşağı taşı" title="Satırı aşağı taşı" disabled={cur >= blocks.length - 1} onMouseDown={keep} onClick={() => move(1)}><Ico d="M12 5v14M6 13l6 6 6-6" /><Lbl>Aşağı</Lbl></button>
          <button type="button" class="fmt" aria-label="Satırı sil" title="Satırı sil" onMouseDown={keep} onClick={removeLine}><Ico d="M6 6l12 12M18 6L6 18" /><Lbl>Satırı sil</Lbl></button>
        </div>

        <Card label="NOT">
          <div class="lines">
            {blocks.map((b, i) => (
              <div class={`line k-${b.k}`} key={i} style={`margin-left:${b.l * 22}px`}>
                {b.k === 'cb' && (
                  <button type="button" class={b.d ? 'circ on' : 'circ'} role="checkbox" aria-checked={b.d} aria-label="Tamamlandı" onClick={() => upd(i, { d: !b.d })}>
                    {b.d && <Tick />}
                  </button>
                )}
                {b.k === 'ul' && <span class="mark" aria-hidden="true">•</span>}
                {b.k === 'ol' && <span class="mark num" aria-hidden="true">{labels[i]}</span>}
                {cur !== i && /(\*\*|__|~~)/.test(b.t) && (
                  <div class={['line-input', 'line-view', b.b ? 'b' : '', b.i ? 'i' : '', b.s || (b.k === 'cb' && b.d) ? 's' : ''].join(' ')}
                    onClick={() => { focusAfter.current = i; setCur(i); }}>
                    {parseInline(b.t).map((r, j) => <span key={j} class={`${r.b ? 'b' : ''} ${r.i ? 'i' : ''} ${r.s ? 's' : ''}`}>{r.text}</span>)}
                  </div>
                )}
                <textarea ref={(el) => { refs.current[i] = el; }} rows={1} hidden={cur !== i && /(\*\*|__|~~)/.test(b.t)}
                  class={['line-input', b.b ? 'b' : '', b.i ? 'i' : '', b.s || (b.k === 'cb' && b.d) ? 's' : ''].join(' ')}
                  aria-label={`Satır ${i + 1}`} value={b.t} maxLength={500} placeholder={i === 0 && blocks.length === 1 ? 'Notunu yaz…' : ''}
                  onFocus={() => setCur(i)} onKeyDown={(e) => onKeyDown(e, i)}
                  onInput={(e) => { upd(i, { t: e.target.value.replace(/\n/g, ' ') }); setError(''); grow(e.target); }} />
              </div>
            ))}
          </div>
          <div class="sub" style="margin-top:8px">Metni seçip Kalın, İtalik ya da Çizgi'ye dokunursan ** __ ~~ işaretleri görünür, satır atlayınca seçim uygulanır.</div>
        </Card>

        {filesEnabled && (
          <Card label="EKLER">
            <div class="row" style="gap:10px;flex-wrap:wrap">
              <label class="chip filebtn">Resim ekle<input class="vh" type="file" accept="image/*" multiple disabled={busy} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} /></label>
              <label class="chip filebtn">PDF ekle<input class="vh" type="file" accept="application/pdf" multiple disabled={busy} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} /></label>
            </div>
            {files.length > 0 && <div style="margin-top:12px"><Attachments files={files} onRemove={removeFile} busy={busy} /></div>}
            {files.length === 0 && busy && <div class="loadbar" role="progressbar" aria-label="Yükleniyor"><i /></div>}
            <div class="sub" style="margin-top:8px">Dosya boyutu en çok 20 MB olmalıdır.</div>
          </Card>
        )}
        <Card label="RENK">
          <div class="swatch-row" role="radiogroup" aria-label="Not rengi" style="justify-content:flex-start">
            {Array.from({ length: NOTE_COLORS }, (_, i) => (
              <button key={i} type="button" role="radio" aria-checked={color === i} aria-label={`Renk ${i + 1}`} class="swatch" style={`background:${actColor(i)}`} onClick={() => setColor(i)}>
                {color === i && <span class="swatch-dot" />}
              </button>
            ))}
          </div>
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
        {existing && <button type="button" class="chip" style="min-height:48px" onClick={remove}>Notu sil</button>}
      </Page>
    </form>
  );
}
