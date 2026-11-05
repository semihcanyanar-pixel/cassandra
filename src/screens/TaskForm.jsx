import { useState } from 'preact/hooks';
import { Page, Card, Chips, Switch } from '../components/ui.jsx';
import { saveTask, deleteTask } from '../data.js';
import { today, DAY_SHORT, weekday } from '../lib/dates.js';

const REPEATS = [{ value: 'none', label: 'Yok' }, { value: 'daily', label: 'Her gün' }, { value: 'days', label: 'Belirli günler' }];

export function TaskForm({ uid, data, id, nav }) {
  const existing = id ? data.tasks.find((t) => t.id === id) : null;
  const [title, setTitle] = useState(existing?.title || '');
  const [repeat, setRepeat] = useState(existing?.repeat || 'none');
  const [days, setDays] = useState(existing?.days || [weekday(today())]);
  const [date, setDate] = useState(existing?.date || today());
  const [remind, setRemind] = useState(existing?.remindTime || '');
  const [error, setError] = useState('');

  const toggleDay = (d) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Görev adı yaz.'); return; }
    if (repeat === 'days' && days.length === 0) { setError('En az bir gün seç.'); return; }
    const payload = { title: title.trim(), repeat, date: date || today(), remindTime: remind || null };
    payload.days = repeat === 'days' ? days : [];
    saveTask(uid, id, payload);
    nav.back();
  }
  const remove = () => { if (confirm('Görev silinsin mi?')) { deleteTask(uid, id); nav.back(); } };

  return (
    <form onSubmit={submit}>
      <Page title={existing ? 'Görevi düzenle' : 'Yeni görev'} onClose={nav.back} footer={<button class="btn wide" type="submit">Kaydet</button>}>
        <Card>
          <label class="label" for="gorev" style="padding:0;margin:0">GÖREV</label>
          <input id="gorev" class="big-input" value={title} maxLength={80} placeholder="Örn. Vitamin al" onInput={(e) => { setTitle(e.target.value); setError(''); }} />
        </Card>
        {!existing && <div class="sub" style="padding:0 4px;line-height:1.45">Süresini ölçmeyeceğin, yalnızca tik atacağın işler için. Süre tutmak istediğin şeyler (kitap, spor…) için aktivite ekle.</div>}
        <Card label="TEKRAR">
          <Chips options={REPEATS} value={repeat} onChange={setRepeat} label="Tekrar" />
          {repeat === 'days' && (
            <div class="chips seven" role="group" aria-label="Günler" style="margin-top:10px">
              {DAY_SHORT.map((l, i) => (
                <button key={l} type="button" aria-pressed={days.includes(i)} class={days.includes(i) ? 'chip on' : 'chip'} onClick={() => toggleDay(i)}>{l}</button>
              ))}
            </div>
          )}
        </Card>
        <Card label={repeat === 'none' ? 'TARİH' : 'BAŞLANGIÇ'}>
          <input class="date-input" type="date" value={date} aria-label="Tarih" onInput={(e) => setDate(e.target.value)} />
        </Card>
        <Card>
          <div class="row">
            <div class="grow">
              <div class="label" style="margin:0;padding:0">HATIRLATMA</div>
              <div class="sub">Belirlediğin saatte bildirim gelir (tik atılmadıysa)</div>
            </div>
            <Switch checked={Boolean(remind)} onChange={(on) => setRemind(on ? '09:00' : '')} label="Hatırlatma" />
          </div>
          {remind && (
            <div style="margin-top:12px">
              <input class="date-input" type="time" value={remind} aria-label="Hatırlatma saati" onInput={(e) => setRemind(e.target.value)} />
              <div class="sub" style="margin-top:6px">Bildirimler Ayarlar’dan açık olmalı.</div>
            </div>
          )}
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
        {existing && <button type="button" class="chip" style="min-height:48px" onClick={remove}>Görevi sil</button>}
      </Page>
    </form>
  );
}
