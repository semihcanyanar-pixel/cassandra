import { useState } from 'preact/hooks';
import { Page, Card, Chips } from '../components/ui.jsx';
import { saveMedication, deleteMedication, unmarkDose } from '../data.js';
import { today } from '../lib/dates.js';
import { MEALS, suggestTimes, endFromDays, daysBetween, medPeople, personById } from '../lib/meds.js';

const COUNTS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}` }));
const END_MODES = [{ value: 'days', label: 'Gün sayısı' }, { value: 'date', label: 'Bitiş tarihi' }];

export function MedForm({ session, house, id, nav }) {
  const { me, hid } = session;
  const people = medPeople(session.household, me.uid);
  const existing = id ? house.medications.find((m) => m.id === id) : null;
  const [forId, setForId] = useState(existing ? personById(people, existing.forId, me.uid).id : people[0]?.id);
  const [name, setName] = useState(existing?.name || '');
  const [dose, setDose] = useState(existing?.dose || '');
  const [count, setCount] = useState(existing?.times?.length || 1);
  const [times, setTimes] = useState(existing?.times || suggestTimes(1));
  const [meal, setMeal] = useState(existing?.meal || 'fark_etmez');
  const [start, setStart] = useState(existing?.startDate || today());
  const [endMode, setEndMode] = useState('days');
  const [days, setDays] = useState(existing ? daysBetween(existing.startDate, existing.endDate) : 7);
  const [endDate, setEndDate] = useState(existing?.endDate || today());
  const [note, setNote] = useState(existing?.note || '');
  const [error, setError] = useState('');

  const pickCount = (n) => { setCount(n); setTimes(suggestTimes(n)); };
  const setTime = (i, v) => setTimes((ts) => ts.map((x, j) => (j === i ? v : x)));
  const end = endMode === 'days' ? endFromDays(start, Number(days) || 1) : endDate;

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('İlacın adını yaz.'); return; }
    if (!dose.trim()) { setError('Doz bilgisini yaz (örn. 1 tablet).'); return; }
    if (times.some((t) => !t)) { setError('Tüm doz saatlerini gir.'); return; }
    if (new Set(times).size !== times.length) { setError('Aynı saat iki kez girilmiş.'); return; }
    if (!start) { setError('Başlangıç tarihini seç.'); return; }
    if (!end || end < start) { setError('Bitiş tarihi başlangıçtan önce olamaz.'); return; }
    const sorted = times.slice().sort();
    saveMedication(hid, me.uid, id, {
      forId, name: name.trim(), dose: dose.trim(), timesPerDay: sorted.length, times: sorted, meal, startDate: start, endDate: end, note: note.trim(),
    });
    nav.back();
  }
  const finish = () => { if (confirm('Dönem bitirilsin mi? Geçmişe taşınır.')) { saveMedication(hid, me.uid, id, { archived: true }); nav.back(); } };
  const remove = () => {
    if (!confirm('İlaç dönemi ve doz kayıtları silinsin mi?')) return;
    house.medLogs.filter((l) => l.medicationId === id).forEach((l) => unmarkDose(hid, l.id));
    deleteMedication(hid, id);
    nav.back();
  };

  return (
    <form onSubmit={submit}>
      <Page title={existing ? 'İlaç dönemini düzenle' : 'Yeni ilaç dönemi'} onClose={nav.back} footer={<button class="btn wide" type="submit">Kaydet</button>}>
        <div class="sub">Doktorun yazdığı kullanım şeklini gir.</div>
        <Card label="KİMİN İÇİN"><Chips options={people.map((p) => ({ value: p.id, label: p.name }))} value={forId} onChange={setForId} label="Kimin için" /></Card>
        <Card>
          <label class="label" for="ilac" style="padding:0;margin:0">İLAÇ ADI</label>
          <input id="ilac" class="big-input" value={name} maxLength={60} placeholder="Örn. D vitamini" onInput={(e) => { setName(e.target.value); setError(''); }} />
          <label class="label" for="doz" style="padding:0;margin:14px 0 0">DOZ</label>
          <input id="doz" class="big-input" value={dose} maxLength={40} placeholder="Örn. 5 damla" onInput={(e) => { setDose(e.target.value); setError(''); }} />
        </Card>
        <Card label="GÜNDE KAÇ KEZ">
          <Chips options={COUNTS} value={count} onChange={pickCount} label="Günde kaç kez" size="six" />
          <div class="sub" style="margin:8px 0">Saatler önerildi, istersen değiştir.</div>
          {times.map((tm, i) => (
            <input key={i} class="date-input" type="time" value={tm} aria-label={`${i + 1}. doz saati`} style={i ? 'margin-top:8px' : ''} onInput={(e) => setTime(i, e.target.value)} />
          ))}
        </Card>
        <Card label="AÇ / TOK"><Chips options={MEALS} value={meal} onChange={setMeal} label="Aç ya da tok" /></Card>
        <Card label="BAŞLANGIÇ VE BİTİŞ">
          <input class="date-input" type="date" value={start} aria-label="Başlangıç tarihi" onInput={(e) => setStart(e.target.value)} />
          <div style="margin-top:12px"><Chips options={END_MODES} value={endMode} onChange={setEndMode} label="Bitiş türü" /></div>
          {endMode === 'days' ? (
            <div class="row" style="margin-top:10px;gap:10px">
              <input class="date-input" type="number" inputmode="numeric" min="1" max="365" value={days} aria-label="Gün sayısı" style="max-width:120px" onInput={(e) => setDays(e.target.value)} />
              <span class="sub">gün · son gün {end}</span>
            </div>
          ) : (
            <input class="date-input" type="date" value={endDate} aria-label="Bitiş tarihi" style="margin-top:10px" onInput={(e) => setEndDate(e.target.value)} />
          )}
        </Card>
        <Card label="NOT (İSTEĞE BAĞLI)">
          <input class="big-input" value={note} maxLength={120} aria-label="Not" placeholder="Örn. süt ile verme" onInput={(e) => setNote(e.target.value)} />
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
        {existing && !existing.archived && <button type="button" class="chip" style="min-height:48px" onClick={finish}>Dönemi bitir</button>}
        {existing && <button type="button" class="chip" style="min-height:48px" onClick={remove}>Dönemi sil</button>}
      </Page>
    </form>
  );
}
