// Small line drawings for empty lists: a gentle float, no emoji.
const ART = {
  note: <><rect x="14" y="8" width="36" height="46" rx="4" /><path d="M21 20h22M21 29h22M21 38h12" /></>,
  goal: <><circle cx="32" cy="32" r="22" /><circle cx="32" cy="32" r="13" /><circle cx="32" cy="32" r="4" fill="currentColor" /><path d="M32 32L50 14M44 14h6v6" /></>,
  fridge: <><rect x="17" y="6" width="30" height="52" rx="4" /><path d="M17 26h30M24 14v6M24 34v10" /></>,
  mountain: <><path d="M6 52L24 22l9 14 7-9 18 25z" /><path d="M24 22v-10l10 3-10 4" /></>,
};
export function EmptyArt({ kind = 'mountain' }) {
  return (
    <svg class="empty-art" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ART[kind]}</svg>
  );
}
