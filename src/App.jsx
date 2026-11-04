import { useState } from 'preact/hooks';
import { signOut } from 'firebase/auth';
import { auth } from './firebase.js';
import { useSession } from './session.js';
import { useUserData, useHouseData } from './data.js';
import { Login } from './screens/Login.jsx';
import { Settings } from './screens/Settings.jsx';
import { Bugun } from './screens/Bugun.jsx';
import { Kisisel } from './screens/Kisisel.jsx';
import { Ortak } from './screens/Ortak.jsx';
import { Takvim } from './screens/Takvim.jsx';
import { EventForm } from './screens/EventForm.jsx';
import { MedForm } from './screens/MedForm.jsx';
import { Notlar } from './screens/Notlar.jsx';
import { NoteForm } from './screens/NoteForm.jsx';
import { ActivityForm } from './screens/ActivityForm.jsx';
import { LogForm } from './screens/LogForm.jsx';
import { Report } from './screens/Report.jsx';
import { TaskForm } from './screens/TaskForm.jsx';
import { Goals, GoalForm } from './screens/Goals.jsx';
import { Nav } from './components/Nav.jsx';
import { Notice } from './components/Notice.jsx';

export function App() {
  const s = useSession();

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
  return <Main session={s} />;
}

// Screens above the tab bar form a small stack; `nav` is passed to every screen.
function Main({ session }) {
  const { me } = session;
  const data = useUserData(me.uid);
  const house = useHouseData(session.hid);
  const [tab, setTab] = useState('bugun');
  const [stack, setStack] = useState([]);
  const nav = {
    go: (r) => { setStack((s) => [...s, r]); window.scrollTo(0, 0); },
    back: () => { setStack((s) => s.slice(0, -1)); window.scrollTo(0, 0); },
    replace: (r) => setStack((s) => [...s.slice(0, -1), r]),
  };
  const route = stack[stack.length - 1];
  const uid = me.uid;

  if (!data.ready || !house.ready) return <div class="app"><div class="center muted">Yükleniyor…</div></div>;

  let body;
  if (route) {
    switch (route.n) {
      case 'settings': body = <Settings session={session} onBack={nav.back} />; break;
      case 'activity': body = <ActivityForm key={route.id || 'new'} uid={uid} data={data} id={route.id} nav={nav} />; break;
      case 'log': body = <LogForm uid={uid} data={data} activityId={route.activityId} nav={nav} />; break;
      case 'report': body = <Report uid={uid} data={data} activityId={route.activityId} nav={nav} />; break;
      case 'task': body = <TaskForm key={route.id || 'new'} uid={uid} data={data} id={route.id} nav={nav} />; break;
      case 'note': body = <NoteForm key={route.id || 'new'} ctx={{ uid, hid: session.hid }} data={data} house={house} id={route.id} category={route.category} nav={nav} />; break;
      case 'event': body = <EventForm key={route.id || 'new'} ctx={{ uid, hid: session.hid }} data={data} house={house} id={route.id} scope={route.scope} date={route.date} nav={nav} />; break;
      case 'med': body = <MedForm key={route.id || 'new'} session={session} house={house} id={route.id} nav={nav} />; break;
      case 'goals': body = <Goals data={data} nav={nav} />; break;
      case 'goal': body = <GoalForm key={route.id || 'new'} uid={uid} data={data} id={route.id} nav={nav} />; break;
      default: body = null;
    }
    return <div class="app">{body}</div>;
  }

  const onSettings = () => nav.go({ n: 'settings' });
  return (
    <div class="app">
      {tab === 'bugun' && <Bugun session={session} me={me} uid={uid} data={data} house={house} nav={nav} goTab={setTab} onSettings={onSettings} />}
      {tab === 'kisisel' && <Kisisel me={me} data={data} nav={nav} onSettings={onSettings} />}
      {tab === 'ortak' && <Ortak session={session} house={house} nav={nav} onSettings={onSettings} />}
      {tab === 'notlar' && <Notlar me={me} house={house} data={data} nav={nav} onSettings={onSettings} />}
      {tab === 'takvim' && <Takvim me={me} house={house} data={data} nav={nav} onSettings={onSettings} />}
      <Nav tab={tab} onChange={setTab} />
    </div>
  );
}
