import { useState } from 'preact/hooks';
import { pushSupported, isStandalone, pushEnabledHere, enablePush, disablePush, sendTestPush } from '../push.js';
import { workerConfigured } from '../worker.js';
import { medPeople } from '../lib/meds.js';

// Settings > Bildirimler: web push for medication doses and calendar reminders.
export function PushSection({ session }) {
  const { me, household, profile, patchProfile } = session;
  const [on, setOn] = useState(pushEnabledHere());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!workerConfigured) return null;

  const ready = pushSupported() && isStandalone();
  const people = medPeople(household, me.uid);
  const choices = people.map((p) => ({ key: p.kind === 'dependent' ? p.id : p.id === me.uid ? 'self' : 'partner', name: p.id === me.uid ? `${p.name} (ben)` : p.name }));
  const selected = new Set(profile?.medReminderFor || ['self', 'aslan']);
  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    patchProfile({ medReminderFor: [...next] }).catch((e) => console.error(e));
  };

  async function turnOn() {
    setBusy(true); setMsg('');
    try { await enablePush(); setOn(true); setMsg('Bildirimler açıldı.'); } catch (e) {
      setMsg(e.message === 'permission-denied' ? 'İzin verilmedi. iPhone Ayarlar > Bildirimler > Cassandra bölümünden açabilirsin.' : 'Açılamadı, tekrar dene.');
      console.error(e);
    }
    setBusy(false);
  }
  async function turnOff() { setBusy(true); setMsg(''); await disablePush().catch(() => {}); setOn(false); setBusy(false); }
  async function test() {
    setBusy(true); setMsg('');
    try {
      const r = await sendTestPush();
      setMsg(r.sent ? 'Test bildirimi gönderildi.' : 'Bu hesapta kayıtlı cihaz bulunamadı; bildirimleri kapatıp yeniden aç.');
    } catch { setMsg('Gönderilemedi.'); }
    setBusy(false);
  }

  return (
    <>
      <div class="label">BİLDİRİMLER</div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <div class="sub">İlaç saatleri ve takvim hatırlatmaları telefona bildirim olarak gelir.</div>
        {!ready ? (
          <div class="sub" style="font-weight:700">iPhone’da bildirim için siteyi Safari’de Paylaş &gt; Ana Ekrana Ekle ile ekle ve uygulamayı ana ekrandan aç. Sonra bu bölüme dön.</div>
        ) : on ? (
          <>
            <div class="title-sm">Bu cihazda bildirimler açık</div>
            <div class="row" style="gap:10px">
              <button class="btn grow" disabled={busy} onClick={test}>Test gönder</button>
              <button class="chip grow" disabled={busy} onClick={turnOff}>Kapat</button>
            </div>
          </>
        ) : (
          <button class="btn wide" disabled={busy} onClick={turnOn}>Bildirimleri aç</button>
        )}
        {msg && <div class="sub" role="status">{msg}</div>}
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px">
        <div class="title-sm">Hangi kişilerin ilaçları hatırlatılsın?</div>
        <div class="chips" role="group" aria-label="İlaç bildirimi alınacak kişiler">
          {choices.map((c) => (
            <button key={c.key} type="button" class={selected.has(c.key) ? 'chip on' : 'chip'} aria-pressed={selected.has(c.key)} onClick={() => toggle(c.key)}>{c.name}</button>
          ))}
        </div>
        <div class="sub">Bir dozu biri “alındı” işaretlese bile, diğer telefon yenilenene kadar hatırlatma gelebilir. Önemli ilaçlar için telefon alarmını da kurun.</div>
      </div>
    </>
  );
}
