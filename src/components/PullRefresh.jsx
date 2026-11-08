import { useEffect, useRef, useState } from 'preact/hooks';
import { refreshApp } from '../update.js';
import { Hiker } from './Climb.jsx';

// Pull down from the top of a screen to refresh: a little hiker bounces while the app reloads. Not active inside sheets, editors or the note book.
const LIMIT = 84;
export function PullRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const st = useRef(null);
  useEffect(() => {
    const top = () => (document.scrollingElement?.scrollTop || 0) <= 0;
    const start = (e) => {
      const t = e.target;
      if (busy || !top() || e.touches.length !== 1 || t.closest?.('.dn-stack, .nsheet-bg, .nf-colored, input, textarea, [contenteditable], .note-canvas, .fmtbar, .nf-bar')) { st.current = null; return; }
      st.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, on: false };
    };
    const move = (e) => {
      const s = st.current;
      if (!s) return;
      const dy = e.touches[0].clientY - s.y, dx = e.touches[0].clientX - s.x;
      if (!s.on) { if (dy > 10 && dy > Math.abs(dx) * 1.5 && top()) s.on = true; else if (dy < -6 || Math.abs(dx) > 16) { st.current = null; setPull(0); return; } }
      if (s.on) setPull(Math.min(LIMIT * 1.4, dy * 0.55));
    };
    const end = () => {
      const s = st.current; st.current = null;
      if (!s?.on) { setPull(0); return; }
      { setPull((p) => { if (p >= LIMIT * 0.8) { setBusy(true); try { navigator.vibrate?.(20); } catch { /* ignore */ } setTimeout(refreshApp, 700); return LIMIT * 0.8; } return 0; }); }
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end); };
  }, [busy]);
  if (pull < 6 && !busy) return null;
  return (
    <div class={busy ? 'ptr busy' : 'ptr'} style={`transform: translateY(${Math.round(pull - 56)}px); opacity: ${Math.min(1, pull / 40)}`} aria-hidden="true">
      <svg width="46" height="52" viewBox="-14 -48 40 52"><g class={busy ? 'ptr-hop' : ''}><Hiker pose="walk" /></g></svg>
    </div>
  );
}
