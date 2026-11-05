import { useRef, useState } from 'preact/hooks';
import { Page, Card } from '../components/ui.jsx';
import { Picker } from '../components/Picker.jsx';
import { Chart } from '../components/Chart.jsx';
import { HabitChart } from '../components/HabitViews.jsx';
import { IconBack, IconNext, IconTrash, IconEdit } from '../icons.jsx';
import { MODES, buildSeries, makeBuckets, habitList, habitStreak, countIn, fmtDur } from '../lib/stats.js';
import { today, dayMonth, diffDays } from '../lib/dates.js';
import { deleteLog } from '../data.js';

const oneDecimal = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// Rapor: one activity or repeating task at a time, by days DONE. Minutes are an optional extra, shown separately.
export function Report({ uid, data, activityId, nav }) {
  const habits = habitList(data);
  const [sel, setSel] = useState(activityId || habits[0]?.id || null);
  const [mode, setMode] = useState('day');
  const [offset, setOffset] = useState(0);
  const touch = useRef(null);
  const t = today();
  const habit = habits.find((h) => h.id === sel) || habits[0] || null;
  const filterId = habit?.kind === 'aktivite' ? habit.id : null;
  const buckets = makeBuckets(mode, offset, t);
  const first = buckets[0].start, last = buckets[buckets.length - 1].end;
  const upTo = last < t ? last : t; // days that have not come yet do not count
  const rangeDays = Math.max(1, diffDays(upTo, first) + 1);
  const page = (d) => setOffset((o) => Math.min(0, o + d));

  const onTouchStart = (e) => { touch.current = e.changedTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touch.current == null) return;
    const dx = e.changedTouches[0].clientX - touch.current;
    touch.current = null;
    if (Math.abs(dx) > 50) page(dx > 0 ? -1 : 1); // swipe right = earlier
  };

  if (!habit) {
    return (
      <Page title="Rapor" onClose={nav.back}>
        <div class="card empty">
          <div class="title-sm">Henüz takip edilen bir şey yok</div>
          <div class="sub">Kişisel sayfasından aktivite ya da tekrarlı görev ekle.</div>
        </div>
      </Page>
    );
  }

  const done = countIn(habit, first, upTo);
  const logsInRange = filterId ? data.logs.filter((l) => l.activityId === filterId && l.date >= first && l.date <= last) : [];
  const minutes = logsInRange.reduce((s, l) => s + (l.minutes || 0), 0);
  const series = filterId && minutes > 0 ? buildSeries(data.logs, { activityId: filterId, mode, offset, today: t }) : null;

  const picks = habits.map((h) => ({ value: h.id, label: h.name }));
  const created = (l) => l.createdAt?.toMillis?.() ?? 9e15;
  const recent = filterId ? data.logs.filter((l) => l.activityId === filterId)
    .slice().sort((a, b) => (b.date + created(b)).localeCompare(a.date + created(a))).slice(0, 10) : [];

  return (
    <Page title="Rapor" onClose={nav.back}>
      <Picker items={picks} value={habit.id} onChange={setSel} label="Aktivite seç" />
      <Picker size="sm" items={Object.entries(MODES).map(([value, label]) => ({ value, label }))} value={mode}
        onChange={(m) => { setMode(m); setOffset(0); }} label="Dönem" />

      <Card>
        <div class="row" style="justify-content:space-between;margin-bottom:4px">
          <button class="iconbtn" aria-label="Önceki dönem" onClick={() => page(-1)}><IconBack /></button>
          <div class="title-sm" aria-live="polite">{dayMonth(first)} – {dayMonth(last)}</div>
          <button class="iconbtn" aria-label="Sonraki dönem" disabled={offset === 0} onClick={() => page(1)}><IconNext /></button>
        </div>
        <div key={`${habit.id}-${mode}-${offset}`} class="swap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style="touch-action:pan-y">
          <HabitChart habit={habit} buckets={buckets} mode={mode} today={t} />
        </div>
        <div class="sub" style="margin-top:8px;line-height:1.4">
          {mode === 'day' ? 'Dolu çubuk: o gün yapıldı.' : 'Çubuk: o dönemde yapılan gün sayısı, kesikli çizgi hedef.'}
        </div>
      </Card>

      <div class="stat-grid">
        <div class="card stat"><span class="sub">Yapılan gün</span><b>{done}</b></div>
        <div class="card stat"><span class="sub">Haftalık ort.</span><b>{oneDecimal(done / (rangeDays / 7))} gün</b></div>
        <div class="card stat"><span class="sub">Gün serisi</span><b>{habitStreak(habits, habit.id, t)} gün</b></div>
        <div class="card stat"><span class="sub">Kayıtlı süre</span><b>{minutes > 0 ? fmtDur(minutes) : '—'}</b></div>
      </div>

      {series && (
        <Card label="SÜRE (İSTEĞE BAĞLI KAYITLAR)">
          <Chart series={series} colorOf={() => habit.color} single />
        </Card>
      )}

      {habit.kind === 'görev' ? (
        <div class="sub" style="padding:0 4px;line-height:1.45">Görevin yapıldı günleri Bugün ekranındaki tiklerden gelir.</div>
      ) : (
        <>
          <div class="label">SON KAYITLAR</div>
          <div class="card list-card">
            {recent.length === 0 && <div class="sub" style="padding:14px 0">Henüz kayıt yok.</div>}
            {recent.map((l) => (
              <div class="list-row" key={l.id}>
                <span class="dot" style={`background:var(--act-${habit.color ?? 0})`} />
                <div class="grow"><div class="title-sm">{habit.name}</div><div class="sub">{dayMonth(l.date)}</div></div>
                <b>{l.minutes ? fmtDur(l.minutes) : 'Yapıldı'}</b>
                <button class="iconbtn" aria-label="Kaydı düzenle" onClick={() => nav.go({ n: 'log', logId: l.id })}><IconEdit /></button>
                <button class="iconbtn" aria-label="Kaydı sil" onClick={() => { if (confirm('Bu kayıt silinsin mi?')) deleteLog(uid, l.id); }}><IconTrash /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
