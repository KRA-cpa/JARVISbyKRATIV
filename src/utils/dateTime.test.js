// dateTime.js (v10.1): zone formatting and wall-clock math. Run under two host zones too:
//   TZ=UTC npx react-scripts test --watchAll=false src/utils/dateTime.test.js  (and TZ=America/New_York)
import {
  DEFAULT_ZONE, dayInZone, formatDateOnly, formatDateTime, formatInZone, fromWallClock, getDisplayZone, isValidZone,
  setDisplayZone, wallClockIn, zoneLabel, zoneOffsetMinutes, zoneParts
} from './dateTime';

afterEach(() => setDisplayZone(DEFAULT_ZONE));

test('the same moment in Manila, Dubai and New York (whatever the browser zone)', () => {
  const at = '2026-11-01T17:30:00Z';
  expect(dayInZone(at, 'Asia/Manila')).toBe('2026-11-02');
  expect(dayInZone(at, 'Asia/Dubai')).toBe('2026-11-01');
  expect(zoneParts(at, 'Asia/Manila')).toMatchObject({ hour: 1, minute: 30, weekday: 1 });
  expect(zoneParts(at, 'America/New_York')).toMatchObject({ hour: 12, weekday: 0 });
  expect(formatInZone(at, 'Asia/Manila', { hour: 'numeric', hourCycle: 'h23' }, 'en-US')).toBe('01');
});

test('offsets follow daylight saving; Manila is always +8 h', () => {
  expect(zoneOffsetMinutes('Asia/Manila', new Date('2026-07-01T00:00:00Z'))).toBe(480);
  expect(zoneOffsetMinutes('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(-300);
  expect(zoneOffsetMinutes('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe(-240);
});

test('wallClockIn / fromWallClock round-trip, also on a DST day', () => {
  ['2026-11-01T17:30:00.000Z', '2026-03-08T15:00:00.000Z', '2026-12-31T20:00:00.000Z'].forEach(iso => {
    ['Asia/Manila', 'America/New_York', 'Asia/Dubai'].forEach(zone => {
      expect(fromWallClock(wallClockIn(iso, zone), zone).toISOString()).toBe(iso);
    });
  });
  const wall = wallClockIn('2026-11-01T17:30:00Z', 'Asia/Manila');
  expect([wall.getDate(), wall.getHours(), wall.getMinutes()]).toEqual([2, 1, 30]);
});

test('date-only values are calendar days in every zone; blanks and junk', () => {
  expect(formatDateOnly('2026-11-30', 'America/Los_Angeles')).toBe(formatDateOnly('2026-11-30', 'Asia/Tokyo'));
  expect(formatDateOnly('2026-11-30', 'America/Los_Angeles')).toMatch(/30/);
  expect(dayInZone('2026-11-30', 'Pacific/Kiritimati')).toBe('2026-11-30');
  expect(formatDateTime('')).toBe('');
  expect(formatDateTime(null)).toBe('');
  expect(formatDateTime('not a date')).toBe('not a date');
});

test('the display zone: default Manila, set by the app, unknown zones refused', () => {
  expect(getDisplayZone()).toBe('Asia/Manila');
  expect(isValidZone('Mars/Base')).toBe(false);
  expect(setDisplayZone('Mars/Base')).toBe('Asia/Manila');
  expect(setDisplayZone('Asia/Dubai')).toBe('Asia/Dubai');
  expect(dayInZone('2026-11-01T21:00:00Z')).toBe('2026-11-02'); // Dubai 01:00
  expect(zoneLabel('Asia/Dubai', new Date('2026-11-01T00:00:00Z'))).toMatch(/GMT\+4|\+04/);
});
