import { useState } from 'preact/hooks';
import { IconBack, IconNext, IconPlus, IconLock, IconCake, IconHospital, IconPlane, IconHotel } from '../icons.jsx';
import { EventIcon } from '../components/EventIcon.jsx';
import { occurrences, tagScopes, monthGrid, repeatLabel, remindsOf, sortReminds, remindsLabel } from '../lib/events.js';
import { today, addDays, addMonths, monthStart, fromISO, dayMonth, DAY_LETTER } from '../lib/dates.js';

const monthName = (iso) => new Intl.DateTimeFormat('tr-TR', { month: 'long' }).format(fromISO(iso));
const dayHeading = (iso) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(fromISO(iso)).toLocaleUpperCase('tr-TR').replace(/^(\d+ \S+) (\S+)$/, '$1 · $2');

export function eventMeta(e) {
  return [e.time, repeatLabel(e.repeat), remindsOf(e).length ? `${remindsLabel(sortReminds(remindsOf(e)))} hatırlat` : null].filter(Boolean).join(' · ');
}

export function Takvim({ me, house, data, nav, onSettings }) {
  const t = today();
  const [month, setMonth] = useState(monthStart(t));
  const [sel, setSel] = useState(t);
  const all = tagScopes(house.events, data.events);
  const cells = monthGrid(month);
  const occ = occurrences(all, cells[0], cells[41]);
  const byDay = {};
  for (const o of occ) (byDay[o.date] ||= []).push(o);
  const dayEvents = byDay[sel] || [];
  const upcoming = occurrences(all, addDays(sel, 1), addDays(sel, 120)).slice(0, 5);
  const shift = (n) => { const m = addMonths(month, n); setMonth(m); setSel(m === monthStart(t) ? t : m); };
  const edit = (e) => nav.go({ n: 'event', id: e.id, scope: e.scope });

  return (
    <main class="screen">
      <div class="topbar" style="align-items:flex-end">
        <div>
          <div class="title-sm muted">Takvim · {fromISO(month).getFullYear()}</div>
          <h1 style="font-size:36px;text-transform:var(--h-transform)">{monthName(month)}</h1>
        </div>
        <div class="row" style="gap:6px">
          <button class="iconbtn" aria-label="Önceki ay" onClick={() => shift(-1)}><IconBack /></button>
          <button class="iconbtn" aria-label="Sonraki ay" onClick={() => shift(1)}><IconNext /></button>
          <button class="iconbtn cta" aria-label="Kayıt ekle" onClick={() => nav.go({ n: 'event', date: sel })}><IconPlus /></button>
        </div>
      </div>

      <div class="cal-head" aria-hidden="true">{DAY_LETTER.map((l, i) => <span key={i}>{l}</span>)}</div>
      <div class="cal-grid" role="grid" aria-label={`${monthName(month)} takvimi`}>
        {cells.map((d) => {
          const evs = byDay[d] || [];
          const fam = evs.some((e) => e.scope === 'aile'), per = evs.some((e) => e.scope === 'kisisel');
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const cls = ['cell', inMonth ? '' : 'out', d === t ? 'today' : '', d === sel ? 'sel' : ''].join(' ');
          return (
            <button key={d} class={cls} role="gridcell" aria-selected={d === sel}
              aria-label={`${dayMonth(d)}${evs.length ? `, ${evs.length} kayıt` : ''}`} onClick={() => { setSel(d); if (!inMonth) setMonth(monthStart(d)); }}>
              <span>{fromISO(d).getDate()}</span>
              <span class="marks" aria-hidden="true">{fam && <i class="mk fam" />}{per && <i class="mk per" />}</span>
            </button>
          );
        })}
      </div>
      <div class="legend" aria-hidden="true">
        <span><i class="mk fam" />Aile</span><span><i class="mk per" /><IconLock small />Kişisel</span>
      </div>

      <div class="card">
        <div class="label" style="margin:0 0 6px;padding:0">{dayHeading(sel)}</div>
        {dayEvents.length === 0 && <div class="sub" style="padding:10px 0 4px">Bu gün için kayıt yok.</div>}
        {dayEvents.map((e) => <EventRow key={`${e.scope}-${e.id}`} e={e} onOpen={() => edit(e)} />)}

        {upcoming.length > 0 && <div class="label" style="margin:12px 0 4px;padding:0">YAKLAŞANLAR</div>}
        {upcoming.map((e) => (
          <button key={`${e.scope}-${e.id}-${e.date}`} class="up-row" onClick={() => { setSel(e.date); setMonth(monthStart(e.date)); }}>
            <span class="up-ico" aria-hidden="true"><EventIcon kind={e.kind} /></span>
            <span class="grow">{e.title}</span>
            {e.scope === 'kisisel' && <span class="badge small"><IconLock small />Kişisel</span>}
            <span class="up-end">{dayMonth(e.date)}{e.time ? ` · ${e.time}` : ''}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function EventRow({ e, onOpen }) {
  return (
    <button class="ev-row" onClick={onOpen} aria-label={`${e.title}, düzenle`}>
      <span class={e.scope === 'kisisel' ? 'ev-ico per' : 'ev-ico fam'} aria-hidden="true">{e.kind === 'dogum' ? <IconCake /> : e.kind === 'hastane' ? <IconHospital /> : e.kind === 'ucus' ? <IconPlane /> : e.kind === 'otel' ? <IconHotel /> : e.scope === 'kisisel' ? <IconLock small /> : <IconPlus />}</span>
      <span class="grow">
        <span class="title-sm" style="display:block">{e.title}</span>
        <span class="sub" style="display:block">{eventMeta(e) || (e.scope === 'kisisel' ? 'Kişisel' : 'Aile')}</span>
      </span>
      {e.scope === 'kisisel' && <span class="badge small"><IconLock small />Kişisel</span>}
    </button>
  );
}

const IconCalendarSmall = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
);
