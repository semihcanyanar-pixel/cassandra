import { useState } from 'preact/hooks';
import { workerConfigured, webcalUrl, callWorker } from '../worker.js';
import { medPeople } from '../lib/meds.js';
import { buildSyncPayload } from '../calsync.js';

const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');

// Settings > iPhone Takvim: subscribe links, who gets medication reminders, link renewal.
export function CalendarSection({ session, data, house }) {
  const { me, household, profile, patchProfile } = session;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!profile) return null;

  if (!workerConfigured) {
    return (
      <>
        <div class="label">İPHONE TAKVİM</div>
        <div class="card sub" style="font-size:14px">Takvim eşlemesi için Worker adresi tanımlı değil.</div>
      </>
    );
  }

  // Choices: me, partner, then dependents. Stored as 'self' | 'partner' | dependent id.
  const people = medPeople(household, me.uid);
  const choices = people.map((p) => ({ key: p.kind === 'dependent' ? p.id : p.id === me.uid ? 'self' : 'partner', name: p.id === me.uid ? `${p.name} (ben)` : p.name }));
  const selected = new Set(profile.medReminderFor || ['self', 'aslan']);
  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    patchProfile({ medReminderFor: [...next] }).catch((e) => console.error(e));
  };
  const open = (kind) => { window.location.href = webcalUrl(profile.calendarToken, kind); };
  const renew = async () => {
    if (!confirm('Bağlantı yenilensin mi? Eski bağlantı çalışmaz; iPhone aboneliğini yeniden eklemen gerekir.')) return;
    setBusy(true); setMsg('');
    const token = newToken();
    try {
      await callWorker('/cal/sync', buildSyncPayload({ session: { ...session, profile: { ...profile, calendarToken: token } }, data, house, prevToken: profile.calendarToken }));
      await patchProfile({ calendarToken: token });
      setMsg('Bağlantı yenilendi.');
    } catch (e) { setMsg('Yenilenemedi, tekrar dene.'); console.error(e); }
    setBusy(false);
  };

  return (
    <>
      <div class="label">İPHONE TAKVİM</div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <div class="sub">Kayıtların iPhone Takvim'ine abone olarak eklenir; hatırlatmaları telefon kendisi gösterir. Tek yönlüdür ve anlık değildir, iPhone kendi aralığında yeniler.</div>
        <button class="btn wide" onClick={() => open('events')}>Takvimi eşle</button>
        <div class="sub">Kişisel kayıtların da bu akışta yer alır; bağlantıyı kimseyle paylaşma.</div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <div class="title-sm">İlaç hatırlatmaları</div>
        <div class="sub">Ayrı bir "Cassandra İlaç" takvimi olarak eklenir. Hangi kişilerin ilaçları sana hatırlatılsın?</div>
        <div class="chips" role="group" aria-label="İlaç hatırlatması alınacak kişiler">
          {choices.map((c) => (
            <button key={c.key} type="button" class={selected.has(c.key) ? 'chip on' : 'chip'} aria-pressed={selected.has(c.key)} onClick={() => toggle(c.key)}>{c.name}</button>
          ))}
        </div>
        <button class="btn wide" onClick={() => open('med')}>İlaç takvimini eşle</button>
        <div class="sub">Takvim alarmı bir dozun verildiğini bilmez: biri verdiyse diğerinin telefonu yine de çalabilir. Uygulamayı açınca doz "verildi" görünür.</div>
      </div>
      <button class="chip" style="min-height:48px" disabled={busy} onClick={renew}>Bağlantıyı yenile</button>
      {msg && <div class="sub" role="status">{msg}</div>}
    </>
  );
}
