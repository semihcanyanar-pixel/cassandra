// Pure .ics builders (no Worker APIs) so they can be unit-tested with vitest.
// Times are "floating" (no TZID/Z): the iPhone shows them in the device's own time zone.

const CRLF = '\r\n';
const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const d8 = (iso) => iso.replace(/-/g, '');
const dt = (iso, hhmm) => `${d8(iso)}T${hhmm.replace(':', '')}00`;
const addDaysISO = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const addMinutes = (iso, hhmm, mins) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + mins;
  const day = Math.floor(t / 1440);
  const r = ((t % 1440) + 1440) % 1440;
  return [addDaysISO(iso, day), `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`];
};

// RFC 5545 line folding at 75 octets (UTF-8 aware).
export function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = '';
  let len = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > limit) { out.push(cur); cur = ' '; len = 1; limit = 75; }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join(CRLF);
}

const RRULE = { weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };

function alarm(remind, hasTime, text) {
  let trigger;
  if (remind === 'at' && hasTime) trigger = 'PT0S';
  else if (remind === '30m' && hasTime) trigger = '-PT30M';
  else if (remind === '2h' && hasTime) trigger = '-PT2H';
  else if (remind === '1d') trigger = hasTime ? '-P1D' : '-PT15H'; // all-day: 09:00 the day before
  else return [];
  return ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:${trigger}`, 'END:VALARM'];
}

export function eventLines(ev, stamp) {
  const hasTime = Boolean(ev.time);
  const lines = ['BEGIN:VEVENT', `UID:${ev.uid}@cassandra`, `DTSTAMP:${stamp}`];
  if (hasTime) {
    const [ed, et] = addMinutes(ev.date, ev.time, 60);
    lines.push(`DTSTART:${dt(ev.date, ev.time)}`, `DTEND:${dt(ed, et)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${d8(ev.date)}`, `DTEND;VALUE=DATE:${d8(addDaysISO(ev.date, 1))}`);
  }
  lines.push(`SUMMARY:${esc(ev.title)}`);
  if (RRULE[ev.repeat]) lines.push(`RRULE:${RRULE[ev.repeat]}`);
  lines.push(...alarm(ev.remind, hasTime, ev.title), 'END:VEVENT');
  return lines;
}

// One VEVENT per dose time, repeating daily until the end date (floating UNTIL matches floating DTSTART).
export function medLines(med, stamp) {
  const out = [];
  for (const time of med.times) {
    const [ed, et] = addMinutes(med.startDate, time, 5);
    out.push(
      'BEGIN:VEVENT', `UID:med-${med.id}-${time.replace(':', '')}@cassandra`, `DTSTAMP:${stamp}`,
      `DTSTART:${dt(med.startDate, time)}`, `DTEND:${dt(ed, et)}`,
      `RRULE:FREQ=DAILY;UNTIL=${dt(med.endDate, time)}`,
      `SUMMARY:${esc(med.line)}`,
      ...alarm('at', true, med.line), 'END:VEVENT',
    );
  }
  return out;
}

function wrap(name, body) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cassandra//TR', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    ...body, 'END:VCALENDAR',
  ].map(fold).join(CRLF) + CRLF;
}

export const buildEventsIcs = (events, stamp) => wrap('Cassandra', events.flatMap((e) => eventLines(e, stamp)));
export const buildMedIcs = (meds, stamp) => wrap('Cassandra İlaç', meds.flatMap((m) => medLines(m, stamp)));
