import { IconPlus } from '../icons.jsx';
import { Avatar } from './Ortak.jsx';
import { DoseRow, MED_NOTE } from '../components/Dose.jsx';
import { today, dayMonth } from '../lib/dates.js';
import { medPeople, personById, isActiveOn, isOver, isUpcoming, dosesForDay, nextDose, periodSummary, mealText, hhmm } from '../lib/meds.js';

// Ortak > İlaçlar: today's doses first, then running / upcoming periods, then past periods per person.
export function Ilaclar({ session, house, nav }) {
  const { me, hid } = session;
  const t = today();
  const people = medPeople(session.household, me.uid);
  const meds = house.medications;
  const now = hhmm();
  const doses = dosesForDay(meds, house.medLogs, t, now);
  const next = nextDose(doses, now);
  const running = meds.filter((m) => isActiveOn(m, t));
  const upcoming = meds.filter((m) => isUpcoming(m, t));
  const past = meds.filter((m) => isOver(m, t)).sort((a, b) => b.endDate.localeCompare(a.endDate));
  const edit = (m) => nav.go({ n: 'med', id: m.id });

  return (
    <>
      <div class="sub">Doktorun yazdığı kullanım şeklini gir. Uygulama doz ya da süre önermez.</div>
      <button class="btn wide" onClick={() => nav.go({ n: 'med' })}><IconPlus />Yeni ilaç dönemi</button>

      <div class="card list-card-pad">
        <div class="label" style="margin:0 0 6px;padding:0">BUGÜNKÜ DOZLAR</div>
        {doses.length === 0 && <div class="sub" style="padding:8px 0">Bugün için doz yok.</div>}
        {doses.map((d) => <DoseRow key={d.id} dose={d} people={people} uid={me.uid} hid={hid} next={next?.id === d.id} now={now} />)}
      </div>

      {running.length > 0 && (
        <div class="card list-card-pad">
          <div class="label" style="margin:0 0 6px;padding:0">DEVAM EDEN DÖNEMLER</div>
          {running.map((m) => <PeriodRow key={m.id} med={m} people={people} uid={me.uid} logs={house.medLogs} onClick={() => edit(m)} />)}
        </div>
      )}
      {upcoming.length > 0 && (
        <div class="card list-card-pad">
          <div class="label" style="margin:0 0 6px;padding:0">BAŞLAYACAK</div>
          {upcoming.map((m) => <PeriodRow key={m.id} med={m} people={people} uid={me.uid} logs={house.medLogs} onClick={() => edit(m)} />)}
        </div>
      )}
      {people.map((p) => {
        const mine = past.filter((m) => personById(people, m.forId, me.uid).id === p.id);
        if (!mine.length) return null;
        return (
          <div class="card list-card-pad" key={p.id}>
            <div class="label" style="margin:0 0 6px;padding:0">GEÇMİŞ · {p.name.toLocaleUpperCase('tr-TR')}</div>
            {mine.map((m) => <PeriodRow key={m.id} med={m} people={people} uid={me.uid} logs={house.medLogs} onClick={() => edit(m)} past />)}
          </div>
        );
      })}
      <div class="sub">{MED_NOTE}</div>
    </>
  );
}

function PeriodRow({ med, people, uid, logs, onClick, past }) {
  const p = personById(people, med.forId, uid);
  const s = periodSummary(med, logs);
  return (
    <button class="up-row period" onClick={onClick}>
      <Avatar person={p} small />
      <span class="grow">
        <span class="title-sm" style="display:block">{med.name} · {med.dose}</span>
        <span class="sub" style="display:block">
          {p.name} · {dayMonth(med.startDate)} – {dayMonth(med.endDate)} · günde {med.times.length}{mealText(med.meal) ? ` · ${mealText(med.meal)}` : ''}
        </span>
      </span>
      {past && <span class="sub">{s.taken}/{s.total} doz</span>}
    </button>
  );
}
