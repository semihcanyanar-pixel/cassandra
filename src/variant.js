import { useEffect, useState } from 'preact/hooks';

// Design previews: only in the dev demo (?demo=1). "" = current design, "a" | "b" | "c" = alternatives for Bugün / Kişisel.
export const variantEnabled = import.meta.env.DEV && typeof location !== 'undefined' && location.search.includes('demo=1');
const KEY = 'cassandra.variant';
let current = '';
try { current = new URLSearchParams(location.search).get('v') ?? localStorage.getItem(KEY) ?? ''; } catch { /* ignore */ }
const subs = new Set();

export function setVariant(v) {
  current = v;
  try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  subs.forEach((f) => f(v));
}
export function useVariant() {
  const [v, set] = useState(current);
  useEffect(() => { subs.add(set); return () => subs.delete(set); }, []);
  return variantEnabled ? v : '';
}
