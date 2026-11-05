import { useState } from 'preact/hooks';
import { InsightCard } from './InsightCard.jsx';
import { Card, Progress } from '../components/ui.jsx';
import { Seg } from '../components/Seg.jsx';
import { IconLock, IconPlus, IconNext } from '../icons.jsx';
import { fmtDur, goalProgress, activeDays, taskDone } from '../lib/stats.js';
import { today, weekStart, addDays, DAY_SHORT, dayMonth } from '../lib/dates.js';

// Design alternatives for the Kişisel screen (dev demo only): a = board, b = tabs, c = plain list.

const when = (task) => (task.repeat === 'daily' ? 'Her gün' : task.repeat === 'days' ? (task.days || []).slice().sort().map((d) => DAY_SHORT[d]).join(' · ') : dayMonth(task.date));

function model(data) {
  const t = today(), ws = weekStart(t), we = addDays(ws, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const weekLogs = data.logs.filter((l) => l.date >= ws && l.date <= we);
  const byDay = (d, id) => weekLogs.filter((l) => l.date === d && (!id || l.activityId === id)).reduce((s, l) => s + l.minutes, 0);
  const total = weekLogs.reduce((s, l) => s + l.minutes, 0);
  return { t, ws, we, days, byDay, total, max: Math.max(30, ...days.map((d) => byDay(d))), done: (id) => activeDays(data.logs, id, ws, we) };
}

function Top({ me, onSettings }) {
  return (
    <div class="topbar">
      <div>
        <h1 style="font-size:40px">Kişisel</h1>
        <span class="badge" style="margin-top:8px"><IconLock />Sadece sen görürsün</span>
      </div>
      <button class={`avatar p${me.slot ?? 0}`} aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
    </div>
  );
}

const AddButtons = ({ nav }) => (
  <div class="row" style="gap:10px">
    <button class="btn grow" onClick={() => nav.go({ n: 'activity' })}><IconPlus />Aktivite ekle</button>
    <button class="btn grow" onClick={() => nav.go({ n: 'task' })}><IconPlus />Görev ekle</button>
  </div>
);

function WeekBars({ m, data }) {
  const colorOf = (id) => data.activities.find((a) => a.id === id)?.color ?? 0;
  return (
    <div class="week-bars">
      {m.days.map((d, i) => {
        const parts = [...new Set(data.logs.filter((l) => l.date === d).map((l) => l.activityId))];
        return (
          <div key={d} class="week-col">
            <div class="week-stack" style="height:60px">
              {parts.length === 0 && <div class="wk" style="height:4px;background:var(--track)" />}
              {parts.map((id) => <div key={id} class="wk" style={`height:${Math.max(4, (m.byDay(d, id) / m.max) * 54)}px;background:var(--act-${colorOf(id)})`} />)}
            </div>
            <span class="sub">{DAY_SHORT[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ActivityRow({ a, m, nav }) {
  const n = m.done(a.id);
  return (
    <button class="vact-row" data-c={a.color} style={`--c:var(--act-${a.color})`} onClick={() => nav.go({ n: 'activity', id: a.id })} aria-label={`${a.name}, düzenle`}>
      <div class="row" style="justify-content:space-between">
        <span class="row" style="gap:10px"><span class="dot" style="background:var(--c)" /><span class="title-sm">{a.name}</span></span>
        <span class="sub">{n}/{a.weeklyDays} gün{a.dailyMinutes ? ` · ${a.dailyMinutes} dk` : ''}</span>
      </div>
      <Progress pct={(n / a.weeklyDays) * 100} color="var(--c)" />
    </button>
  );
}

function TaskRows({ data, m, nav }) {
  if (!data.tasks.length) return <div class="sub" style="padding:8px 0">Henüz görev yok.</div>;
  return data.tasks.map((x) => (
    <button key={x.id} class="list-row task-later" onClick={() => nav.go({ n: 'task', id: x.id })} aria-label={`${x.title}, ${when(x)}, düzenle`}>
      <span class={taskDone(x, m.t) ? 'title-sm grow struck' : 'title-sm grow'} style="text-align:left">{x.title}</span>
      <span class="sub">{when(x)}{x.remindTime ? ` · ${x.remindTime}` : ''}</span><IconNext />
    </button>
  ));
}

function GoalRows({ data, nav }) {
  return (
    <>
      {data.goals.length === 0 && <div class="sub" style="padding:8px 0">Henüz hedef yok.</div>}
      {data.goals.map((g) => {
        const p = goalProgress(g, data.logs);
        return (
          <button key={g.id} class="vact-row" onClick={() => nav.go({ n: 'goal', id: g.id })}>
            <div class="row" style="justify-content:space-between"><span class="title-sm">{g.title}</span><span class="sub">{p}/{g.target} {g.unit}</span></div>
            <Progress pct={(p / g.target) * 100} />
          </button>
        );
      })}
      <button class="chip" style="margin-top:6px" onClick={() => nav.go({ n: 'goals' })}>Tüm hedefler</button>
    </>
  );
}

// A: actions on top, week card, compact activity bars, goals, evaluation.
function VariantA({ me, data, nav, m }) {
  return (
    <>
      <AddButtons nav={nav} />
      <button class="card tap" onClick={() => nav.go({ n: 'report' })} aria-label="Bu hafta, raporu aç">
        <div class="row" style="justify-content:space-between;align-items:baseline"><span class="title-sm muted">Bu hafta</span><span class="num" style="font-size:20px">{fmtDur(m.total)}</span></div>
        <WeekBars m={m} data={data} />
        <div class="sub" style="margin-top:6px;display:flex;align-items:center;gap:4px">Rapor ve grafikler <IconNext /></div>
      </button>
      <Card label="AKTİVİTELER">{data.activities.length === 0 ? <div class="sub">Henüz aktivite yok.</div> : data.activities.map((a) => <ActivityRow key={a.id} a={a} m={m} nav={nav} />)}</Card>
      <Card label="GÖREVLER"><TaskRows data={data} m={m} nav={nav} /></Card>
      <Card label="UZUN VADELİ HEDEFLER"><GoalRows data={data} nav={nav} /></Card>
      <InsightCard uid={me.uid} data={data} />
    </>
  );
}

// B: week summary on top, then one tab at a time.
function VariantB({ me, data, nav, m }) {
  const [tab, setTab] = useState('akt');
  return (
    <>
      <button class="card tap" onClick={() => nav.go({ n: 'report' })} aria-label="Bu hafta, raporu aç">
        <div class="row" style="justify-content:space-between;align-items:baseline"><span class="title-sm muted">Bu hafta</span><span class="num" style="font-size:20px">{fmtDur(m.total)}</span></div>
        <WeekBars m={m} data={data} />
      </button>
      <Seg items={[{ value: 'akt', label: 'Aktivite', badge: data.activities.length || null }, { value: 'gor', label: 'Görev', badge: data.tasks.length || null }, { value: 'hed', label: 'Hedef' }]} value={tab} onChange={setTab} label="Kişisel bölüm" />
      {tab === 'akt' && (<><Card>{data.activities.length === 0 ? <div class="sub">Henüz aktivite yok.</div> : data.activities.map((a) => <ActivityRow key={a.id} a={a} m={m} nav={nav} />)}</Card><button class="btn wide" onClick={() => nav.go({ n: 'activity' })}><IconPlus />Aktivite ekle</button></>)}
      {tab === 'gor' && (<><Card class="list-card-pad"><TaskRows data={data} m={m} nav={nav} /></Card><button class="btn wide" onClick={() => nav.go({ n: 'task' })}><IconPlus />Görev ekle</button></>)}
      {tab === 'hed' && (<><Card><GoalRows data={data} nav={nav} /></Card><InsightCard uid={me.uid} data={data} /></>)}
    </>
  );
}

// C: no cards, just big headings and plain rows.
function VariantC({ me, data, nav, m }) {
  return (
    <div class="vplain">
      <section>
        <h2>Bu hafta <span class="num">{fmtDur(m.total)}</span></h2>
        <WeekBars m={m} data={data} />
        <button class="vlink" onClick={() => nav.go({ n: 'report' })}>Rapor ve grafikler <IconNext /></button>
      </section>
      <section>
        <h2>Aktiviteler <button class="vplus" aria-label="Aktivite ekle" onClick={() => nav.go({ n: 'activity' })}><IconPlus /></button></h2>
        {data.activities.map((a) => <ActivityRow key={a.id} a={a} m={m} nav={nav} />)}
      </section>
      <section>
        <h2>Görevler <button class="vplus" aria-label="Görev ekle" onClick={() => nav.go({ n: 'task' })}><IconPlus /></button></h2>
        <TaskRows data={data} m={m} nav={nav} />
      </section>
      <section>
        <h2>Hedefler</h2>
        <GoalRows data={data} nav={nav} />
      </section>
      <InsightCard uid={me.uid} data={data} />
    </div>
  );
}

export function KisiselV({ v, me, data, nav, onSettings }) {
  const m = model(data);
  const P = { me, data, nav, m };
  return (
    <main class="screen">
      <Top me={me} onSettings={onSettings} />
      {v === 'a' ? <VariantA {...P} /> : v === 'b' ? <VariantB {...P} /> : <VariantC {...P} />}
    </main>
  );
}
