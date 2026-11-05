import { useRef, useState } from 'preact/hooks';
import { Page, Card } from '../components/ui.jsx';
import { Picker } from '../components/Picker.jsx';
import { Chart } from '../components/Chart.jsx';
import { HabitGrid, HabitChart } from '../components/HabitViews.jsx';
import { IconBack, IconNext, IconTrash, IconEdit } from '../icons.jsx';
import { MODES, buildSeries, makeBuckets, habitList, habitBucket, habitStreak, countIn, fmtDur } from '../lib/stats.js';
import { today, dayMonth, diffDays } from '../lib/dates.js';
import { deleteLog } from '../data.js';

const oneDecimal = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

// Rapor: what was DONE (days), per activity or repeating task. Minutes are an optional extra, shown separately for one activity.
export function Report({ uid, data, activityId, nav }) {
  const [sel, setSel] = useState(activityId || 'all'); // 'all' = Genel
  const [mode, setMode] = useState('day');
  const [offset, setOffset] = useState(0);
  const touch = useRef(null);
  const t = today();
  const habits = habitList(data);
  const habit = sel === 'all' ? null : habits.find((h) => h.id === sel) || null;
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

  const shown = habit ? [habit] : habits;
  const doneTotal = shown.reduce((s, h) => s + countIn(h, first, upTo), 0);
  const latest = [...buckets].reverse().find((b) => b.start <= t) || buckets[0];
  const reached = habits.filter((h) => {
    const b = mode === 'day' ? { start: first, end: last } : latest;
    const { count, target } = habitBucket(h, b);
    return count >= (target ?? 1);
  }).length;
  const logsInRange = data.logs.filter((l) => l.date >= first && l.date <= last && (!filterId || l.activityId === filterId));
  const minutes = logsInRange.reduce((s, l) => s + (l.minutes || 0), 0);
  const series = filterId && minutes > 0 ? buildSeries(data.logs, { activityId: filterId, mode, offset, today: t }) : null;

  const picks = [{ value: 'all', label: 'Genel' }, ...habits.map((h) => ({ value: h.id, label: h.name }))];
  const created = (l) => l.createdAt?.toMillis?.() ?? 9e15;
  const recent = habit?.kind === 'görev' ? [] : data.logs.filter((l) => !filterId || l.activityId === filterId)
    .slice().sort((a, b) => (b.date + created(b)).localeCompare(a.date + created(a))).slice(0, 10);

  return (
    <Page title="Rapor" onClose={nav.back}>
      <Picker items={picks} value={sel} onChange={setSel} label="Aktivite seç" />
      <Picker size="sm" items={Object.entries(MODES).map(([value, label]) => ({ value, label }))} value={mode}
        onChange={(m) => { setMode(m); setOffset(0); }} label="Dönem" />

      <Card>
        <div class="row" style="justify-content:space-between;margin-bottom:4px">
          <button class="iconbtn" aria-label="Önceki dönem" onClick={() => page(-1)}><IconBack /></button>
          <div class="title-sm" aria-live="polite">{dayMonth(first)} – {dayMonth(last)}</div>
          <button class="iconbtn" aria-label="Sonraki dönem" disabled={offset === 0} onClick={() => page(1)}><IconNext /></button>
        </div>
        <div key={`${sel}-${mode}-${offset}`} class="swap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style="touch-action:pan-y">
          {habits.length === 0 ? <div class="sub" style="padding:14px 0">Henüz takip edilen bir şey yok. Kişisel sayfasından aktivite ya da tekrarlı görev ekle.</div>
            : habit ? <HabitChart habit={habit} buckets={buckets} mode={mode} today={t} />
              : <HabitGrid habits={habits} buckets={buckets} mode={mode} today={t} onPick={setSel} />}
        </div>
        {habits.length > 0 && (
          <div class="sub" style="margin-top:8px;line-height:1.4">
            {habit
              ? (mode === 'day' ? 'Dolu çubuk: o gün yapıldı.' : 'Çubuk: o dönemde yapılan gün sayısı, kesikli çizgi hedef.')
              : (mode === 'day' ? 'Dolu daire: o gün yapıldı.' : 'Daire o dönemin hedefine göre dolar, sayı yapılan gün sayısıdır.')} Bir satıra dokununca onun grafiği açılır.
          </div>
        )}
      </Card>

      <div class="stat-grid">
        <div class="card stat"><span class="sub">Yapılan gün</span><b>{doneTotal}</b></div>
        {habit
          ? <div class="card stat"><span class="sub">Haftalık ort.</span><b>{oneDecimal(countIn(habit, first, upTo) / (rangeDays / 7))} gün</b></div>
          : <div class="card stat"><span class="sub">Hedefi tutan</span><b>{reached}/{habits.length}</b></div>}
        <div class="card stat"><span class="sub">Gün serisi</span><b>{habitStreak(habits, habit?.id || null, t)} gün</b></div>
        <div class="card stat"><span class="sub">Kayıtlı süre</span><b>{minutes > 0 ? fmtDur(minutes) : '—'}</b></div>
      </div>

      {series && (
        <Card label="SÜRE (İSTEĞE BAĞLI KAYITLAR)">
          <Chart series={series} colorOf={() => habit.color} single />
        </Card>
      )}

      {habit?.kind === 'görev' ? (
        <div class="sub" style="padding:0 4px;line-height:1.45">Görevin yapıldı günleri Bugün ekranındaki tiklerden gelir.</div>
      ) : (
        <>
          <div class="label">SON KAYITLAR</div>
          <div class="card list-card">
            {recent.length === 0 && <div class="sub" style="padding:14px 0">Henüz kayıt yok.</div>}
            {recent.map((l) => {
              const a = data.activities.find((x) => x.id === l.activityId);
              return (
                <div class="list-row" key={l.id}>
                  <span class="dot" style={`background:var(--act-${a?.color ?? 0})`} />
                  <div class="grow"><div class="title-sm">{a?.name || 'Silinmiş aktivite'}</div><div class="sub">{dayMonth(l.date)}</div></div>
                  <b>{l.minutes ? fmtDur(l.minutes) : 'Yapıldı'}</b>
                  <button class="iconbtn" aria-label="Kaydı düzenle" onClick={() => nav.go({ n: 'log', logId: l.id })}><IconEdit /></button>
                  <button class="iconbtn" aria-label="Kaydı sil" onClick={() => { if (confirm('Bu kayıt silinsin mi?')) deleteLog(uid, l.id); }}><IconTrash /></button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
