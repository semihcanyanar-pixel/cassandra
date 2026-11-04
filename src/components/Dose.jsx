import { markDose, unmarkDose } from '../data.js';
import { personById, medLine, hhmm } from '../lib/meds.js';
import { Avatar } from '../screens/Ortak.jsx';

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

// One dose of one medication. Marking shows WHO did it and WHEN to both phones (the double-dose guard).
export function DoseRow({ dose, people, uid, hid, next, now }) {
  const { med, log } = dose;
  const person = personById(people, med.forId, uid);
  const doer = log ? personById(people, log.doneBy, uid) : null;
  const doneTime = log ? hhmm(new Date(log.doneAt?.toMillis?.() ?? Date.now())) : null;
  const late = !log && dose.time < now;
  const cls = ['dose', log?.status === 'alindi' ? 'taken' : '', log?.status === 'atlandi' ? 'skipped' : '', next ? 'next' : ''].join(' ');
  const undo = () => { if (confirm('İşaret geri alınsın mı?')) unmarkDose(hid, dose.id); };

  return (
    <div class={cls}>
      <div class="dose-main">
        <Avatar person={person} small />
        <span class="dose-time num">{dose.time}</span>
        <div class="grow">
          <div class="title-sm">{medLine(med, person.name)}</div>
          {next && <div class="sub">Sıradaki doz</div>}
          {late && <div class="sub">Saati geçti</div>}
        </div>
      </div>
      {log ? (
        <div class="dose-state">
          <span class={log.status === 'alindi' ? 'given' : 'given skip'}>
            {log.status === 'alindi' && <Tick />}
            {log.status === 'alindi' ? 'Verildi' : 'Atlandı'} · {doer.name} · {doneTime}
          </span>
          <button class="chip small" onClick={undo}>Geri al</button>
        </div>
      ) : (
        <div class="dose-actions">
          <button class="btn" onClick={() => markDose(hid, uid, dose, 'alindi')}>Verildi</button>
          <button class="chip" onClick={() => markDose(hid, uid, dose, 'atlandi')}>Atla</button>
        </div>
      )}
    </div>
  );
}

export const MED_NOTE = 'Hatırlatma teslimi iPhone Takvim eşlemesiyle gelecek; Takvim alarmı bir dozun verildiğini bilmez. Önemli ilaçlar için telefon alarmını da kurabilirsin.';
