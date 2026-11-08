import { TopActions } from '../components/TopActions.jsx';
import { useState } from 'preact/hooks';
import { InsightCard } from './InsightCard.jsx';
import { Card, Progress, actColor } from '../components/ui.jsx';
import { Seg } from '../components/Seg.jsx';
import { IconLock, IconPlus, IconNext } from '../icons.jsx';
import { HabitGrid } from '../components/HabitViews.jsx';
import { goalProgress, activeDays, taskDone, habitList, makeBuckets, countIn } from '../lib/stats.js';
import { today, weekStart, addDays, DAY_SHORT, dayMonth } from '../lib/dates.js';

const when = (task) => (task.repeat === 'daily' ? 'Her gün' : task.repeat === 'days' ? (task.days || []).slice().sort().map((d) => DAY_SHORT[d]).join(' · ') : dayMonth(task.date));

// Kişisel: week summary on top, then one tab at a time (activities / tasks / goals).
export function Kisisel({ me, data, nav, onSettings }) {
  const [tab, setTab] = useState('akt');
  const t = today(), ws = weekStart(t), we = addDays(ws, 6);
  const habits = habitList(data);
  const buckets = makeBuckets('day', 0, t);
  // days done this week against the weekly targets (a habit never counts above its target)
  const doneDays = habits.reduce((n, h) => n + Math.min(h.weekly, countIn(h, ws, we)), 0);
  const planned = habits.reduce((n, h) => n + h.weekly, 0);

  return (
    <main class="screen">
      <div class="topbar outlined">
        <div>
          <h1 style="font-size:40px">Kişisel</h1>
          <span class="badge" style="margin-top:8px"><IconLock />Sadece sen görürsün</span>
        </div>
        <TopActions me={me} onSettings={onSettings} />
      </div>

      <button class="card tap" onClick={() => nav.go({ n: 'report' })} aria-label="Bu hafta, raporu aç">
        <div class="row" style="justify-content:space-between;align-items:baseline">
          <span class="title-sm muted">Bu hafta</span>
          <span class="num" style="font-size:20px">{doneDays}/{planned} gün</span>
        </div>
        {habits.length === 0
          ? <div class="sub" style="padding:10px 0">Henüz takip edilen bir şey yok.</div>
          : <div style="margin-top:8px"><HabitGrid habits={habits.slice(0, 5)} buckets={buckets} mode="day" today={t} compact /></div>}
        {habits.length > 5 && <div class="sub" style="margin-top:4px">+{habits.length - 5} tane daha, raporda</div>}
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
                <button key={a.id} class="vact-row" style={`--c:${actColor(a.color)}`} onClick={() => nav.go({ n: 'activity', id: a.id })} aria-label={`${a.name}, düzenle`}>
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
              const p = goalProgress(g, data.logs, data.tasks);
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
