import { useState } from 'preact/hooks';
import { Page, Card, Chips, Switch } from '../components/ui.jsx';
import { REPEATS, REMINDS, dayRemind, remindsOf, sortReminds, remindLabel } from '../lib/events.js';
import { saveEvent, deleteEvent } from '../data.js';
import { today } from '../lib/dates.js';
import { IconCalendar, IconCake, IconHospital, IconPlane, IconHotel } from '../icons.jsx';

const DAY_CHOICES = Array.from({ length: 31 }, (_, i) => i); // 0 = same day, then 1 to 30 days before
// Record types shown in the list: "Diğer" (a plain entry) first, then the special ones, each with its icon.
const KINDS = [
  { value: '', label: 'Diğer', Icon: IconCalendar },
  { value: 'dogum', label: 'Doğum günü', Icon: IconCake },
  { value: 'hastane', label: 'Hastane', Icon: IconHospital },
  { value: 'ucus', label: 'Uçuş', Icon: IconPlane },
  { value: 'otel', label: 'Otel', Icon: IconHotel },
];
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
  const [rDay, setRDay] = useState(1); // the reminder being composed: days before (0 = same day) ...
  const [rTime, setRTime] = useState('09:00'); // ... and the clock time
  const [dayOpen, setDayOpen] = useState(false);
  const [kindOpen, setKindOpen] = useState(false);
  const [error, setError] = useState('');

  const presets = REMINDS.filter((r) => r.needsTime && hasTime); // relative to the event's own time: at the time, 30 min, 2 hours before
  const valid = reminds.filter((r) => hasTime || !['at', '30m', '2h'].includes(r)); // time based reminders need a time
  const toggle = (v) => setReminds((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  function addRemind() {
    if (!rTime) { setError('Hatırlatma saatini seç.'); return; }
    const v = `d:${rDay}@${rTime}`;
    setReminds((cur) => (cur.includes(v) ? cur : [...cur, v]));
    setError('');
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
      <Page title={existing ? 'Kaydı düzenle' : 'Yeni kayıt'} onClose={nav.back} tall={Boolean(existing)}
        footer={<div class="ff-stack"><button class="btn wide" type="submit">Kaydet</button>{existing && <button type="button" class="chip wide" onClick={remove}>Kaydı sil</button>}</div>}>
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
        <Card label="TÜR">
          <button type="button" class="rm-pick" aria-expanded={kindOpen} aria-haspopup="listbox" onClick={() => setKindOpen((o) => !o)}>
            <span class="kd-cur">{(() => { const k = KINDS.find((k) => k.value === kind) || KINDS[0]; return <><k.Icon />{k.label}</>; })()}</span>
          </button>
          {kindOpen && (
            <div class="kd-list" role="listbox" aria-label="Kayıt türü">
              {KINDS.map((k) => (
                <button key={k.value} type="button" role="option" aria-selected={k.value === kind} class={k.value === kind ? 'kd-opt on' : 'kd-opt'} onClick={() => { setKind(k.value); setKindOpen(false); }}>
                  <k.Icon />{k.label}
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card label="TEKRAR"><Chips options={REPEATS} value={repeat} onChange={setRepeat} label="Tekrar" /></Card>
        <Card label="HATIRLATMA">
          {presets.length > 0 && (
            <div class="chips" role="group" aria-label="Etkinlik saatine göre hatırlatmalar" style="margin-bottom:10px">
              {presets.map((r) => (
                <button key={r.value} type="button" aria-pressed={valid.includes(r.value)} class={valid.includes(r.value) ? 'chip on' : 'chip'} onClick={() => toggle(r.value)}>{r.label}</button>
              ))}
            </div>
          )}
          {valid.filter((r) => dayRemind(r)).length > 0 ? (
            <div class="chips rm-added" role="group" aria-label="Eklenen hatırlatmalar">
              {valid.filter((r) => dayRemind(r)).map((r) => (
                <button key={r} type="button" class="chip on" aria-label={`${remindLabel(r)} hatırlatmasını kaldır`} onClick={() => toggle(r)}>{remindLabel(r)} ×</button>
              ))}
            </div>
          ) : presets.length === 0 && <div class="sub">Henüz hatırlatma yok.</div>}

          <div class="rm-new">
            <button type="button" class="rm-pick" aria-expanded={dayOpen} onClick={() => setDayOpen((o) => !o)}>
              <span>Kaç gün önce hatırlat</span><b>{rDay === 0 ? "Aynı gün" : `${rDay} gün`}</b>
            </button>
            {dayOpen && (
              <div class="scroll-chips rm-bar" role="radiogroup" aria-label="Kaç gün önce">
                {DAY_CHOICES.map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={n === rDay} class={n === rDay ? 'chip on' : 'chip'}
                    ref={n === rDay ? (el) => el?.scrollIntoView?.({ inline: 'center', block: 'nearest' }) : undefined}
                    onClick={() => { setRDay(n); setDayOpen(false); }}>{n === 0 ? 'Aynı gün' : n}</button>
                ))}
              </div>
            )}
            <div class="rm-time">
              <label for="hatirlat-saat">Saat kaçta hatırlat</label>
              <input id="hatirlat-saat" class="date-input" type="time" value={rTime} onInput={(e) => { setRTime(e.target.value); setError(''); }} />
            </div>
            <button type="button" class="btn wide" onClick={addRemind}>Hatırlatma ekle</button>
          </div>
          <div class="sub" style="margin-top:8px;line-height:1.4">Birden fazla ekleyebilirsin (örn. 7 gün önce 18:00 ve 1 gün önce 09:00). Bildirim için Ayarlar’dan bildirimleri aç.</div>
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
      </Page>
    </form>
  );
}
