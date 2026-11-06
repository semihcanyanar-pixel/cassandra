import { useState } from 'preact/hooks';
import { useAutoNote } from '../autoNote.js';
import { Card, Progress, actColor, inkKey } from '../components/ui.jsx';
import { ortakStart } from './Ortak.jsx';
import { IconPlus, IconLock } from '../icons.jsx';
import { medPeople, personById, dosesForDay, hhmm, mealText } from '../lib/meds.js';
import { fmtDur, habitList, habitStreak, activeDays, tasksForDay, taskDone } from '../lib/stats.js';
import { occurrences, tagScopes } from '../lib/events.js';
import { today, addDays, dayMonth, weekStart, DAY_SHORT } from '../lib/dates.js';
import { toggleTask, markDose, unmarkDose, markActivityDone, deleteLog, setFamilyTodoDone, deleteFridge } from '../data.js';
import { dueLeft, dueText } from '../lib/due.js';
import { leftDays, leftText } from '../lib/fridge.js';

const dateLabel = () => new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
const Tick = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Cross = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;

const taskWhen = (task) => (task.repeat === 'daily' ? 'Her gün' : task.repeat === 'days' ? (task.days || []).slice().sort().map((d) => DAY_SHORT[d]).join(' · ') : null);

// Bugün: summary, activity tiles (swipe sideways), then the day as a timeline of tasks, doses and events.
export function Bugun({ session, me, uid, data, house, nav, goTab, onSettings }) {
  const t = today(), now = hhmm();
  // Medication doses can be hidden from the timeline, so many doses do not bury the other items. The choice is remembered on this phone.
  const [showMeds, setShowMeds] = useState(() => { try { return localStorage.getItem('cassandra.showMeds') === '1'; } catch { return false; } });
  const toggleMeds = () => setShowMeds((v) => { try { localStorage.setItem('cassandra.showMeds', v ? '0' : '1'); } catch { /* ignore */ } return !v; });
  const { note, weekly } = useAutoNote(uid, data);
  const people = medPeople(session.household, me.uid);
  const doses = dosesForDay(house.medications, house.medLogs, t, now);
  const todays = tasksForDay(data.tasks, t);
  const events = occurrences(tagScopes(house.events, data.events), t, t);
  const upcoming = occurrences(tagScopes(house.events, data.events), t, addDays(t, 180)).slice(0, 3);
  const openMed = () => { ortakStart.sub = 'ilac'; goTab('ortak'); };

  const items = [
    ...todays.map((task) => ({
      id: `t${task.id}`, time: task.remindTime || null, title: task.title, sub: taskWhen(task),
      done: taskDone(task, t), tick: () => toggleTask(uid, task, t, !taskDone(task, t)), open: () => nav.go({ n: 'task', id: task.id }),
    })),
    ...doses.map((d) => {
      const who = personById(people, d.med.forId, me.uid).name;
      const st = d.log?.status;
      const doer = d.log ? personById(people, d.log.doneBy, me.uid).name : '';
      const at = d.log ? hhmm(new Date(d.log.doneAt?.toMillis?.() ?? Date.now())) : '';
      return {
        id: `d${d.id}`, med: true, time: d.time, title: `${who} · ${d.med.name}`, missed: d.missed && !d.log,
        sub: d.log ? `${st === 'alindi' ? 'Alındı' : 'Kaçtı'} · ${doer} · ${at}` : d.missed ? 'Kaçtı' : [d.med.dose, mealText(d.med.meal)].filter(Boolean).join(' · ') || null,
        done: Boolean(d.log),
        tick: () => (d.log ? (confirm('İşaret geri alınsın mı?') && unmarkDose(session.hid, d.id)) : markDose(session.hid, me.uid, d, 'alindi')),
        cross: d.log || d.missed ? null : () => markDose(session.hid, me.uid, d, 'atlandi'),
        open: openMed,
      };
    }),
    // shared to-dos whose due date is tomorrow, today or already past
    ...house.todos.filter((x) => !x.done && x.dueDate && dueLeft(x.dueDate, t) <= 1).map((x) => ({
      id: `o${x.id}`, time: null, title: x.text, sub: `${dueText(x.dueDate, t)} · ortak yapılacak`, done: false, urgent: true,
      tick: () => setFamilyTodoDone(session.hid, x.id, true), open: () => { ortakStart.sub = 'todo'; goTab('ortak'); },
    })),
    // fridge items on their last day (tomorrow, today) or past it
    ...house.fridge.filter((x) => x.shelfDays && leftDays(x, t) <= 1).map((x) => ({
      id: `f${x.id}`, time: null, title: x.name, sub: `${leftText(x, t)} · buzdolabı`, done: false, urgent: true,
      tick: () => { if (confirm(`“${x.name}” bitti, listeden kaldırılsın mı?`)) deleteFridge(session.hid, x.id); },
      open: () => { ortakStart.sub = 'fridge'; goTab('ortak'); },
    })),
    ...events.map((e) => ({ id: `e${e.scope}${e.id}`, time: e.time || null, title: e.title, sub: e.scope === 'kisisel' ? 'Kişisel' : null, done: false, open: () => goTab('takvim') })),
  ].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const pendingMeds = items.filter((i) => i.med && !i.done).length;
  const shownItems = showMeds ? items : items.filter((i) => !i.med);
  const untimed = shownItems.filter((i) => !i.time);
  const timed = shownItems.filter((i) => i.time);
  const hasMeds = items.some((i) => i.med);

  const ws = weekStart(t);
  const rows = data.activities.map((a) => {
    const logs = data.logs.filter((l) => l.activityId === a.id && l.date === t);
    return { a, logs, done: logs.length > 0, min: logs.reduce((s, l) => s + (l.minutes || 0), 0), week: activeDays(data.logs, a.id, ws, addDays(ws, 6)) };
  });
  const total = rows.reduce((s, r) => s + r.min, 0);
  const doneCount = rows.filter((r) => r.done).length;
  const run = habitStreak(habitList(data), null, t);
  // One tap marks the activity done today (no minutes). Tapping again removes that mark, unless minutes were logged: then the log form opens.
  const toggleDone = ({ a, logs, done }) => {
    if (!done) { markActivityDone(uid, a.id, t); return; }
    if (logs.every((l) => !l.minutes)) { if (confirm(`${a.name} için bugünkü işaret kaldırılsın mı?`)) logs.forEach((l) => deleteLog(uid, l.id)); } else nav.go({ n: 'log', activityId: a.id });
  };

  return (
    <main class="screen">
      <div class="topbar">
        <div>
          <div class="title-sm muted">Merhaba {me.name}</div>
          <h1>{dateLabel()}</h1>
        </div>
        <button class={`avatar p${me.slot ?? 0}`} aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
      </div>

      {weekly && (
        <Card label="HAFTALIK DEĞERLENDİRME">
          <div class="title-sm" style="font-weight:600;line-height:1.5">{weekly.text}</div>
          {(weekly.tips || []).length > 0 && (
            <ul style="margin:10px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
              {weekly.tips.map((tp, i) => <li key={i} class="sub" style="font-size:14px">{tp}</li>)}
            </ul>
          )}
        </Card>
      )}
      {note && (
        <Card label={`GÜNÜN NOTU · ${note.slot.label.toLocaleUpperCase('tr-TR')}`}>
          <div class="title-sm" style="font-weight:600;line-height:1.5">{note.text}</div>
          {note.quote && <div class="sub" style="margin-top:10px;font-size:14px;line-height:1.5;font-style:italic">{note.quote}</div>}
        </Card>
      )}

      <div class="card vsum">
        <div class="row" style="justify-content:space-between"><span class="title-sm muted">Bugün yapılan</span><span class="streak-badge">{run} gün seri</span></div>
        <div class="num" style="font-size:28px;margin:4px 0 8px">{doneCount}/{rows.length}<small style="font-size:15px;font-weight:700"> aktivite</small></div>
        <div class="seg-bar" role="img" aria-label={`${rows.length} aktiviteden ${doneCount} tanesi yapıldı`}>
          {rows.map((r) => <i key={r.a.id} style={`flex:1 1 0;background:${r.done ? actColor(r.a.color) : 'var(--track)'}`} />)}
          {rows.length === 0 && <i class="seg-rest" style="flex:1 1 0;background:var(--track)" />}
        </div>
        {total > 0 && <div class="sub" style="margin-top:8px">Kayıtlı süre: {fmtDur(total)}</div>}
      </div>

      {rows.length === 0 ? (
        <div class="card empty">
          <div class="title-sm">İlk aktiviteni ekle</div>
          <div class="sub">Süreni burada takip edeceksin.</div>
          <button class="btn" style="margin-top:12px" onClick={() => nav.go({ n: 'activity' })}><IconPlus />Aktivite ekle</button>
        </div>
      ) : (
        <div class="vtiles" aria-label="Aktiviteler">
          {rows.map((r) => {
            const { a, min, done } = r;
            return (
              <div key={a.id} class="tile" data-c={inkKey(a.color)} style={`--c:${actColor(a.color)}`}>
                <button type="button" class="tile-open" onClick={() => nav.go({ n: 'log', activityId: a.id })} aria-label={`${a.name}: süre ekle ya da düzenle`} />
                <span class="tile-top">
                  <span class="tile-name">{a.name}</span>
                  <button type="button" class={done ? 'tile-check on' : 'tile-check'} role="checkbox" aria-checked={done} aria-label={`${a.name} bugün yapıldı`} onClick={() => toggleDone(r)}>{done && <Tick />}</button>
                </span>
                <span class="tile-val num">{min ? <>{min}<small> dk</small></> : done ? <span class="tile-did">Yaptım</span> : <span class="tile-did">—</span>}</span>
                {a.dailyMinutes && min ? <><Progress pct={(min / a.dailyMinutes) * 100} color="var(--tile-bar)" /><span class="tile-sub">{min >= a.dailyMinutes ? 'hedef tamam' : `hedef ${a.dailyMinutes} dk`}</span></> : <span class="tile-sub">bu hafta {r.week}/{a.weeklyDays} gün</span>}
              </div>
            );
          })}
        </div>
      )}

      {untimed.length > 0 && <Card label="GÜN BOYU">{untimed.map((it) => <Row key={it.id} it={it} />)}</Card>}
      <div class="row" style="justify-content:space-between;align-items:center">
        <h2 class="flow-title">Akış</h2>
        {hasMeds && (
          <button type="button" class="vlink flow-meds" aria-pressed={showMeds} onClick={toggleMeds}>
            {showMeds ? 'İlaçları gizle' : `İlaçları göster${pendingMeds ? ` (${pendingMeds} bekliyor)` : ''}`}
          </button>
        )}
      </div>
      <div class="tl">
        {timed.length === 0 && <div class="sub">Bugün için saatli iş yok.</div>}
        {timed.map((it) => (
          <div class={`tl-i ${it.done ? 'done' : ''} ${!it.done && it.time < now ? 'past' : ''}`} key={it.id}>
            <span class="tl-time num">{it.time}</span>
            <span class="tl-dot" />
            <div class="card tl-card"><Row it={{ ...it, time: null }} /></div>
          </div>
        ))}
      </div>

      {upcoming.length > 0 && (
        <Card label="YAKLAŞAN TAKVİM KAYITLARI" class="list-card-pad">
          {upcoming.map((e) => (
            <button key={e.scope + e.id + e.date} class="up-row" onClick={() => goTab('takvim')}>
              <span class="up-date">{e.date === t ? 'Bugün' : dayMonth(e.date)}</span>
              <span class="grow">{e.title}</span>
              {e.scope === 'kisisel' ? <span class="badge small"><IconLock small />Kişisel</span> : e.time && <span class="sub">{e.time}</span>}
            </button>
          ))}
        </Card>
      )}
    </main>
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
