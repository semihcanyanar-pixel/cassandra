import { useRef, useState } from 'preact/hooks';
import { Page, Card } from '../components/ui.jsx';
import { Picker } from '../components/Picker.jsx';
import { Chart } from '../components/Chart.jsx';
import { IconBack, IconNext, IconTrash } from '../icons.jsx';
import { MODES, buildSeries, fmtDur, streak, activeDays } from '../lib/stats.js';
import { today, dayMonth } from '../lib/dates.js';
import { deleteLog } from '../data.js';

export function Report({ uid, data, activityId, nav }) {
  const [sel, setSel] = useState(activityId || 'all'); // 'all' = Genel
  const [mode, setMode] = useState('day');
  const [offset, setOffset] = useState(0);
  const touch = useRef(null);
  const t = today();
  const colorOf = (id) => data.activities.find((a) => a.id === id)?.color ?? 0;
  const filterId = sel === 'all' ? null : sel;
  const series = buildSeries(data.logs, { activityId: filterId, mode, offset, today: t });
  const unit = mode === 'day' ? 'gün' : mode === 'week' ? 'hafta' : 'ay';
  const avg = Math.round(series.total / series.buckets.length);
  const page = (d) => setOffset((o) => Math.min(0, o + d));

  const onTouchStart = (e) => { touch.current = e.changedTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 50) page(dx > 0 ? -1 : 1); // swipe right = earlier
  };

  const picks = [{ value: 'all', label: 'Genel' }, ...data.activities.map((a) => ({ value: a.id, label: a.name }))];
  const recent = data.logs.filter((l) => !filterId || l.activityId === filterId)
    .slice().sort((a, b) => (b.date + (b.createdAt?.toMillis?.() ?? 9e15)).localeCompare(a.date + (a.createdAt?.toMillis?.() ?? 9e15))).slice(0, 10);

  return (
    <Page title="Rapor" onClose={nav.back}>
      <Picker items={picks} value={sel} onChange={setSel} label="Aktivite seç" />
      <Picker size="sm" items={Object.entries(MODES).map(([value, label]) => ({ value, label }))} value={mode}
        onChange={(m) => { setMode(m); setOffset(0); }} label="Dönem" />

      <Card>
        <div class="row" style="justify-content:space-between;margin-bottom:4px">
          <button class="iconbtn" aria-label="Önceki dönem" onClick={() => page(-1)}><IconBack /></button>
          <div class="title-sm" aria-live="polite">{dayMonth(series.first)} – {dayMonth(series.last)}</div>
          <button class="iconbtn" aria-label="Sonraki dönem" disabled={offset === 0} onClick={() => page(1)}><IconNext /></button>
        </div>
        <div key={`${sel}-${mode}-${offset}`} class="swap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style="touch-action:pan-y">
          <Chart series={series} colorOf={colorOf} single={Boolean(filterId)} />
        </div>
      </Card>

      <div class="stat-grid">
        <div class="card stat"><span class="sub">Toplam</span><b>{fmtDur(series.total)}</b></div>
        <div class="card stat"><span class="sub">{unit === 'gün' ? 'Günlük' : `${unit.charAt(0).toUpperCase()}${unit.slice(1)}lık`} ort.</span><b>{fmtDur(avg)}</b></div>
        <div class="card stat"><span class="sub">Gün serisi</span><b>{streak(data.logs, filterId, t)} gün</b></div>
        <div class="card stat"><span class="sub">Aktif gün</span><b>{activeDays(data.logs, filterId, series.first, series.last)}</b></div>
      </div>

      <div class="label">SON KAYITLAR</div>
      <div class="card list-card">
        {recent.length === 0 && <div class="sub" style="padding:14px 0">Henüz kayıt yok.</div>}
        {recent.map((l) => {
          const a = data.activities.find((x) => x.id === l.activityId);
          return (
            <div class="list-row" key={l.id}>
              <span class="dot" style={`background:var(--act-${a?.color ?? 0})`} />
              <div class="grow"><div class="title-sm">{a?.name || 'Silinmiş aktivite'}</div><div class="sub">{dayMonth(l.date)}</div></div>
              <b>{fmtDur(l.minutes)}</b>
              <button class="iconbtn" aria-label="Kaydı sil" onClick={() => { if (confirm('Bu kayıt silinsin mi?')) deleteLog(uid, l.id); }}><IconTrash /></button>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
