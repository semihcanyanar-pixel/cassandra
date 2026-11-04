import { useState } from 'preact/hooks';
import { signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import { useSession } from './session.js';
import { Login } from './screens/Login.jsx';
import { Settings } from './screens/Settings.jsx';
import { TabScreen } from './screens/TabScreen.jsx';
import { Nav } from './components/Nav.jsx';
import { Notice } from './components/Notice.jsx';

export function App() {
  const s = useSession();
  const [tab, setTab] = useState('bugun');
  const [view, setView] = useState('tabs'); // tabs | settings

  if (s.status === 'loading') return <div class="app"><div class="center muted">Yükleniyor…</div></div>;
  if (s.status === 'unconfigured') {
    return <Notice title="Kurulum eksik" text="Firebase ayarları bulunamadı. .env.local dosyasını .env.example'a göre doldur." />;
  }
  if (s.status === 'signedOut') return <Login />;
  if (s.status === 'notMember') {
    return <Notice title="Hane bulunamadı" text="Bu hesap haneye ekli değil. Hane belgesindeki members listesine UID'yi ekle." action={{ label: 'Çıkış yap', run: () => signOut(auth) }} />;
  }
  if (s.status === 'error') {
    return <Notice title="Bir sorun oluştu" text={s.message} action={{ label: 'Çıkış yap', run: () => signOut(auth) }} />;
  }

  if (view === 'settings') {
    return <div class="app"><Settings session={s} onBack={() => setView('tabs')} /></div>;
  }
  return (
    <div class="app">
      <TabScreen tab={tab} me={s.me} onSettings={() => setView('settings')} />
      <Nav tab={tab} onChange={setTab} />
    </div>
  );
}
