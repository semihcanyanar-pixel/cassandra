import { useState } from 'preact/hooks';
import { useAutoNote } from '../autoNote.js';
import { Card, Progress } from '../components/ui.jsx';
import { Seg } from '../components/Seg.jsx';
import { DoseRow } from '../components/Dose.jsx';
import { ortakStart } from './Ortak.jsx';
import { medPeople, personById, dosesForDay, hhmm, mealText } from '../lib/meds.js';
import { fmtDur, minutesByDay, streak, tasksForDay, taskDone } from '../lib/stats.js';
import { occurrences, tagScopes } from '../lib/events.js';
import { today, addDays, DAY_SHORT, dayMonth } from '../lib/dates.js';
import { toggleTask, markDose, unmarkDose } from '../data.js';

// Design alternatives for the Bugün screen (dev demo only). Same data, different layouts: a = focus, b = timeline, c = counters.

const dateLabel = () => new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
const Tick = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Cross = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;

const when = (task) => (task.repeat === 'daily' ? 'Her gün' : task.repeat === 'days' ? (task.days || []).slice().sort().map((d) => DAY_SHORT[d]).join(' · ') : dayMonth(task.date));

// Everything due today as one list: tasks, doses, events.
function model({ session, me, uid, data, house, nav, goTab }) {
  const t = today(), now = hhmm();
  const people = medPeople(session.household, me.uid);
  const doses = dosesForDay(house.medications, house.medLogs, t, now);
  const todays = tasksForDay(data.tasks, t);
  const later = data.tasks.filter((x) => !todays.includes(x) && (x.repeat === 'daily' || x.repeat === 'days' || x.date > t));
  const events = occurrences(tagScopes(house.events, data.events), t, t);
  const openMed = () => { ortakStart.sub = 'ilac'; goTab('ortak'); };

  const items = [
    ...todays.map((task) => ({
      k: 'task', id: `t${task.id}`, time: task.remindTime || null, title: task.title, sub: task.repeat === 'daily' ? 'Her gün' : task.repeat === 'days' ? when(task) : null,
      done: taskDone(task, t), tick: () => toggleTask(uid, task, t, !taskDone(task, t)), open: () => nav.go({ n: 'task', id: task.id }),
    })),
    ...doses.map((d) => {
      const who = personById(people, d.med.forId, me.uid).name;
      const st = d.log?.status;
      return {
        k: 'dose', id: `d${d.id}`, time: d.time, title: `${who} · ${d.med.name}`,
        sub: st === 'alindi' ? 'Alındı' : st === 'atlandi' ? 'Kaçtı' : d.missed ? 'Kaçtı' : [d.med.dose, mealText(d.med.meal)].filter(Boolean).join(' · ') || null,
        done: Boolean(d.log), missed: d.missed, dose: d,
        tick: () => (d.log ? (confirm('İşaret geri alınsın mı?') && unmarkDose(session.hid, d.id)) : markDose(session.hid, me.uid, d, 'alindi')),
        cross: d.log || d.missed ? null : () => markDose(session.hid, me.uid, d, 'atlandi'),
        open: openMed,
      };
    }),
    ...events.map((e) => ({ k: 'event', id: `e${e.scope}${e.id}`, time: e.time || null, title: e.title, sub: e.scope === 'kisisel' ? 'Kişisel' : null, done: false, open: () => goTab('takvim') })),
  ].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const rows = data.activities.map((a) => ({ a, min: minutesByDay(data.logs, a.id)[t] || 0 }));
  const total = data.logs.filter((l) => l.date === t).reduce((s, l) => s + l.minutes, 0);
  const targeted = rows.filter((r) => r.a.dailyMinutes);
  const targetSum = targeted.reduce((s, r) => s + r.a.dailyMinutes, 0);
  const reached = targeted.reduce((s, r) => s + Math.min(r.min, r.a.dailyMinutes), 0);
  const trackable = items.filter((i) => i.k !== 'event');
  return {
    t, now, items, later, rows, total, run: streak(data.logs, null, t), pct: targetSum ? Math.round((reached / targetSum) * 100) : null,
    doneCount: trackable.filter((i) => i.done).length, allCount: trackable.length, doses, people,
    taskCount: [todays.filter((x) => taskDone(x, t)).length, todays.length], doseCount: [doses.filter((d) => d.log).length, doses.length],
  };
}

function Top({ me, onSettings }) {
  return (
    <div class="topbar">
      <div>
        <div class="title-sm muted">Merhaba {me.name}</div>
        <h1>{dateLabel()}</h1>
      </div>
      <button class={`avatar p${me.slot ?? 0}`} aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
    </div>
  );
}

function Row({ it }) {
  return (
    <div class={`vrow ${it.done ? 'done' : ''} ${it.missed ? 'missed' : ''}`}>
      {it.tick
        ? <button class={it.done ? 'check on' : 'check'} role="checkbox" aria-checked={it.done} aria-label={it.title} onClick={it.tick}>{it.done && <Tick />}</button>
        : <span class="vdot" aria-hidden="true" />}
      <button class="vmain grow" onClick={it.open}>
        <span class={it.done ? 'title-sm struck' : 'title-sm'}>{it.title}</span>
        {it.sub && <span class="sub">{it.sub}</span>}
      </button>
      {it.time && <span class="num vtime">{it.time}</span>}
      {it.cross && <button class="iconbtn" aria-label={`${it.title} kaçtı`} onClick={it.cross}><Cross /></button>}
    </div>
  );
}

function ActivityChips({ m, nav }) {
  if (!m.rows.length) return <button class="card tap" onClick={() => nav.go({ n: 'activity' })}><span class="title-sm">İlk aktiviteni ekle</span></button>;
  return (
    <div class="scroll-chips" aria-label="Aktiviteler">
      {m.rows.map(({ a, min }) => (
        <button key={a.id} class="vact" data-c={a.color} style={`--c:var(--act-${a.color})`} onClick={() => nav.go({ n: 'log', activityId: a.id })} aria-label={`${a.name}: bugün ${min} dakika. Süre ekle`}>
          <span class="vact-dot" /><span class="title-sm">{a.name}</span>
          <span class="num">{min}{a.dailyMinutes ? `/${a.dailyMinutes}` : ''}<small> dk</small></span>
        </button>
      ))}
    </div>
  );
}

function NoteCards({ uid, data }) {
  const { note, weekly } = useAutoNote(uid, data);
  return (
    <>
      {weekly && <Card label="HAFTALIK DEĞERLENDİRME"><div class="title-sm" style="font-weight:600;line-height:1.5">{weekly.text}</div></Card>}
      {note && (
        <Card label={`GÜNÜN NOTU · ${note.slot.label.toLocaleUpperCase('tr-TR')}`}>
          <div class="title-sm" style="font-weight:600;line-height:1.5">{note.text}</div>
          {note.quote && <div class="sub" style="margin-top:10px;font-size:14px;font-style:italic">{note.quote}</div>}
        </Card>
      )}
    </>
  );
}

// A: one clear "what is next" card, then a single list for the day.
function VariantA({ m, p }) {
  const pending = m.items.filter((i) => !i.done && i.k !== 'event');
  const next = pending.find((i) => i.time && i.time >= m.now) || pending[0] || null;
  const list = m.items.filter((i) => !i.done);
  const done = m.items.filter((i) => i.done);
  return (
    <>
      <div class="vhero">
        <div class="label" style="margin:0;padding:0;color:inherit;opacity:.8">{next ? 'SIRADA' : 'BUGÜN'}</div>
        {next ? (
          <>
            <div class="vhero-title">{next.title}</div>
            <div class="vhero-sub">{[next.time, next.sub].filter(Boolean).join(' · ') || 'Gün boyu'}</div>
            <button class="vhero-btn" onClick={next.tick}><Tick />{next.k === 'dose' ? 'Alındı' : 'Tamamla'}</button>
          </>
        ) : <div class="vhero-title">Bugünlük bu kadar</div>}
        <div class="vhero-prog"><Progress pct={m.allCount ? (m.doneCount / m.allCount) * 100 : 100} color="currentColor" /><span>{m.doneCount}/{m.allCount} tamam</span></div>
      </div>

      <Card label="BUGÜN">
        {list.length === 0 && <div class="sub" style="padding:8px 0">Bekleyen iş yok.</div>}
        {list.map((it) => <Row key={it.id} it={it} />)}
        {done.length > 0 && <details class="vdone"><summary>Tamamlananlar ({done.length})</summary>{done.map((it) => <Row key={it.id} it={it} />)}</details>}
      </Card>

      <div class="label">SÜRE · {fmtDur(m.total)}{m.pct != null ? ` · hedefin %${m.pct}'i` : ''}</div>
      <ActivityChips m={m} nav={p.nav} />
      <NoteCards uid={p.uid} data={p.data} />
    </>
  );
}

// B: the day as a timeline.
function VariantB({ m, p }) {
  const untimed = m.items.filter((i) => !i.time);
  const timed = m.items.filter((i) => i.time);
  return (
    <>
      <div class="card vsum">
        <div class="row" style="justify-content:space-between"><span class="title-sm muted">Süre</span><span class="streak-badge">{m.run} gün seri</span></div>
        <div class="num" style="font-size:28px;margin:4px 0 8px">{fmtDur(m.total)}</div>
        <div class="seg-bar">
          {m.rows.filter((r) => r.min > 0).map((r) => <i key={r.a.id} style={`flex:${r.min} 1 0;background:var(--act-${r.a.color})`} />)}
          {m.total === 0 && <i class="seg-rest" style="flex:1 1 0;background:var(--track)" />}
        </div>
      </div>
      <ActivityChips m={m} nav={p.nav} />

      {untimed.length > 0 && <Card label="GÜN BOYU">{untimed.map((it) => <Row key={it.id} it={it} />)}</Card>}
      <div class="label">AKIŞ</div>
      <div class="tl">
        {timed.length === 0 && <div class="sub">Saatli iş yok.</div>}
        {timed.map((it) => (
          <div class={`tl-i ${it.done ? 'done' : ''} ${!it.done && it.time < m.now ? 'past' : ''}`} key={it.id}>
            <span class="tl-time num">{it.time}</span>
            <span class="tl-dot" />
            <div class="card tl-card"><Row it={{ ...it, time: null }} /></div>
          </div>
        ))}
      </div>
      <NoteCards uid={p.uid} data={p.data} />
    </>
  );
}

// C: three counters that double as tabs.
function VariantC({ m, p }) {
  const [tab, setTab] = useState('gorev');
  const tasks = m.items.filter((i) => i.k === 'task');
  const events = m.items.filter((i) => i.k === 'event');
  const tabs = [
    { v: 'gorev', n: `${m.taskCount[0]}/${m.taskCount[1]}`, l: 'Görev' },
    { v: 'ilac', n: `${m.doseCount[0]}/${m.doseCount[1]}`, l: 'İlaç' },
    { v: 'sure', n: fmtDur(m.total).replace(' sa ', 's ').replace(' dk', 'dk'), l: 'Süre' },
  ];
  return (
    <>
      <div class="vstats" role="tablist">
        {tabs.map((x) => (
          <button key={x.v} role="tab" aria-selected={tab === x.v} class={tab === x.v ? 'vstat on' : 'vstat'} onClick={() => setTab(x.v)}>
            <span class="num vstat-n">{x.n}</span><span class="sub">{x.l}</span>
          </button>
        ))}
      </div>

      {tab === 'gorev' && (
        <Card>
          {tasks.length === 0 && <div class="sub" style="padding:8px 0">Bugün için görev yok.</div>}
          {tasks.map((it) => <Row key={it.id} it={it} />)}
          {events.map((it) => <Row key={it.id} it={it} />)}
          {m.later.length > 0 && (
            <>
              <div class="label" style="margin:14px 0 2px;padding:0">DİĞER GÜNLER</div>
              {m.later.map((x) => <Row key={x.id} it={{ id: x.id, title: x.title, sub: when(x), open: () => p.nav.go({ n: 'task', id: x.id }) }} />)}
            </>
          )}
        </Card>
      )}
      {tab === 'ilac' && (
        <Card class="list-card-pad med-card">
          {m.doses.length === 0 && <div class="sub" style="padding:8px 0">Bugün ilaç yok.</div>}
          {m.doses.map((d) => <DoseRow key={d.id} dose={d} people={m.people} uid={p.me.uid} hid={p.session.hid} next={false} now={m.now} />)}
        </Card>
      )}
      {tab === 'sure' && (
        <div class="tiles">
          {m.rows.map(({ a, min }) => (
            <button key={a.id} class="tile" data-c={a.color} style={`--c:var(--act-${a.color})`} onClick={() => p.nav.go({ n: 'log', activityId: a.id })}>
              <span class="tile-name">{a.name}</span>
              <span class="tile-val num">{min}<small> dk</small></span>
              {a.dailyMinutes ? <><Progress pct={(min / a.dailyMinutes) * 100} color="var(--tile-bar)" /><span class="tile-sub">hedef {a.dailyMinutes} dk</span></> : <span class="tile-sub">hedefsiz</span>}
            </button>
          ))}
        </div>
      )}
      <NoteCards uid={p.uid} data={p.data} />
    </>
  );
}

export function BugunV({ v, ...p }) {
  const m = model(p);
  return (
    <main class="screen">
      <Top me={p.me} onSettings={p.onSettings} />
      {v === 'a' ? <VariantA m={m} p={p} /> : v === 'b' ? <VariantB m={m} p={p} /> : <VariantC m={m} p={p} />}
    </main>
  );
}
