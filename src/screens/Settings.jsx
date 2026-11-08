import { useState } from 'preact/hooks';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { THEMES, currentTheme } from '../theme.js';
import { saveTheme } from '../session.js';
import { IconBack, IconCheck } from '../icons.jsx';
import { PushSection } from './PushSection.jsx';
import { PasswordSection } from './PasswordSection.jsx';
import { buildBackup, backupCounts, saveBackup, parseBackup, restoreOps } from '../lib/backup.js';
import { applyRestore, setNotePrefs } from '../data.js';
import { FRAMES, FRAME_KEY, dayFrame } from '../lib/dayFrames.js';

// Build time of the running version, e.g. "5 Kas 12:40".
const versionLabel = () => {
  try { const d = new Date(__BUILD__); return `${d.getDate()} ${['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'][d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch { return 'geliştirme'; }
};
export function Settings({ session, data, house, onBack }) {
  const [theme, setTheme] = useState(currentTheme());
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const { me, household } = session;

  async function doRestore(file) {
    if (!file) return;
    setBackupBusy(true); setBackupMsg('');
    try {
      const r = parseBackup(await file.text(), me.uid);
      if (!r.ok) { setBackupMsg(r.error); return; }
      const c = r.counts;
      if (!confirm(`Yedekteki ${c.personal} kişisel kayıt geri yüklenecek. Aynı kayıtlar yedekteki hâliyle değişir, yedekte olmayanlar silinmez. Devam edilsin mi?`)) return;
      const sameHouse = r.backup.household.id === session.hid && c.household > 0;
      const withHouse = sameHouse && confirm(`Ortak veriler de (${c.household} kayıt: alışveriş, notlar, takvim, ilaçlar…) geri yüklensin mi? Eşin de görür. İptal dersen yalnızca kişisel verilerin yüklenir.`);
      const n = await applyRestore(restoreOps(r.backup, { uid: me.uid, hid: session.hid, includeHousehold: withHouse }));
      setBackupMsg(`${n} kayıt geri yüklendi.`);
    } catch (e) { setBackupMsg('Geri yükleme tamamlanamadı, tekrar dene.'); }
    finally { setBackupBusy(false); }
  }
  async function doBackup() {
    setBackupBusy(true); setBackupMsg('');
    try {
      const b = buildBackup({ session, data, house });
      const r = await saveBackup(b);
      const n = backupCounts(b);
      if (r !== 'cancelled') setBackupMsg(`${n.personal} kişisel, ${n.household} ortak kayıt ${r === 'shared' ? 'paylaşıldı' : 'indirildi'}.`);
    } catch (e) { setBackupMsg('Yedek alınamadı, tekrar dene.'); }
    setBackupBusy(false);
  }

  function pick(key) { setTheme(key); saveTheme(me.uid, key); }
  const [frame, setFrame] = useState(dayFrame(data.notePrefs));
  const [frameOpen, setFrameOpen] = useState(false); // the list of frames opens on tap
  function pickFrame(key) {
    setFrame(key); setFrameOpen(false);
    try { localStorage.setItem(FRAME_KEY, key); } catch { /* ignore */ }
    setNotePrefs(me.uid, { ui: { dayframe: key } });
  }

  return (
    <main class="screen">
      <div class="row" style="margin-bottom:4px">
        <button class="iconbtn" aria-label="Geri" onClick={onBack}><IconBack /></button>
        <h1 style="font-size:34px">Ayarlar</h1>
      </div>

      <div class="card row">
        <span class={`avatar static p${me.slot ?? 0}`}>{me.initial}</span>
        <div class="grow">
          <div style="font-size:17px;font-weight:700">{me.name}</div>
          <div class="sub">Evimiz: {household.members.length} kişi</div>
        </div>
      </div>

      <div class="label" id="tema">TEMA</div>
      <div role="radiogroup" aria-labelledby="tema" style="display:flex;flex-direction:column;gap:10px">
        {THEMES.map((t) => (
          <button key={t.key} class="themeopt" role="radio" aria-checked={theme === t.key} onClick={() => pick(t.key)}>
            <span class="swatches">{t.sw.map((c) => <span style={`background:${c};border-radius:var(--r-sm,0);`} />)}</span>
            <span class="grow">
              <div style="font-size:16px;font-weight:700">{t.name}</div>
              <div class="sub">{t.desc}</div>
            </span>
            {theme === t.key && <span class="tick" aria-label="Seçili"><IconCheck /></span>}
          </button>
        ))}
      </div>

      <div class="label" id="cerceve">GÜNÜN NOTU ÇERÇEVESİ</div>
      <button type="button" class="themeopt" aria-haspopup="listbox" aria-expanded={frameOpen} aria-labelledby="cerceve" onClick={() => setFrameOpen((o) => !o)}>
        <span class="grow">
          <div style="font-size:16px;font-weight:700">{FRAMES.find((f) => f.key === frame)?.name}</div>
          <div class="sub">{FRAMES.find((f) => f.key === frame)?.desc}</div>
        </span>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style={`flex:none;transition:transform .2s;transform:rotate(${frameOpen ? 180 : 0}deg)`}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {frameOpen && (
        <div role="listbox" aria-labelledby="cerceve" style="display:flex;flex-direction:column;gap:10px">
          {FRAMES.map((f) => (
            <button key={f.key} class="themeopt" role="option" aria-selected={frame === f.key} onClick={() => pickFrame(f.key)}>
              <span class="grow">
                <div style="font-size:16px;font-weight:700">{f.name}</div>
                <div class="sub">{f.desc}</div>
              </span>
              {frame === f.key && <span class="tick" aria-label="Seçili"><IconCheck /></span>}
            </button>
          ))}
        </div>
      )}

      <PushSection session={session} />

      <div class="label">VERİLERİM</div>
      <div class="card">
        <div class="sub" style="line-height:1.45">Notların, aktivite sürelerin, görevlerin ve ortak verilerin tek bir dosyada. Telefon değişirse ya da bir şey silinirse elinde kopyası olur. Resim ve PDF ekleri dosyaya girmez.</div>
        <button class="btn wide" style="margin-top:12px" disabled={backupBusy} onClick={doBackup}>Yedekle</button>
        <label class="chip filebtn" style="margin-top:10px;display:flex;justify-content:center">Yedekten geri yükle<input class="vh" type="file" accept="application/json,.json" disabled={backupBusy} onChange={(e) => { doRestore(e.target.files[0]); e.target.value = ''; }} /></label>
        {backupMsg && <div class="sub" style="margin-top:8px" role="status">{backupMsg}</div>}
      </div>

      <PasswordSection />

      <div class="sub" style="text-align:center;margin-top:6px">Sürüm: {versionLabel()}</div>

      <button class="chip" style="margin-top:6px;min-height:48px" onClick={() => signOut(auth)}>Çıkış yap</button>
    </main>
  );
}
