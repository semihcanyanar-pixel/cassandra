import { useEffect, useRef } from 'preact/hooks';
import { callWorker, workerConfigured } from './worker.js';
import { saveInsight } from './data.js';
import { today, weekStart, weekday, addDays } from './lib/dates.js';
import { currentSlot, slotDocId, latestNote, buildSlotInput, hasPlan, weeklyDue, WEEKLY_FROM } from './lib/slots.js';
import { buildInsightInput } from './screens/InsightCard.jsx';

const COOLDOWN_MS = 10 * 60 * 1000; // after a try, wait before asking again

const cooled = (key) => {
  try {
    if (Date.now() - Number(localStorage.getItem(key) || 0) < COOLDOWN_MS) return false;
    localStorage.setItem(key, String(Date.now()));
  } catch { /* storage blocked */ }
  return true;
};

// On opening the app (and when the data is ready) creates:
//  - the note for the current time slot (06:00 / 15:00 / 20:00) if it does not exist yet,
//  - the weekly evaluation on Sunday evening.
// Returns { note, weekly } to show on Bugün.
export function useAutoNote(uid, data) {
  const t = today();
  const hour = new Date().getHours();
  const slot = currentSlot(hour);
  const id = slot ? slotDocId(t, slot.id) : null;
  const cached = id ? data.insights.some((i) => i.id === id && i.text) : false;
  const tried = useRef(null);

  const dow = weekday(t); // Monday = 0
  const weekId = `w-${weekStart(t)}`;
  const weeklyCached = data.insights.some((i) => i.id === weekId && i.text);
  const triedWeekly = useRef(false);

  useEffect(() => {
    if (!workerConfigured || !id || cached || tried.current === id) return;
    const input = buildSlotInput(data, t, hour);
    if (!hasPlan(input) || !cooled(`cassandra.noteTry.${id}`)) return;
    tried.current = id;
    callWorker('/ai/slot', input, 30000)
      .then((r) => { if (r.text) saveInsight(uid, id, { text: r.text, quote: r.quote || '' }); })
      .catch((e) => console.warn('auto note', e.message));
  }, [id, cached]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!workerConfigured || !weeklyDue(dow, hour) || weeklyCached || triedWeekly.current) return;
    const activities = buildInsightInput(data, t);
    if (!activities.length || !cooled(`cassandra.weeklyTry.${weekId}`)) return;
    triedWeekly.current = true;
    callWorker('/ai/weekly', { activities }, 30000)
      .then((r) => { if (r.text) saveInsight(uid, weekId, { text: r.text, tips: r.tips || [] }); })
      .catch((e) => console.warn('auto weekly', e.message));
  }, [weekId, weeklyCached]); // eslint-disable-line react-hooks/exhaustive-deps

  // The weekly card is visible on Sunday evening and on Monday (the week that just ended).
  let shownWeek = null;
  if (dow === 6 && hour >= WEEKLY_FROM) shownWeek = weekId;
  else if (dow === 0) shownWeek = `w-${weekStart(addDays(t, -1))}`;
  const weekly = shownWeek ? data.insights.find((i) => i.id === shownWeek && i.text) || null : null;
  return { note: latestNote(data.insights, t), weekly };
}
