import { useState } from 'preact/hooks';
import { useAutoNote } from '../autoNote.js';
import { Card, Progress } from '../components/ui.jsx';
import { ortakStart } from './Ortak.jsx';
import { DoseRow } from '../components/Dose.jsx';
import { medPeople, personById, dosesForDay, nextDose, hhmm } from '../lib/meds.js';
import { IconPlus } from '../icons.jsx';
import { useTheme } from '../theme.js';
import { fmtDur, minutesByDay, streak, tasksForDay, taskDone } from '../lib/stats.js';
import { today } from '../lib/dates.js';
import { toggleTask } from '../data.js';
import { occurrences, tagScopes } from '../lib/events.js';
import { IconLock } from '../icons.jsx';
import { dayMonth, addDays } from '../lib/dates.js';

const dateLabel = () => new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

export function Bugun({ session, me, uid, data, house, nav, goTab, onSettings }) {
  const theme = useTheme();
  const t = today();
  const { note, weekly } = useAutoNote(uid, data);
  const active = data.activities;
  const todayMin = (id) => minutesByDay(data.logs, id)[t] || 0;
  const rows = active.map((a) => ({ a, min: todayMin(a.id) }));
  const total = data.logs.filter((l) => l.date === t).reduce((s, l) => s + l.minutes, 0);
  const targeted = rows.filter((r) => r.a.dailyMinutes);
  const targetSum = targeted.reduce((s, r) => s + r.a.dailyMinutes, 0);
  const reached = targeted.reduce((s, r) => s + Math.min(r.min, r.a.dailyMinutes), 0);
  const pct = targetSum ? Math.round((reached / targetSum) * 100) : null;
  const run = streak(data.logs, null, t);
  const todays = tasksForDay(data.tasks, t);
  const upcoming = occurrences(tagScopes(house.events, data.events), t, addDays(t, 180)).slice(0, 3);
  const openTodos = house.todos.filter((x) => !x.done).length;
  const [who, setWho] = useState('all');
  const people = medPeople(session.household, me.uid);
  const doses = dosesForDay(house.medications, house.medLogs, t);
  const doseOwner = (d) => personById(people, d.med.forId, me.uid).id;
  const filterPeople = people.filter((p) => doses.some((d) => doseOwner(d) === p.id));
  const shown = who === 'all' ? doses : doses.filter((d) => doseOwner(d) === who);
  const now = hhmm();
  const next = nextDose(shown, now);

  return (
    <main class="screen">
      <div class="topbar">
        <div>
          <div class="title-sm muted">Merhaba {me.name}</div>
          <h1>{dateLabel()}</h1>
        </div>
        <button class={`avatar p${me.slot ?? 0}`} aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
      </div>

      {active.length === 0 ? (
        <div class="card empty">
          <div class="title-sm">İlk aktiviteni ekle</div>
          <div class="sub">Süreni burada takip edeceksin.</div>
          <button class="btn" style="margin-top:12px" onClick={() => nav.go({ n: 'activity' })}><IconPlus />Aktivite ekle</button>
        </div>
      ) : (
        <>
          <Summary theme={theme} rows={rows} total={total} pct={pct} run={run} targetSum={targetSum} />
          <div class="tiles">
            {rows.map(({ a, min }) => {
              const tgt = a.dailyMinutes;
              return (
                <button key={a.id} class="tile" style={`--c:var(--act-${a.color})`} onClick={() => nav.go({ n: 'log', activityId: a.id })}
                  aria-label={`${a.name}: bugün ${min} dakika. Süre ekle`}>
                  <span class="tile-name">{a.name}</span>
                  <span class="tile-val num">{min}<small> dk</small></span>
                  {tgt ? <><Progress pct={(min / tgt) * 100} color="var(--tile-bar)" /><span class="tile-sub">{min >= tgt ? 'tamam' : `hedef ${tgt} dk`}</span></> : <span class="tile-sub">hedefsiz</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

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
        </Card>
      )}

      <Card label="GÜNLÜK GÖREVLER" right={<button class="chip small" onClick={() => nav.go({ n: 'task' })}><IconPlus />Ekle</button>}>
        {todays.length === 0 && <div class="sub" style="padding:8px 0">Bugün için görev yok.</div>}
        {todays.map((task) => {
          const done = taskDone(task, t);
          return (
            <div class="list-row" key={task.id}>
              <button class={done ? 'check on' : 'check'} role="checkbox" aria-checked={done} aria-label={`${task.title} tamamlandı`}
                onClick={() => toggleTask(uid, task, t, !done)}>{done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</button>
              <button class="task-title grow" onClick={() => nav.go({ n: 'task', id: task.id })}>
                <span class={done ? 'title-sm struck' : 'title-sm'}>{task.title}</span>
                {task.repeat === 'daily' && <span class="sub">Her gün</span>}
                {task.repeat === 'days' && <span class="sub">Belirli günler</span>}
                {(!task.repeat || task.repeat === 'none') && task.date < t && !done && <span class="sub">Geçmiş tarihli</span>}
              </button>
            </div>
          );
        })}
      </Card>

      {doses.length > 0 && (
        <Card label="İLAÇLAR" class="list-card-pad med-card" right={<button class="chip small" onClick={() => { ortakStart.sub = 'ilac'; goTab('ortak'); }}>Yönet</button>}>
          {filterPeople.length > 1 && (
            <div class="scroll-chips filter" role="radiogroup" aria-label="Kişi filtresi">
              {[{ id: 'all', name: 'Hepsi' }, ...filterPeople].map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={who === p.id} class={who === p.id ? 'chip small on' : 'chip small'} onClick={() => setWho(p.id)}>{p.name}</button>
              ))}
            </div>
          )}
          {shown.map((d) => <DoseRow key={d.id} dose={d} people={people} uid={me.uid} hid={session.hid} next={next?.id === d.id} now={now} />)}
        </Card>
      )}

      <Card label="YAKLAŞAN" class="list-card-pad">
        {upcoming.length === 0 && <div class="sub" style="padding:8px 0">Yaklaşan kayıt yok.</div>}
        {upcoming.map((e) => (
          <button key={e.scope + e.id + e.date} class="up-row" onClick={() => goTab('takvim')}>
            <span class="up-date">{e.date === t ? 'Bugün' : dayMonth(e.date)}</span>
            <span class="grow">{e.title}</span>
            {e.scope === 'kisisel' ? <span class="badge small"><IconLock small />Kişisel</span> : e.time && <span class="sub">{e.time}</span>}
          </button>
        ))}
        <button class="up-row" onClick={() => goTab('ortak')}>
          <span class="up-date">Bugün</span>
          <span class="grow">Ailenin yapılacakları</span>
          <span class="sub">{openTodos} açık</span>
        </button>
      </Card>
    </main>
  );
}

function Summary({ theme, rows, total, pct, run, targetSum }) {
  const segs = rows.filter((r) => r.min > 0);
  const remain = Math.max(0, targetSum - total);
  const bar = (
    <div class="seg-bar" role="img" aria-label="Aktivitelere göre bugünkü süre">
      {segs.map((r) => <i key={r.a.id} style={`flex:${r.min} 1 0;background:var(--act-${r.a.color})`} />)}
      {remain > 0 && <i class="seg-rest" style={`flex:${remain} 1 0`} />}
      {segs.length === 0 && remain === 0 && <i class="seg-rest" style="flex:1 1 0" />}
    </div>
  );
  const goalText = pct == null ? 'Günlük süre hedefi belirlemedin' : `Günlük hedefin %${pct}'i tamam`;

  if (theme === 'yorunge') {
    const ringed = rows.filter((r) => r.a.dailyMinutes).slice(0, 4);
    const step = 13, r0 = 54;
    return (
      <div class="card summary-y">
        <svg width="124" height="124" viewBox="0 0 124 124" role="img" aria-label="Bugünkü hedef halkaları" style="flex:none">
          <g fill="none" stroke-width="9" stroke-linecap="round" transform="rotate(-90 62 62)">
            {ringed.length === 0 && <circle cx="62" cy="62" r={r0} stroke="var(--line)" />}
            {ringed.map((r, i) => <circle key={`t${r.a.id}`} cx="62" cy="62" r={r0 - i * step} stroke="var(--line)" />)}
            {ringed.map((r, i) => {
              const rad = r0 - i * step, C = 2 * Math.PI * rad, f = Math.min(1, r.min / r.a.dailyMinutes);
              return f > 0 ? <circle key={r.a.id} cx="62" cy="62" r={rad} stroke={`var(--act-${r.a.color})`} stroke-dasharray={`${C * f} ${C}`} /> : null;
            })}
          </g>
        </svg>
        <div>
          <div class="label" style="margin:0;padding:0">BUGÜN</div>
          <div class="num sum-big">{fmtDur(total).replace(' sa ', 'sa ').replace(' dk', 'dk')}</div>
          <div class="sub" style="margin-top:6px">{pct == null ? 'Hedef yok' : `Hedefin %${pct}'i`} · {run} gün seri</div>
        </div>
      </div>
    );
  }
  if (theme === 'teknik') {
    return (
      <div class="card summary-t">
        <div class="row" style="justify-content:space-between;font-size:12px;font-weight:700"><span>BUGÜN</span><span class="serial">SERİ {run}</span></div>
        <div class="row" style="align-items:flex-end;gap:12px">
          <span class="huge">{total}</span>
          <span style="padding-bottom:2px;font-size:12px;font-weight:700;line-height:1.5">DK<br /><span class="muted">= {fmtDur(total).toUpperCase()}</span></span>
        </div>
        {bar}
        <div class="sub" style="margin-top:6px">{goalText}</div>
      </div>
    );
  }
  return (
    <div class="summary-m">
      <div class="row" style="justify-content:space-between">
        <span style="font-size:14px;font-weight:700">Bugün</span>
        <span class="streak-badge">{run} gün seri</span>
      </div>
      <div class="sum-huge">{fmtDur(total)}</div>
      <div>{bar}<div style="margin-top:6px;font-size:12px;font-weight:600">{goalText}</div></div>
    </div>
  );
}
