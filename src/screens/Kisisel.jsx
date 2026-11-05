import { useState } from 'preact/hooks';
import { InsightCard } from './InsightCard.jsx';
import { Card, Progress } from '../components/ui.jsx';
import { Seg } from '../components/Seg.jsx';
import { IconLock, IconPlus, IconNext } from '../icons.jsx';
import { fmtDur, goalProgress, activeDays, taskDone } from '../lib/stats.js';
import { today, weekStart, addDays, DAY_SHORT, dayMonth } from '../lib/dates.js';

const when = (task) => (task.repeat === 'daily' ? 'Her gün' : task.repeat === 'days' ? (task.days || []).slice().sort().map((d) => DAY_SHORT[d]).join(' · ') : dayMonth(task.date));

// Kişisel: week summary on top, then one tab at a time (activities / tasks / goals).
export function Kisisel({ me, data, nav, onSettings }) {
  const [tab, setTab] = useState('akt');
  const t = today(), ws = weekStart(t), we = addDays(ws, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const weekLogs = data.logs.filter((l) => l.date >= ws && l.date <= we);
  const byDay = (d, id) => weekLogs.filter((l) => l.date === d && (!id || l.activityId === id)).reduce((s, l) => s + l.minutes, 0);
  const weekTotal = weekLogs.reduce((s, l) => s + l.minutes, 0);
  const maxDay = Math.max(30, ...days.map((d) => byDay(d)));
  const colorOf = (id) => data.activities.find((a) => a.id === id)?.color ?? 0;

  return (
    <main class="screen">
      <div class="topbar">
        <div>
          <h1 style="font-size:40px">Kişisel</h1>
          <span class="badge" style="margin-top:8px"><IconLock />Sadece sen görürsün</span>
        </div>
        <button class={`avatar p${me.slot ?? 0}`} aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
      </div>

      <button class="card tap" onClick={() => nav.go({ n: 'report' })} aria-label="Bu hafta, raporu aç">
        <div class="row" style="justify-content:space-between;align-items:baseline">
          <span class="title-sm muted">Bu hafta</span>
          <span class="num" style="font-size:20px">{fmtDur(weekTotal)}</span>
        </div>
        <div class="week-bars">
          {days.map((d, i) => {
            const parts = [...new Set(weekLogs.filter((l) => l.date === d).map((l) => l.activityId))];
            return (
              <div key={d} class="week-col">
                <div class="week-stack" style="height:60px">
                  {parts.length === 0 && <div class="wk" style="height:4px;background:var(--track)" />}
                  {parts.map((id) => <div key={id} class="wk" style={`height:${Math.max(4, (byDay(d, id) / maxDay) * 54)}px;background:var(--act-${colorOf(id)})`} />)}
                </div>
                <span class="sub">{DAY_SHORT[i]}</span>
              </div>
            );
          })}
        </div>
        <div class="sub" style="margin-top:6px;display:flex;align-items:center;gap:4px">Rapor ve grafikler <IconNext /></div>
      </button>

      <Seg items={[{ value: 'akt', label: 'Aktivite', badge: data.activities.length || null }, { value: 'gor', label: 'Görev', badge: data.tasks.length || null }, { value: 'hed', label: 'Hedef' }]} value={tab} onChange={setTab} label="Kişisel bölüm" />

      {tab === 'akt' && (
        <>
          <Card>
            {data.activities.length === 0 && <div class="sub" style="padding:6px 0">Henüz aktivite yok. İngilizce, spor, yazılım… Takip etmek istediğin şeyi ekle.</div>}
            {data.activities.map((a) => {
              const n = activeDays(data.logs, a.id, ws, we);
              return (
                <button key={a.id} class="vact-row" style={`--c:var(--act-${a.color})`} onClick={() => nav.go({ n: 'activity', id: a.id })} aria-label={`${a.name}, düzenle`}>
                  <div class="row" style="justify-content:space-between">
                    <span class="row" style="gap:10px"><span class="dot" style="background:var(--c)" /><span class="title-sm">{a.name}</span></span>
                    <span class="sub">{n}/{a.weeklyDays} gün{a.dailyMinutes ? ` · ${a.dailyMinutes} dk` : ''}</span>
                  </div>
                  <Progress pct={(n / a.weeklyDays) * 100} color="var(--c)" />
                </button>
              );
            })}
          </Card>
          <button class="btn wide" onClick={() => nav.go({ n: 'activity' })}><IconPlus />Aktivite ekle</button>
        </>
      )}

      {tab === 'gor' && (
        <>
          <Card class="list-card-pad">
            {data.tasks.length === 0 && <div class="sub" style="padding:8px 0">Henüz görev yok.</div>}
            {data.tasks.map((x) => (
              <button key={x.id} class="list-row task-later" onClick={() => nav.go({ n: 'task', id: x.id })} aria-label={`${x.title}, ${when(x)}, düzenle`}>
                <span class={taskDone(x, t) ? 'title-sm grow struck' : 'title-sm grow'} style="text-align:left">{x.title}</span>
                <span class="sub">{when(x)}{x.remindTime ? ` · ${x.remindTime}` : ''}</span><IconNext />
              </button>
            ))}
          </Card>
          <button class="btn wide" onClick={() => nav.go({ n: 'task' })}><IconPlus />Görev ekle</button>
        </>
      )}

      {tab === 'hed' && (
        <>
          <Card>
            {data.goals.length === 0 && <div class="sub" style="padding:6px 0">Henüz hedef yok.</div>}
            {data.goals.map((g) => {
              const p = goalProgress(g, data.logs);
              return (
                <button key={g.id} class="vact-row" onClick={() => nav.go({ n: 'goal', id: g.id })}>
                  <div class="row" style="justify-content:space-between"><span class="title-sm">{g.title}</span><span class="sub">{p}/{g.target} {g.unit}</span></div>
                  <Progress pct={(p / g.target) * 100} />
                </button>
              );
            })}
          </Card>
          <button class="chip" style="min-height:48px" onClick={() => nav.go({ n: 'goals' })}>Tüm hedefler ve yeni hedef</button>
          <InsightCard uid={me.uid} data={data} />
        </>
      )}
    </main>
  );
}
