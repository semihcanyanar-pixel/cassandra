import { useState } from 'preact/hooks';
import { Page, Card, Chips, COLOR_COUNT, actColor } from '../components/ui.jsx';
import { IconPlus, IconTrash } from '../icons.jsx';
import { NOTE_CATEGORIES, noteScope, normalizeCategory } from '../lib/notes.js';
import { saveNote, deleteNote } from '../data.js';

const NOTE_COLORS = 4;

export function NoteForm({ ctx, data, house, id, category: initialCategory, nav }) {
  const existing = id ? (initialCategory === 'kisisel' ? data.notes : house.notes).find((n) => n.id === id) : null;
  const [category, setCategory] = useState(normalizeCategory(existing?.category || initialCategory));
  const [title, setTitle] = useState(existing?.title || '');
  const [kind, setKind] = useState(existing?.items ? 'list' : 'text');
  const [body, setBody] = useState(existing?.body || '');
  const [items, setItems] = useState(existing?.items || [{ t: '', done: false }]);
  const [color, setColor] = useState(existing?.color ?? 0);
  const [error, setError] = useState('');

  const setItem = (i, patch) => setItems((cur) => cur.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function submit(e) {
    e.preventDefault();
    const cleanItems = items.map((x) => ({ t: x.t.trim(), done: x.done })).filter((x) => x.t);
    if (!title.trim() && !body.trim() && cleanItems.length === 0) { setError('Boş not kaydedilemez.'); return; }
    const payload = { title: title.trim(), color };
    if (kind === 'list') { payload.items = cleanItems; payload.body = ''; } else { payload.body = body.trim(); payload.items = null; }
    saveNote(ctx, category, id, payload);
    nav.back();
  }
  const remove = () => { if (confirm('Not silinsin mi?')) { deleteNote(ctx, category, id); nav.back(); } };

  return (
    <form onSubmit={submit}>
      <Page title={existing ? 'Notu düzenle' : 'Yeni not'} onClose={nav.back} footer={<button class="btn wide" type="submit">Kaydet</button>}>
        <Card label="KATEGORİ">
          {existing ? (
            <div class="title-sm">{NOTE_CATEGORIES.find((c) => c.value === category)?.label}</div>
          ) : (
            <Chips options={NOTE_CATEGORIES} value={category} onChange={setCategory} label="Kategori" />
          )}
          <div class="sub" style="margin-top:8px">
            {noteScope(category) === 'personal' ? 'Yalnızca sen görürsün, eşin göremez.' : 'Eşin de görür ve düzenleyebilir.'}
          </div>
        </Card>
        <Card>
          <label class="label" for="baslik" style="padding:0;margin:0">BAŞLIK</label>
          <input id="baslik" class="big-input" value={title} maxLength={60} placeholder="İsteğe bağlı" onInput={(e) => { setTitle(e.target.value); setError(''); }} />
        </Card>
        <Card label="İÇERİK">
          <Chips options={[{ value: 'text', label: 'Metin' }, { value: 'list', label: 'Liste' }]} value={kind} onChange={setKind} label="Not türü" />
          {kind === 'text' ? (
            <textarea class="note-area" aria-label="Not metni" rows={6} value={body} maxLength={2000} placeholder="Notunu yaz…" onInput={(e) => { setBody(e.target.value); setError(''); }} />
          ) : (
            <div style="margin-top:10px">
              {items.map((x, i) => (
                <div class="row" key={i} style="gap:4px">
                  <button type="button" class={x.done ? 'check on' : 'check'} role="checkbox" aria-checked={x.done} aria-label="Madde tamamlandı" onClick={() => setItem(i, { done: !x.done })}>
                    {x.done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                  </button>
                  <input class="item-input grow" aria-label={`Madde ${i + 1}`} value={x.t} maxLength={80} placeholder="Madde" onInput={(e) => { setItem(i, { t: e.target.value }); setError(''); }} />
                  <button type="button" class="iconbtn plain" aria-label={`Madde ${i + 1} sil`} onClick={() => setItems((cur) => (cur.length > 1 ? cur.filter((_, j) => j !== i) : [{ t: '', done: false }]))}><IconTrash /></button>
                </div>
              ))}
              <button type="button" class="chip" style="margin-top:6px" onClick={() => setItems((cur) => [...cur, { t: '', done: false }])}><IconPlus />Madde ekle</button>
            </div>
          )}
        </Card>
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
