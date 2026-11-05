import { useState } from 'preact/hooks';
import { Card, Chips } from '../components/ui.jsx';
import { callWorker, workerConfigured } from '../worker.js';
import { saveInsight } from '../data.js';
import { today, weekStart, addDays } from '../lib/dates.js';
import { streak as calcStreak, habitList, countIn } from '../lib/stats.js';

const sum = (logs) => logs.reduce((s, l) => s + (l.minutes || 0), 0);

// Last 4 weeks (oldest first, current week last): DAYS DONE per habit (activities and repeating tasks) against the weekly target in days.
// Minutes are only an optional extra, sent when the activity has any.
export function buildInsightInput(data, t = today()) {
  const ws = weekStart(t);
  const starts = [-3, -2, -1, 0].map((n) => addDays(ws, n * 7));
  return habitList(data).map((h) => {
    const minutes = h.kind === 'aktivite' ? starts.map((s) => sum(data.logs.filter((l) => l.activityId === h.id && l.date >= s && l.date <= addDays(s, 6)))) : null;
    return {
      name: h.name, kind: h.kind, weeklyTargetDays: h.weekly,
      weeks: starts.map((s) => countIn(h, s, addDays(s, 6))),
      weekMinutes: minutes && minutes.some((m) => m > 0) ? minutes : null,
    };
  }).filter((h) => h.weeks.some((n) => n > 0));
}

// Per habit: done today, done on each of the last 7 days (0/1, last = today), weekly target in days; minutes only when logged.
export function buildDailyInput(data, t = today(), hour = new Date().getHours()) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const activities = habitList(data).map((h) => {
    const last7 = days.map((d) => (h.done.has(d) ? 1 : 0));
    const todayMin = h.kind === 'aktivite' ? sum(data.logs.filter((l) => l.activityId === h.id && l.date === t)) : 0;
    return { name: h.name, kind: h.kind, todayDone: last7[6] === 1, last7, weeklyTargetDays: h.weekly, todayMin: todayMin || null, dailyTargetMin: h.dailyMinutes || null };
  });
  return { activities, hour, streak: calcStreak(data.logs, null, t) };
}

// Kişisel > yapay zekâ yorumu: Günlük (bugünün değerlendirmesi + motivasyon) ve Haftalık. Generated on demand, cached per day / per week.
export function InsightCard({ uid, data }) {
  const [mode, setMode] = useState('day');
  const [state, setState] = useState('idle'); // idle | loading | error | limit
  const [why, setWhy] = useState('');
  if (!workerConfigured) return null;

  const t = today();
  const id = mode === 'day' ? `d-${t}` : `w-${weekStart(t)}`;
  const cached = data.insights.find((i) => i.id === id);
  const daily = buildDailyInput(data, t);
  const weekly = buildInsightInput(data, t);
  const hasData = mode === 'day' || weekly.length > 0; // the daily note also works with no logs yet

  async function generate() {
    setState('loading');
    try {
      const r = mode === 'day'
        ? await callWorker('/ai/daily', daily)
        : await callWorker('/ai/weekly', { activities: weekly });
      saveInsight(uid, id, mode === 'day' ? { text: r.text, quote: r.quote || '' } : { text: r.text, tips: r.tips || [] });
      setState('idle');
    } catch (e) {
      setWhy(e.status ? `kod ${e.status}${e.upstream ? `/${e.upstream}` : ''}${e.detail ? `: ${e.detail}` : ''}` : 'bağlantı kurulamadı');
      setState(e.status === 429 ? 'limit' : 'error');
    }
  }
  const pick = (m) => { setMode(m); setState('idle'); };

  return (
    <Card label="DEĞERLENDİRME">
      <Chips options={[{ value: 'day', label: 'Günlük' }, { value: 'week', label: 'Haftalık' }]} value={mode} onChange={pick} label="Değerlendirme türü" />
      <div style="margin-top:12px">
        {cached ? (
          <>
            <div class="title-sm" style="font-weight:600;line-height:1.5">{cached.text}</div>
            {cached.quote && <div class="sub" style="margin-top:10px;font-size:14px;line-height:1.5;font-style:italic">{cached.quote}</div>}
            {(cached.tips || []).length > 0 && (
              <ul style="margin:10px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
                {cached.tips.map((tp, i) => <li key={i} class="sub" style="font-size:14px">{tp}</li>)}
              </ul>
            )}
          </>
        ) : !hasData ? (
          <div class="sub">{mode === 'day' ? 'Değerlendirme için son günlerde birkaç aktiviteyi işaretle.' : 'Değerlendirme için son haftalarda birkaç aktiviteyi ya da görevi işaretle.'}</div>
        ) : (
          <>
            <div class="sub">{mode === 'day' ? 'Bugün neleri yaptığın değerlendirilir ve kısa bir motivasyon notu eklenir.' : 'Son 4 haftada kaç gün yaptığın özetlenir.'} Yalnızca ad ve yapılan gün sayıları gönderilir.</div>
            <button class="btn" style="margin-top:12px" disabled={state === 'loading'} onClick={generate}>{state === 'loading' ? 'Hazırlanıyor…' : 'Değerlendirme oluştur'}</button>
            {state === 'loading' && <div class="loadbar" role="progressbar" aria-label="Hazırlanıyor"><i /></div>}
            {state === 'error' && <div class="error" role="alert" style="margin-top:8px">Değerlendirme oluşturulamadı, biraz sonra tekrar dene. <span class="sub">({why})</span></div>}
            {state === 'limit' && <div class="error" role="alert" style="margin-top:8px">Bugünkü istek sınırına ulaşıldı.</div>}
          </>
        )}
      </div>
    </Card>
  );
}
