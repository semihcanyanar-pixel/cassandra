import { useState } from 'preact/hooks';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase.js';

const MESSAGES = {
  'auth/invalid-credential': 'E-posta ya da şifre hatalı.',
  'auth/invalid-email': 'E-posta adresi geçersiz.',
  'auth/too-many-requests': 'Çok fazla deneme. Biraz bekleyip tekrar dene.',
  'auth/network-request-failed': 'Bağlantı yok. İnterneti kontrol et.',
};

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (err) { setError(MESSAGES[err.code] || 'Giriş yapılamadı.'); }
    setBusy(false);
  }

  // Sends a reset link to the typed e-mail. The answer is the same whether or not the address has an account.
  async function forgot() {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Önce e-posta adresini yaz.'); return; }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Bu adres kayıtlıysa şifre sıfırlama bağlantısı e-postana gönderildi. Gelen kutunu ve gereksiz kutusunu kontrol et.');
    } catch (err) {
      if (err.code === 'auth/user-not-found') setInfo('Bu adres kayıtlıysa şifre sıfırlama bağlantısı e-postana gönderildi. Gelen kutunu ve gereksiz kutusunu kontrol et.');
      else setError(MESSAGES[err.code] || 'Bağlantı gönderilemedi, tekrar dene.');
    }
    setBusy(false);
  }

  return (
    <div class="app">
      <form class="center" onSubmit={submit}>
        <h1>Cassandra</h1>
        <p class="muted" style="margin:0;font-weight:600">Devam etmek için giriş yap.</p>
        <div class="field">
          <label for="email">E-posta</label>
          <input id="email" type="email" autocomplete="username" required value={email} onInput={(e) => setEmail(e.target.value)} />
        </div>
        <div class="field">
          <label for="pw">Şifre</label>
          <input id="pw" type="password" autocomplete="current-password" required value={password} onInput={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div class="error" role="alert">{error}</div>}
        {info && <div class="sub" role="status" style="line-height:1.45">{info}</div>}
        <button class="btn" type="submit" disabled={busy}>{busy ? 'Giriliyor…' : 'Giriş yap'}</button>
        <button class="chip" type="button" style="min-height:48px" disabled={busy} onClick={forgot}>Şifremi unuttum</button>
      </form>
    </div>
  );
}
