import { useState } from 'preact/hooks';
import { Page, Card, Chips, Switch } from '../components/ui.jsx';
import { REPEATS, REMINDS, customDays, MAX_REMIND_DAYS, remindsOf, sortReminds, remindLabel } from '../lib/events.js';
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
  const [kind, setKind] = useState(existing?.kind || ''); // '' = normal, 'dogum' = birthday (cake icon), 'hastane' = hospital appointment (hospital icon), 'ucus' = flight (aeroplane icon), 'otel' = hotel booking (bed icon)
  const [repeat, setRepeat] = useState(existing?.repeat || 'none');
  const [reminds, setReminds] = useState(() => remindsOf(existing)); // several reminders are allowed: e.g. 1 week and 1 day before
  const [days, setDays] = useState(''); // the "N days before" box
  const [error, setError] = useState('');

  const presets = REMINDS.filter((r) => r.value !== 'none' && r.value !== 'custom' && (hasTime || !r.needsTime));
  const valid = reminds.filter((r) => hasTime || !['at', '30m', '2h'].includes(r)); // time based reminders need a time
  const toggle = (v) => setReminds((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  function addDays() {
    const n = Math.round(Number(days));
    if (!(n >= 1 && n <= MAX_REMIND_DAYS)) { setError(`Kaç gün önce: 1–${MAX_REMIND_DAYS} arası bir sayı yaz.`); return; }
    const v = n === 1 ? '1d' : `d:${n}`;
    setReminds((cur) => (cur.includes(v) ? cur : [...cur, v]));
    setDays(''); setError('');
  }

  function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Kayda bir başlık yaz.'); return; }
    if (!date) { setError('Tarih seç.'); return; }
    const sorted = sortReminds(valid);
    saveEvent(ctx, scope, id, { title: title.trim(), kind: kind || null, date, time: hasTime ? time : null, repeat, reminds: sorted, remind: sorted[0] || 'none' });
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
        <Card label="TÜR"><Chips options={[{ value: '', label: 'Normal' }, { value: 'dogum', label: 'Doğum günü' }, { value: 'hastane', label: 'Hastane' }, { value: 'ucus', label: 'Uçuş' }, { value: 'otel', label: 'Otel' }]} value={kind} onChange={setKind} label="Kayıt türü" /></Card>
        <Card label="TEKRAR"><Chips options={REPEATS} value={repeat} onChange={setRepeat} label="Tekrar" /></Card>
        <Card label="HATIRLATMA">
          <div class="chips" role="group" aria-label="Hatırlatmalar">
            {presets.map((r) => (
              <button key={r.value} type="button" aria-pressed={valid.includes(r.value)} class={valid.includes(r.value) ? 'chip on' : 'chip'} onClick={() => toggle(r.value)}>{r.label}</button>
            ))}
          </div>
          {valid.filter((r) => customDays(r)).length > 0 && (
            <div class="chips" style="margin-top:8px" role="group" aria-label="Özel hatırlatmalar">
              {valid.filter((r) => customDays(r)).map((r) => (
                <button key={r} type="button" class="chip on" aria-label={`${remindLabel(r)} hatırlatmasını kaldır`} onClick={() => toggle(r)}>{remindLabel(r)} ×</button>
              ))}
            </div>
          )}
          <div class="row" style="gap:8px;margin-top:12px;align-items:flex-end">
            <div class="field grow" style="margin:0">
              <label for="hatirlat-gun">Elle ekle: kaç gün önce?</label>
              <input id="hatirlat-gun" type="number" inputmode="numeric" min="1" max={MAX_REMIND_DAYS} value={days} placeholder="Örn. 7" onInput={(e) => { setDays(e.target.value); setError(''); }} />
            </div>
            <button type="button" class="btn" onClick={addDays}>Ekle</button>
          </div>
          <div class="sub" style="margin-top:8px;line-height:1.4">Birden fazla seçebilirsin (örn. 7 gün ve 1 gün önce). Günlük hatırlatmalar {hasTime ? `o gün ${time} saatinde` : 'sabah 09:00’da'} gelir. Bildirim için Ayarlar’dan bildirimleri aç.</div>
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
        {existing && <button type="button" class="chip" style="min-height:48px" onClick={remove}>Kaydı sil</button>}
      </Page>
    </form>
  );
}
