import { useState } from 'preact/hooks';
import { signInWithEmailAndPassword } from 'firebase/auth';
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

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (err) { setError(MESSAGES[err.code] || 'Giriş yapılamadı.'); }
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
        <button class="btn" type="submit" disabled={busy}>{busy ? 'Giriliyor…' : 'Giriş yap'}</button>
      </form>
    </div>
  );
}
