import { useState } from 'preact/hooks';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../firebase.js';

const MESSAGES = {
  'auth/wrong-password': 'Mevcut şifre hatalı.',
  'auth/invalid-credential': 'Mevcut şifre hatalı.',
  'auth/weak-password': 'Yeni şifre çok zayıf. En az 8 karakter kullan.',
  'auth/too-many-requests': 'Çok fazla deneme. Biraz bekleyip tekrar dene.',
  'auth/network-request-failed': 'Bağlantı yok. İnterneti kontrol et.',
  'auth/requires-recent-login': 'Güvenlik için çıkış yapıp yeniden giriş yap, sonra tekrar dene.',
};

// Ayarlar > Şifre: asks for the current password first (Firebase requires a fresh sign-in for this), then sets the new one.
export function PasswordSection() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => { setCur(''); setNext(''); setAgain(''); setError(''); setOpen(false); };

  async function submit(e) {
    e.preventDefault();
    setError(''); setDone(false);
    const user = auth.currentUser;
    if (!user?.email) { setError('Bu hesapta şifre değiştirilemiyor.'); return; }
    if (next.length < 8) { setError('Yeni şifre en az 8 karakter olmalı.'); return; }
    if (next !== again) { setError('Yeni şifreler aynı değil.'); return; }
    if (next === cur) { setError('Yeni şifre mevcut şifreden farklı olmalı.'); return; }
    setBusy(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur));
      await updatePassword(user, next);
      reset(); setDone(true);
    } catch (err) {
      setError(MESSAGES[err.code] || 'Şifre değiştirilemedi, tekrar dene.');
    }
    setBusy(false);
  }

  return (
    <>
      <div class="label">ŞİFRE</div>
      <div class="card">
        {!open ? (
          <>
            <div class="sub" style="line-height:1.45">Giriş şifreni değiştirebilirsin. Değişiklik için mevcut şifreni yazman gerekir.</div>
            <button class="chip" style="margin-top:12px;min-height:48px" onClick={() => { setOpen(true); setDone(false); }}>Şifreyi değiştir</button>
            {done && <div class="sub" style="margin-top:8px" role="status">Şifren değiştirildi.</div>}
          </>
        ) : (
          <form onSubmit={submit}>
            {/* hidden username so the phone's password manager links the new password to the right account */}
            <input type="text" autocomplete="username" value={auth.currentUser?.email || ''} readonly hidden />
            <div class="field">
              <label for="pw-cur">Mevcut şifre</label>
              <input id="pw-cur" type="password" autocomplete="current-password" required value={cur} onInput={(e) => { setCur(e.target.value); setError(''); }} />
            </div>
            <div class="field" style="margin-top:10px">
              <label for="pw-new">Yeni şifre (en az 8 karakter)</label>
              <input id="pw-new" type="password" autocomplete="new-password" required minLength={8} value={next} onInput={(e) => { setNext(e.target.value); setError(''); }} />
            </div>
            <div class="field" style="margin-top:10px">
              <label for="pw-again">Yeni şifre (tekrar)</label>
              <input id="pw-again" type="password" autocomplete="new-password" required value={again} onInput={(e) => { setAgain(e.target.value); setError(''); }} />
            </div>
            {error && <div class="error" role="alert" style="margin-top:10px">{error}</div>}
            <div class="row" style="gap:10px;margin-top:12px">
              <button class="btn grow" type="submit" disabled={busy}>{busy ? 'Değiştiriliyor…' : 'Kaydet'}</button>
              <button class="chip" type="button" disabled={busy} onClick={reset}>Vazgeç</button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
