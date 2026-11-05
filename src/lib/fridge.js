import { diffDays } from './dates.js';

// Buzdolabı: products that were opened and meals that were cooked, with the date and how many days they can be kept.
// item: { id, name, kind: 'urun' | 'yemek', openedOn: 'YYYY-MM-DD', shelfDays: number | null }
export const FRIDGE_KINDS = [{ value: 'urun', label: 'Açılan ürün' }, { value: 'yemek', label: 'Yemek' }];
export const SHELF_QUICK = [1, 2, 3, 5, 7];
export const DEFAULT_SHELF = { urun: 3, yemek: 3 }; // only a starting suggestion, always editable

export const ageDays = (item, todayISO) => Math.max(0, diffDays(todayISO, item.openedOn));
export const leftDays = (item, todayISO) => (item.shelfDays ? item.shelfDays - ageDays(item, todayISO) : null);
// plain = no limit set, ok = time left, soon = last day or tomorrow, late = past the limit
export function fridgeState(item, todayISO) {
  const l = leftDays(item, todayISO);
  return l == null ? 'plain' : l < 0 ? 'late' : l <= 1 ? 'soon' : 'ok';
}

export const ageText = (item, todayISO) => {
  const a = ageDays(item, todayISO);
  const verb = item.kind === 'yemek' ? 'yapıldı' : 'açıldı';
  return a === 0 ? `Bugün ${verb}` : a === 1 ? `Dün ${verb}` : `${a} gün önce ${verb}`;
};
export const leftText = (item, todayISO) => {
  const l = leftDays(item, todayISO);
  if (l == null) return null;
  return l < 0 ? `${-l} gün geçti` : l === 0 ? 'Bugün son gün' : l === 1 ? 'Yarın son gün' : `${l} gün kaldı`;
};

// Most urgent first (least time left); items without a limit last, the oldest of those first.
export function sortFridge(items, todayISO) {
  return items.slice().sort((a, b) => {
    const la = leftDays(a, todayISO), lb = leftDays(b, todayISO);
    if (la == null && lb == null) return ageDays(b, todayISO) - ageDays(a, todayISO);
    if (la == null) return 1;
    if (lb == null) return -1;
    return la - lb;
  });
}

export const urgentCount = (items, todayISO) => items.filter((i) => ['soon', 'late'].includes(fridgeState(i, todayISO))).length;
