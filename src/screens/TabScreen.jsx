import { TABS } from '../components/Nav.jsx';
import { IconLock } from '../icons.jsx';

const dateLabel = () => new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

const EMPTY = {
  bugun: ['Bugün henüz boş', 'İlk aktiviteni Kişisel sekmesinden ekleyebilirsin.'],
  takvim: ['Takvim boş', 'Kayıtlar sonraki aşamada eklenecek.'],
  notlar: ['Not yok', 'Notlar sonraki aşamada eklenecek.'],
  ortak: ['Ortak alan boş', 'Ev ihtiyaçları, yapılacaklar ve ilaçlar sonraki aşamalarda.'],
  kisisel: ['Henüz aktivite yok', 'Aktiviteler sonraki aşamada eklenecek.'],
};

export function TabScreen({ tab, me, onSettings }) {
  const label = TABS.find((t) => t.key === tab).label;
  const [t, d] = EMPTY[tab];
  return (
    <main class="screen">
      <div class="topbar">
        <div>
          {tab === 'bugun' ? (
            <>
              <div class="title-sm muted">Merhaba {me.name}</div>
              <h1>{dateLabel()}</h1>
            </>
          ) : <h1 style="font-size:34px">{label}</h1>}
        </div>
        <button class="avatar" aria-label="Ayarlar" onClick={onSettings}>{me.initial}</button>
      </div>
      {tab === 'kisisel' && <div><span class="badge"><IconLock />Sadece sen görürsün</span></div>}
      <div class="card empty"><div class="title-sm">{t}</div><div class="sub">{d}</div></div>
    </main>
  );
}
