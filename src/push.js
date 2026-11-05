import { useEffect } from 'preact/hooks';
import { callWorker, workerConfigured, WORKER_URL } from './worker.js';
import { tagScopes } from './lib/events.js';
import { medPeople } from './lib/meds.js';
import { eventItems, medItems, taskItems, fridgeItems, buildSchedule } from './lib/push.js';
import { today } from './lib/dates.js';

const FLAG = 'cassandra.push';
const b64ToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isStandalone = () => window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
export const pushEnabledHere = () => {
  try { return pushSupported() && Notification.permission === 'granted' && localStorage.getItem(FLAG) === '1'; } catch { return false; }
};

export async function enablePush() {
  const perm = await Notification.requestPermission(); // must run from a tap
  if (perm !== 'granted') throw new Error('permission-denied');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await (await fetch(`${WORKER_URL}/push/key`)).json();
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await callWorker('/push/subscribe', { subscription: sub.toJSON() });
  try { localStorage.setItem(FLAG, '1'); } catch { /* private mode */ }
}

export async function disablePush() {
  try { localStorage.removeItem(FLAG); } catch { /* ignore */ }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await callWorker('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
}

export const sendTestPush = () => callWorker('/push/test', {});

// Resolve users/{uid}.medReminderFor ('self' | 'partner' | dependent id) to person ids.
export function reminderIds(profile, household, meUid) {
  const people = medPeople(household, meUid);
  const partner = people.find((p) => p.kind === 'member' && p.id !== meUid)?.id;
  const ids = new Set();
  for (const v of profile?.medReminderFor || ['self', 'aslan']) ids.add(v === 'self' ? meUid : v === 'partner' ? partner : v);
  return ids;
}

export function buildPushPayload({ session, data, house }, nowMs = Date.now(), t = today()) {
  const { me, household, profile } = session;
  const people = medPeople(household, me.uid);
  const items = [
    ...eventItems(tagScopes(house.events, data.events), t),
    ...medItems(house.medications, house.medLogs, people, reminderIds(profile, household, me.uid), t),
    ...taskItems(data.tasks || [], t),
    ...fridgeItems(house.fridge, t),
  ];
  return buildSchedule(items, nowMs);
}

// Keeps the Worker's reminder schedule in step with the data (debounced). Only on devices where notifications were enabled.
export function usePushSchedule({ session, data, house }) {
  const sig = JSON.stringify([house.events, data.events, house.medications, house.medLogs, data.tasks, house.fridge, session.profile?.medReminderFor]);
  useEffect(() => {
    if (!workerConfigured || !pushEnabledHere()) return undefined;
    const id = setTimeout(() => {
      callWorker('/push/schedule', { items: buildPushPayload({ session, data, house }) }).catch((e) => console.warn('push schedule', e.message));
    }, 3000);
    return () => clearTimeout(id);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
}
