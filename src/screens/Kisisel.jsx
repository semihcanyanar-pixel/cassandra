import { useState } from 'preact/hooks';
import { InsightCard } from './InsightCard.jsx';
import { Card, Progress } from '../components/ui.jsx';
import { IconLock, IconPlus, IconNext } from '../icons.jsx';
import { fmtDur, goalProgress, activeDays } from '../lib/stats.js';
import { today, weekStart, addDays, DAY_SHORT } from '../lib/dates.js';

export function Kisisel({ me, uid, data, nav, onSettings }) {
  const [showArchive, setShowArchive] = useState(false);
  const t = today(), ws = weekStart(t), we = addDays(ws, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const weekLogs = data.logs.filter((l) => l.date >= ws && l.date <= we);
  const byDay = (d, id) => weekLogs.filter((l) => l.date === d && (!id || l.activityId === id)).reduce((s, l) => s + l.minutes, 0);
  const weekTotal = weekLogs.reduce((s, l) => s + l.minutes, 0);
  const maxDay = Math.max(30, ...days.map((d) => byDay(d)));
  const active = data.activities.filter((a) => !a.archived);
  const archived = data.activities.filter((a) => a.archived);
  const colorOf = (id) => data.activities.find((a) => a.id === id)?.color ?? 0;

  return (
    <main class="screen">
      <div class="topbar">
        <div>
          <h1 style="font-size:40px">Kişisel</h1>
          <span class="badge" style="margin-top:8px"><IconLock />Sadece sen görürsün</span>
        </div>
        <button class="avatar" aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
      </div>

      <button class="card tap" onClick={() => nav.go({ n: 'report' })} aria-label="Bu hafta, raporu aç">
        <div class="row" style="justify-content:space-between;align-items:baseline">
          <span class="title-sm muted">Bu hafta</span>
          <span class="num" style="font-size:20px">{fmtDur(weekTotal)}</span>
        </div>
        <div class="week-bars">
          {days.map((d, i) => {
            const total = byDay(d);
            const parts = [...new Set(weekLogs.filter((l) => l.date === d).map((l) => l.activityId))];
            return (
              <div key={d} class="week-col">
                <div class="week-stack" style={`height:70px`}>
                  {parts.length === 0 && <div class="wk" style="height:4px;background:var(--track)" />}
                  {parts.map((id) => (
                    <div key={id} class="wk" style={`height:${Math.max(4, (byDay(d, id) / maxDay) * 64)}px;background:var(--act-${colorOf(id)})`} />
                  ))}
                </div>
                <span class="sub" aria-label={total ? `${DAY_SHORT[i]} ${fmtDur(total)}` : DAY_SHORT[i]}>{DAY_SHORT[i]}</span>
              </div>
            );
          })}
        </div>
        <div class="sub" style="margin-top:6px;display:flex;align-items:center;gap:4px">Rapor ve grafikler <IconNext /></div>
      </button>

      {active.length === 0 && (
        <div class="card empty">
          <div class="title-sm">Henüz aktivite yok</div>
          <div class="sub">İngilizce, spor, yazılım… Takip etmek istediğin şeyi ekle.</div>
        </div>
      )}

      {active.map((a) => {
        const done = activeDays(data.logs, a.id, ws, we);
        return (
          <button key={a.id} class="card tap" style={`--c:var(--act-${a.color})`} onClick={() => nav.go({ n: 'activity', id: a.id })} aria-label={`${a.name}, düzenle`}>
            <div class="row">
              <span class="dot" style="background:var(--c)" />
              <div class="grow">
                <div style="font-size:17px;font-weight:700">{a.name}</div>
                <div class="sub">haftada {a.weeklyDays} gün{a.dailyMinutes ? ` · günlük ${a.dailyMinutes} dk` : ''}</div>
              </div>
              <span class="title-sm">{done}/{a.weeklyDays}</span>
            </div>
            <div class="pips" aria-hidden="true">
              {days.map((d) => <span key={d} class={byDay(d, a.id) > 0 ? 'pip on' : 'pip'} />)}
            </div>
          </button>
        );
      })}

      <div class="row" style="gap:10px">
        <button class="btn grow" onClick={() => nav.go({ n: 'activity' })}><IconPlus />Aktivite ekle</button>
        <button class="chip grow" onClick={() => nav.go({ n: 'log' })} disabled={!active.length}><IconPlus />Süre ekle</button>
      </div>

      <GoalsCard data={data} nav={nav} />
      <InsightCard uid={me.uid} data={data} />

      {archived.length > 0 && (
        <>
          <button class="chip" onClick={() => setShowArchive(!showArchive)} aria-expanded={showArchive}>Arşiv ({archived.length})</button>
          {showArchive && archived.map((a) => (
            <button key={a.id} class="card tap" onClick={() => nav.go({ n: 'activity', id: a.id })}>
              <div class="row"><span class="dot" style={`background:var(--act-${a.color})`} /><span class="title-sm grow">{a.name}</span><span class="sub">Arşivde</span></div>
            </button>
          ))}
        </>
      )}
    </main>
  );
}

function GoalsCard({ data, nav }) {
  const top = data.goals.slice(0, 2);
  return (
    <button class="card tap" onClick={() => nav.go({ n: 'goals' })} aria-label="Uzun vadeli hedefler">
      <div class="row" style="justify-content:space-between">
        <span class="label" style="margin:0;padding:0">UZUN VADELİ HEDEFLER</span><IconNext />
      </div>
      {top.length === 0 && <div class="sub" style="margin-top:6px">Henüz hedef yok. Eklemek için dokun.</div>}
      {top.map((g) => {
        const p = goalProgress(g, data.logs);
        return (
          <div key={g.id} style="margin-top:10px">
            <div class="row" style="justify-content:space-between"><span class="title-sm">{g.title}</span><span class="sub">{p}/{g.target} {g.unit}</span></div>
            <Progress pct={(p / g.target) * 100} />
          </div>
        );
      })}
    </button>
  );
}
