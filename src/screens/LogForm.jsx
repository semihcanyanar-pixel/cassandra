import { useState } from 'preact/hooks';
import { Page, Card, Chips } from '../components/ui.jsx';
import { addLog } from '../data.js';
import { today } from '../lib/dates.js';

const QUICK = [15, 30, 45, 60, 90].map((n) => ({ value: n, label: `${n} dk` }));

export function LogForm({ uid, data, activityId, nav }) {
  const active = data.activities.filter((a) => !a.archived);
  const [act, setAct] = useState(activityId || active[0]?.id || null);
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    const m = Math.round(Number(minutes));
    if (!act) { setError('Önce bir aktivite seç.'); return; }
    if (!(m >= 1 && m <= 1440)) { setError('Süre 1–1440 dakika olmalı.'); return; }
    if (!date || date > today()) { setError('Gelecek bir tarih girilemez.'); return; }
    addLog(uid, { activityId: act, date, minutes: m });
    nav.back();
  }

  if (!active.length) {
    return (
      <Page title="Süre ekle" onClose={nav.back}>
        <div class="card empty">
          <div class="title-sm">Önce bir aktivite ekle</div>
          <button class="btn" style="margin-top:12px" onClick={() => nav.replace({ n: 'activity' })}>Aktivite ekle</button>
        </div>
      </Page>
    );
  }

  return (
    <form onSubmit={submit}>
      <Page title="Süre ekle" onClose={nav.back} footer={<button class="btn wide" type="submit">Kaydet</button>}>
        <Card label="AKTİVİTE">
          <Chips options={active.map((a) => ({ value: a.id, label: a.name }))} value={act} onChange={setAct} label="Aktivite" />
        </Card>
        <Card label="SÜRE">
          <Chips options={QUICK} value={Number(minutes)} onChange={(v) => { setMinutes(String(v)); setError(''); }} label="Hızlı süre" />
          <div class="field" style="margin-top:10px">
            <label for="dk">Toplam dakika</label>
            <input id="dk" type="number" inputmode="numeric" min="1" max="1440" value={minutes} placeholder="Örn. 50" onInput={(e) => { setMinutes(e.target.value); setError(''); }} />
          </div>
        </Card>
        <Card label="TARİH">
          <input id="tarih" class="date-input" type="date" max={today()} value={date} aria-label="Tarih" onInput={(e) => setDate(e.target.value)} />
          <div class="sub" style="margin-top:6px">Geçmişe dönük girebilirsin. Aynı gün birden fazla kayıt olabilir.</div>
        </Card>
        {error && <div class="error" role="alert">{error}</div>}
      </Page>
    </form>
  );
}
