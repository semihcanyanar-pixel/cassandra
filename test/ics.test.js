import { describe, it, expect } from 'vitest';
import { buildEventsIcs, buildMedIcs, fold } from '../worker/src/ics.js';

const S = '20261105T100000';
const lines = (s) => s.split('\r\n');

describe('takvim akışı (.ics)', () => {
  it('saatli kayıt: yerel (floating) saat, DTEND +1sa, zamanında alarm', () => {
    const out = buildEventsIcs([{ uid: 'f-1', title: 'Hastane', date: '2026-11-07', time: '10:30', repeat: 'none', remind: '30m' }], S);
    expect(out).toContain('DTSTART:20261107T103000');
    expect(out).toContain('DTEND:20261107T113000');
    expect(out).toContain('TRIGGER:-PT30M');
    expect(out).not.toContain('RRULE');
  });
  it('tüm gün + yıllık: VALUE=DATE, RRULE, bir gün önce 09:00 alarmı', () => {
    const out = buildEventsIcs([{ uid: 'f-2', title: 'Doğum günü', date: '2026-11-15', time: null, repeat: 'yearly', remind: '1d' }], S);
    expect(out).toContain('DTSTART;VALUE=DATE:20261115');
    expect(out).toContain('DTEND;VALUE=DATE:20261116');
    expect(out).toContain('RRULE:FREQ=YEARLY');
    expect(out).toContain('TRIGGER:-PT15H');
  });
  it('saat gece yarısını aşarsa DTEND ertesi güne geçer', () => {
    const out = buildEventsIcs([{ uid: 'f-3', title: 'x', date: '2026-12-31', time: '23:30', repeat: 'none', remind: 'none' }], S);
    expect(out).toContain('DTEND:20270101T003000');
  });
  it('metin kaçışı ve satır katlama', () => {
    const out = buildEventsIcs([{ uid: 'f-4', title: 'A, B; C\nD', date: '2026-11-07', time: null, repeat: 'none', remind: 'none' }], S);
    expect(out).toContain('SUMMARY:A\\, B\\; C\\nD');
    const long = fold('SUMMARY:' + 'ç'.repeat(80));
    for (const l of long.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
  it('her satır CRLF ile biter, VCALENDAR sarmalı var', () => {
    const out = buildEventsIcs([], S);
    expect(out.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

describe('ilaç akışı', () => {
  const med = { id: 'm1', times: ['08:00', '14:00', '20:00'], startDate: '2026-11-03', endDate: '2026-11-09', line: 'Aslan · D vitamini · 5 damla · tok karnına' };
  it('her doz saati için tekrar eden bir kayıt + alarm', () => {
    const out = buildMedIcs([med], S);
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(out).toContain('RRULE:FREQ=DAILY;UNTIL=20261109T140000');
    expect(out.match(/TRIGGER:PT0S/g)).toHaveLength(3);
    expect(out).toContain('UID:med-m1-0800@cassandra');
  });
  it('metin kişi ve aç/tok bilgisini taşır', () => {
    expect(lines(buildMedIcs([med], S)).join('').replace(/\r?\n /g, '')).toContain('Aslan · D vitamini · 5 damla · tok karnına');
  });
  it('X-WR-CALNAME ayrı akış adı', () => {
    expect(buildMedIcs([], S)).toContain('X-WR-CALNAME:Cassandra İlaç');
  });
});
