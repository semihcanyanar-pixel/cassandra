import { diffDays } from './dates.js';

// Due dates of shared to-dos ("şu tarihe kadar"). Same wording as the fridge: "Yarın son gün", "3 gün kaldı", "2 gün geçti".
export const dueLeft = (dueISO, todayISO) => diffDays(dueISO, todayISO);
export const dueText = (dueISO, todayISO) => {
  const l = dueLeft(dueISO, todayISO);
  return l < 0 ? `${-l} gün geçti` : l === 0 ? 'Bugün son gün' : l === 1 ? 'Yarın son gün' : `${l} gün kaldı`;
};
export const dueState = (dueISO, todayISO) => {
  const l = dueLeft(dueISO, todayISO);
  return l < 0 ? 'late' : l <= 1 ? 'soon' : 'ok';
};
// Open to-dos: the ones with a due date first (earliest first), then the rest in the given order.
export function sortTodos(todos) {
  const dated = todos.filter((t) => t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return [...dated, ...todos.filter((t) => !t.dueDate)];
}
