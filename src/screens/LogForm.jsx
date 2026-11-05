import { useState } from 'preact/hooks';
import { Page, Card, Chips } from '../components/ui.jsx';
import { addLog, updateLog, deleteLog } from '../data.js';
import { IconTrash, IconEdit } from '../icons.jsx';
import { today, dayMonth } from '../lib/dates.js';
import { fmtDur } from '../lib/stats.js';

const QUICK = [15, 30, 60].map((n) => ({ value: n, label: `${n} dk` }));

// Adds a time entry, or edits an existing one when `logId` is given (from the report list or "son kayıtlar").
export function LogForm({ uid, data, activityId, logId, nav }) {
  const active = data.activities;
  const editing = logId ? data.logs.find((l) => l.id === logId) : null;
  const [act, setAct] = useState(editing?.activityId || activityId || active[0]?.id || null);
  const [minutes, setMinutes] = useState(editing ? String(editing.minutes) : '');
  const [date, setDate] = useState(editing?.date || today());
  const [error, setError] = useState('');

  const created = (l) => l.createdAt?.toMillis?.() ?? 9e15;
  const recent = data.logs.filter((l) => l.activityId === act)
    .slice().sort((a, b) => (b.date + created(b)).localeCompare(a.date + created(a))).slice(0, 8);

  function submit(e) {
    e.preventDefault();
    const m = Math.round(Number(minutes));
    if (!act) { setError('Önce bir aktivite seç.'); return; }
    if (!(m >= 1 && m <= 1440)) { setError('Süre 1–1440 dakika olmalı.'); return; }
    if (!date || date > today()) { setError('Gelecek bir tarih girilemez.'); return; }
    if (editing) updateLog(uid, editing.id, { activityId: act, date, minutes: m });
    else addLog(uid, { activityId: act, date, minutes: m });
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
      <Page title={editing ? 'Kaydı düzenle' : 'Süre ekle'} onClose={nav.back} footer={<button class="btn wide" type="submit">Kaydet</button>}>
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
        <Card label="SON KAYITLAR">
          {recent.length === 0 && <div class="sub" style="padding:6px 0">Bu aktivite için kayıt yok.</div>}
          {recent.map((l) => (
            <div class="list-row" key={l.id}>
              <div class="grow"><div class="title-sm">{l.date === today() ? 'Bugün' : dayMonth(l.date)}</div></div>
              <b>{fmtDur(l.minutes)}</b>
              <button type="button" class="iconbtn" aria-label={`${l.date === today() ? 'Bugünkü' : dayMonth(l.date)} ${fmtDur(l.minutes)} kaydını düzenle`}
                onClick={() => nav.replace({ n: 'log', logId: l.id })}><IconEdit /></button>
              <button type="button" class="iconbtn" aria-label={`${l.date === today() ? 'Bugünkü' : dayMonth(l.date)} ${fmtDur(l.minutes)} kaydını sil`}
                onClick={() => { if (confirm(`${fmtDur(l.minutes)} kaydı silinsin mi?`)) deleteLog(uid, l.id); }}><IconTrash /></button>
            </div>
          ))}
        </Card>
      </Page>
    </form>
  );
}
