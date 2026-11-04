import { useState } from 'preact/hooks';
import { Card, Chips } from '../components/ui.jsx';
import { callWorker, workerConfigured } from '../worker.js';
import { saveInsight } from '../data.js';
import { today, weekStart, addDays } from '../lib/dates.js';
import { streak as calcStreak } from '../lib/stats.js';

const sum = (logs) => logs.reduce((s, l) => s + l.minutes, 0);

// Last 4 weeks (oldest first, current week last) of minutes per active activity, plus the weekly target if known.
export function buildInsightInput(data, t = today()) {
  const ws = weekStart(t);
  const starts = [-3, -2, -1, 0].map((n) => addDays(ws, n * 7));
  return data.activities.filter((a) => !a.archived).map((a) => ({
    name: a.name,
    weeklyTargetMin: a.dailyMinutes && a.weeklyDays ? a.dailyMinutes * a.weeklyDays : null,
    weeks: starts.map((s) => sum(data.logs.filter((l) => l.activityId === a.id && l.date >= s && l.date <= addDays(s, 6)))),
  })).filter((a) => a.weeks.some((m) => m > 0));
}

// Today's minutes + last 7 days per active activity, overall streak and the hour of day.
export function buildDailyInput(data, t = today(), hour = new Date().getHours()) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
  const activities = data.activities.filter((a) => !a.archived).map((a) => {
    const last7 = days.map((d) => sum(data.logs.filter((l) => l.activityId === a.id && l.date === d)));
    return { name: a.name, todayMin: last7[6], dailyTargetMin: a.dailyMinutes || null, last7 };
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
            <div class="sub" style="margin-top:10px">Yapay zekâ tarafından üretildi; {mode === 'day' ? 'bugün' : 'bu hafta'} için bir kez.</div>
          </>
        ) : !hasData ? (
          <div class="sub">{mode === 'day' ? 'Değerlendirme için son günlerde birkaç süre kaydı ekle.' : 'Değerlendirme için son haftalarda birkaç süre kaydı ekle.'}</div>
        ) : (
          <>
            <div class="sub">{mode === 'day' ? 'Bugünün süreleri değerlendirilir ve kısa bir motivasyon notu eklenir.' : 'Son 4 haftanın toplam süreleri özetlenir.'} Yalnızca aktivite adları ve süreler gönderilir.</div>
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
