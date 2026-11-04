import { useState } from 'preact/hooks';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { THEMES, currentTheme } from '../theme.js';
import { saveTheme } from '../session.js';
import { IconBack, IconCheck } from '../icons.jsx';
import { CalendarSection } from './CalendarSection.jsx';

export function Settings({ session, data, house, onBack }) {
  const [theme, setTheme] = useState(currentTheme());
  const { me, household } = session;

  function pick(key) { setTheme(key); saveTheme(me.uid, key); }

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
          <div class="sub">Ortak alan: {household.members.length} kişi</div>
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

      <CalendarSection session={session} data={data} house={house} />

      <button class="chip" style="margin-top:6px;min-height:48px" onClick={() => signOut(auth)}>Çıkış yap</button>
    </main>
  );
}
