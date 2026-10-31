// slaCalculator (v10.1): the +8 h shift is gone - same answers in every browser zone.
//   TZ=UTC / TZ=Asia/Manila / TZ=America/New_York npx react-scripts test --watchAll=false src/utils/slaCalculator.test.js
import { SLACalculator, getSLAStatus } from './slaCalculator';

test('days without weekends: Friday 16:00 Manila + 1 day = Monday 16:00 Manila (real moment)', () => {
  const start = '2026-11-06T08:00:00.000Z'; // Friday 16:00 in Manila
  const result = SLACalculator.calculateDueDate(start, 1, 'days', true, false, 'Asia/Manila');
  expect(result.success).toBe(true);
  expect(result.dueDate.toISOString()).toBe('2026-11-09T08:00:00.000Z');
});

test('plain hours add real time', () => {
  const result = SLACalculator.calculateDueDate('2026-11-06T08:00:00.000Z', 5, 'hours', false, false, 'Asia/Manila');
  expect(result.dueDate.toISOString()).toBe('2026-11-06T13:00:00.000Z');
});

test('"due today" is the zone\'s today; overdue compares real moments', () => {
  const now = new Date('2026-11-05T19:30:00.000Z'); // Dubai Thu 23:30, Manila Fri 03:30
  const due = '2026-11-05T20:30:00.000Z'; // Dubai Fri 00:30, Manila Fri 04:30
  expect(getSLAStatus(due, now, 'Asia/Manila').type).toBe('due_today');
  expect(getSLAStatus(due, now, 'Asia/Dubai').type).toBe('on_time');
  expect(getSLAStatus('2026-11-05T19:00:00.000Z', now, 'Asia/Manila').type).toBe('overdue');
  expect(getSLAStatus('', now).type).toBe('no_sla');
});

test('the preview formats in the zone', () => {
  expect(SLACalculator.formatSLADate('2026-11-06T08:00:00.000Z', 'yyyy-MM-dd HH:mm', 'Asia/Manila')).toBe('2026-11-06 16:00');
  expect(SLACalculator.formatSLADate('2026-11-06T08:00:00.000Z', 'yyyy-MM-dd HH:mm', 'America/New_York')).toBe('2026-11-06 03:00');
});
