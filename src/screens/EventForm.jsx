import { useState } from 'preact/hooks';
import { Page, Card, Chips, Switch } from '../components/ui.jsx';
import { REPEATS, REMINDS, customDays, MAX_REMIND_DAYS } from '../lib/events.js';
import { saveEvent, deleteEvent } from '../data.js';
import { today } from '../lib/dates.js';

const SCOPES = [{ value: 'aile', label: 'Aile' }, { value: 'kisisel', label: 'Kişisel' }];

export function EventForm({ ctx, data, house, id, scope: initialScope, date: initialDate, nav }) {
  const existing = id ? (initialScope === 'kisisel' ? data.events : house.events).find((e) => e.id === id) : null;
  const [title, setTitle] = useState(existing?.title || '');
  const [date, setDate] = useState(existing?.date || initialDate || today());
  const [hasTime, setHasTime] = useState(Boolean(existing?.time));
  const [time, setTime] = useState(existing?.time || '09:00');
  const [scope, setScope] = useState(initialScope || 'aile');
  const [repeat, setRepeat] = useState(existing?.repeat || 'none');
  const [remind, setRemind] = useState(customDays(existing?.remind) ? 'custom' : existing?.remind || 'none');
  const [days, setDays] = useState(String(customDays(existing?.remind) || 3)); // custom: how many days before
  const [error, setError] = useState('');

  const remindOptions = REMINDS.filter((r) => hasTime || !r.needsTime).map(({ value, label }) => ({ value, label }));
  const effRemind = !hasTime && REMINDS.find((r) => r.value === remind)?.needsTime ? 'none' : remind;

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Kayda bir başlık yaz.'); return; }
    if (!date) { setError('Tarih seç.'); return; }
    const n = Math.round(Number(days));
    if (effRemind === 'custom' && !(n >= 1 && n <= MAX_REMIND_DAYS)) { setError(`Kaç gün önce: 1–${MAX_REMIND_DAYS} arası bir sayı yaz.`); return; }
    saveEvent(ctx, scope, id, { title: title.trim(), date, time: hasTime ? time : null, repeat, remind: effRemind === 'custom' ? `d:${n}` : effRemind });
    nav.back();
  }
  const remove = () => { if (confirm('Kayıt silinsin mi?')) { deleteEvent(ctx, scope, id); nav.back(); } };

  return (
    <form onSubmit={submit}>
      <Page title={existing ? 'Kaydı düzenle' : 'Yeni kayıt'} onClose={nav.back} footer={<button class="btn wide" type="submit">Kaydet</button>}>
        <Card>
          <label class="label" for="baslik" style="padding:0;margin:0">BAŞLIK</label>
          <input id="baslik" class="big-input" value={title} maxLength={80} placeholder="Örn. Hastane randevusu" onInput={(e) => { setTitle(e.target.value); setError(''); }} />
        </Card>
        <Card label="KAPSAM">
          {existing ? <div class="title-sm">{scope === 'kisisel' ? 'Kişisel' : 'Aile'}</div> : <Chips options={SCOPES} value={scope} onChange={setScope} label="Kapsam" />}
          <div class="sub" style="margin-top:8px">{scope === 'kisisel' ? 'Yalnızca sen görürsün, eşin göremez.' : 'Eşin de görür ve düzenleyebilir.'}</div>
        </Card>
        <Card label="TARİH VE SAAT">
          <input class="date-input" type="date" value={date} aria-label="Tarih" onInput={(e) => setDate(e.target.value)} />
          <div class="row" style="margin-top:12px">
            <div class="grow title-sm">Saat</div>
            <Switch checked={hasTime} onChange={setHasTime} label="Saat ekle" />
          </div>
          {hasTime && <input class="date-input" type="time" value={time} aria-label="Saat" style="margin-top:10px" onInput={(e) => setTime(e.target.value)} />}
        </Card>
        <Card label="TEKRAR"><Chips options={REPEATS} value={repeat} onChange={setRepeat} label="Tekrar" /></Card>
        <Card label="HATIRLATMA">
          <Chips options={remindOptions} value={effRemind} onChange={setRemind} label="Hatırlatma" />
          {effRemind === 'custom' && (
            <div class="field" style="margin-top:10px">
              <label for="hatirlat-gun">Kaç gün önce hatırlatılsın?</label>
              <input id="hatirlat-gun" type="number" inputmode="numeric" min="1" max={MAX_REMIND_DAYS} value={days} onInput={(e) => { setDays(e.target.value); setError(''); }} />
              <div class="sub" style="margin-top:6px">{hasTime ? `O gün ${time} saatinde` : 'Sabah 09:00’da'} bildirim gelir.</div>
            </div>
          )}
          <div class="sub" style="margin-top:8px">Bildirim için Ayarlar’dan bildirimleri aç.</div>
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
        {existing && <button type="button" class="chip" style="min-height:48px" onClick={remove}>Kaydı sil</button>}
      </Page>
    </form>
  );
}
