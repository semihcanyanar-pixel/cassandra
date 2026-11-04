import { useEffect } from 'preact/hooks';
import { callWorker, workerConfigured } from './worker.js';
import { tagScopes } from './lib/events.js';
import { medPeople, medLine, personById, isOver } from './lib/meds.js';
import { today } from './lib/dates.js';

// Resolve users/{uid}.medReminderFor ('self' | 'partner' | dependent id) to person ids.
export function reminderIds(profile, household, meUid) {
  const people = medPeople(household, meUid);
  const partner = people.find((p) => p.kind === 'member' && p.id !== meUid)?.id;
  const ids = new Set();
  for (const v of profile?.medReminderFor || ['self', 'aslan']) ids.add(v === 'self' ? meUid : v === 'partner' ? partner : v);
  return ids;
}

export function buildSyncPayload({ session, data, house, prevToken }) {
  const { me, household, profile } = session;
  const events = tagScopes(house.events, data.events).map((e) => ({ id: e.id, scope: e.scope, title: e.title, date: e.date, time: e.time || null, repeat: e.repeat || 'none', remind: e.remind || 'none' }));
  const people = medPeople(household, me.uid);
  const want = reminderIds(profile, household, me.uid);
  const t = today();
  const meds = house.medications
    .filter((m) => !isOver(m, t) && want.has(personById(people, m.forId, me.uid).id))
    .map((m) => ({ id: m.id, times: m.times, startDate: m.startDate, endDate: m.endDate, line: medLine(m, personById(people, m.forId, me.uid).name) }));
  return { token: profile.calendarToken, prevToken, events, meds };
}

// Push the user's calendar data to the Worker whenever it changes (and once on open). Fire-and-forget.
export function useCalendarSync({ session, data, house }) {
  const sig = JSON.stringify([house.events, data.events, house.medications, session.profile?.calendarToken, session.profile?.medReminderFor]);
  useEffect(() => {
    if (!workerConfigured || !session.profile?.calendarToken) return undefined;
    const id = setTimeout(() => {
      callWorker('/cal/sync', buildSyncPayload({ session, data, house })).catch((e) => console.warn('cal sync', e.message));
    }, 2000);
    return () => clearTimeout(id);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
}
