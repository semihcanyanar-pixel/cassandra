import { THEMES, useTheme } from '../theme.js';
import { saveTheme } from '../session.js';
import { refreshApp } from '../update.js';

const Ic = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{children}</svg>
);

// Top right of every main screen: next theme, refresh the app, settings. Same look for all three.
export function TopActions({ me, onSettings }) {
  const theme = useTheme();
  const i = Math.max(0, THEMES.findIndex((t) => t.key === theme));
  const next = THEMES[(i + 1) % THEMES.length];
  return (
    <div class="topacts">
      <button type="button" class="iconbtn" aria-label={`Tema: ${THEMES[i].name}. ${next.name} temasına geç`} title="Temayı değiştir" onClick={() => saveTheme(me.uid, next.key)}>
        <Ic><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.3-1-1.6-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10.5" cy="7" r="1" /><circle cx="15" cy="7.5" r="1" /></Ic>
      </button>
      <button type="button" class="iconbtn" aria-label="Uygulamayı yenile" title="Uygulamayı yenile" onClick={refreshApp}>
        <Ic><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 4v5h-5" /></Ic>
      </button>
      <button type="button" class="iconbtn" aria-label="Ayarlar" title="Ayarlar" onClick={onSettings}>
        <Ic><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></Ic>
      </button>
    </div>
  );
}
