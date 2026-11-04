import { useState } from 'preact/hooks';
import { Card } from '../components/ui.jsx';
import { callWorker, workerConfigured } from '../worker.js';
import { saveInsight } from '../data.js';
import { today, weekStart, addDays } from '../lib/dates.js';

// Last 4 weeks (oldest first, current week last) of minutes per active activity, plus the weekly target if known.
export function buildInsightInput(data, t = today()) {
  const ws = weekStart(t);
  const starts = [-3, -2, -1, 0].map((n) => addDays(ws, n * 7));
  return data.activities.filter((a) => !a.archived).map((a) => ({
    name: a.name,
    weeklyTargetMin: a.dailyMinutes && a.weeklyDays ? a.dailyMinutes * a.weeklyDays : null,
    weeks: starts.map((s) => data.logs.filter((l) => l.activityId === a.id && l.date >= s && l.date <= addDays(s, 6)).reduce((sum, l) => sum + l.minutes, 0)),
  })).filter((a) => a.weeks.some((m) => m > 0));
}

// Kişisel > haftalık yapay zekâ yorumu. Generated on demand, cached once per week (SPEC §8).
export function InsightCard({ uid, data }) {
  const weekId = weekStart(today());
  const cached = data.insights.find((i) => i.id === weekId);
  const [state, setState] = useState('idle'); // idle | loading | error | limit
  if (!workerConfigured) return null;
  const input = buildInsightInput(data);

  async function generate() {
    setState('loading');
    try {
      const r = await callWorker('/ai/weekly', { activities: input });
      saveInsight(uid, weekId, { text: r.text, tips: r.tips || [] });
      setState('idle');
    } catch (e) { setState(e.status === 429 ? 'limit' : 'error'); }
  }

  return (
    <Card label="HAFTALIK YORUM">
      {cached ? (
        <>
          <div class="title-sm" style="font-weight:600;line-height:1.5">{cached.text}</div>
          {(cached.tips || []).length > 0 && (
            <ul style="margin:10px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
              {cached.tips.map((tp, i) => <li key={i} class="sub" style="font-size:14px">{tp}</li>)}
            </ul>
          )}
          <div class="sub" style="margin-top:10px">Yapay zekâ tarafından üretildi; bu hafta için bir kez.</div>
        </>
      ) : input.length === 0 ? (
        <div class="sub">Yorum için önce birkaç süre kaydı ekle.</div>
      ) : (
        <>
          <div class="sub">Son 4 haftanın toplam süreleri özetlenir. Yalnızca aktivite adları ve süreler gönderilir.</div>
          <button class="btn" style="margin-top:12px" disabled={state === 'loading'} onClick={generate}>{state === 'loading' ? 'Hazırlanıyor…' : 'Yorum oluştur'}</button>
          {state === 'error' && <div class="error" role="alert" style="margin-top:8px">Yorum oluşturulamadı, biraz sonra tekrar dene.</div>}
          {state === 'limit' && <div class="error" role="alert" style="margin-top:8px">Bugünkü istek sınırına ulaşıldı.</div>}
        </>
      )}
    </Card>
  );
}
