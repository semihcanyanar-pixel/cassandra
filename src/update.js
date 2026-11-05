import { useEffect, useRef, useState } from 'preact/hooks';

const CHECK_MS = 15 * 60 * 1000; // look for a new version every 15 minutes while the app is open
const RELOAD_GUARD_MS = 5 * 60 * 1000; // never reload more than once in 5 minutes (protects against a stale CDN copy)

const bundleName = (text) => text.match(/assets\/index-[\w-]+\.js/)?.[0] || null;
const currentBundle = () => {
  const s = document.querySelector('script[type="module"][src*="assets/index-"]');
  return s ? bundleName(s.getAttribute('src')) : null;
};

async function newVersionAvailable() {
  const mine = currentBundle();
  if (!mine) return false; // dev server
  try {
    const r = await fetch(`./index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const latest = bundleName(await r.text());
    return Boolean(latest) && latest !== mine;
  } catch { return false; }
}

// Keeps the open app current:
//  - re-renders every minute and when the app comes back to the foreground (so "today", missed doses, day notes stay right),
//  - checks for a new version every 15 minutes and on foreground, and reloads it when no form is open (`busy` = a form is open).
export function useAutoRefresh(busy) {
  const [, setTick] = useState(0);
  const pending = useRef(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const reloadIfNeeded = () => {
    if (!pending.current || busyRef.current) return;
    try {
      if (Date.now() - Number(sessionStorage.getItem('cassandra.reloadAt') || 0) < RELOAD_GUARD_MS) return;
      sessionStorage.setItem('cassandra.reloadAt', String(Date.now()));
    } catch { /* storage blocked */ }
    location.reload();
  };

  useEffect(() => {
    const check = async () => {
      navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
      if (await newVersionAvailable()) { pending.current = true; reloadIfNeeded(); }
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setTick((n) => n + 1);
      check();
    };
    const minute = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    const versions = setInterval(check, CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(minute); clearInterval(versions); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // A form was open when the update was found: reload as soon as the user is back on the main screen.
  useEffect(() => { if (!busy) reloadIfNeeded(); }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
}
