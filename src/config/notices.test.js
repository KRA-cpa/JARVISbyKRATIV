import { isNoticeInWindow, noticeForCompanies, NOTICE_DAYS, hasPublicVersion, isPublicVisible, statusNotices, isResolved, noticeTimeline } from './notices';

// src/config/notices.js: the sign-in banner shows for 7 days from postedAt, only to the organizations addressed
const notice = { id: 'INC-TEST', template: 'A', postedAt: '2026-11-20T09:00:00+08:00', companyIds: [] };
const start = Date.parse(notice.postedAt);
const DAY = 24 * 60 * 60 * 1000;

test('window: not before postedAt, shown for NOTICE_DAYS, gone after', () => {
  expect(NOTICE_DAYS).toBe(7);
  expect(isNoticeInWindow(notice, start - 1)).toBe(false);
  expect(isNoticeInWindow(notice, start)).toBe(true);
  expect(isNoticeInWindow(notice, start + 7 * DAY - 1)).toBe(true);
  expect(isNoticeInWindow(notice, start + 7 * DAY)).toBe(false);
});

test('window: own days, bad date, samples', () => {
  expect(isNoticeInWindow({ ...notice, days: 2 }, start + 3 * DAY)).toBe(false);
  expect(isNoticeInWindow({ ...notice, postedAt: 'not a date' }, start)).toBe(false);
  expect(isNoticeInWindow({ id: 'S', sample: true }, 0)).toBe(true);
});

test('companies: [] = everyone, else only the ones listed (ids as text or number)', () => {
  expect(noticeForCompanies(notice, [])).toBe(true);
  const scoped = { ...notice, companyIds: ['c1', 7] };
  expect(noticeForCompanies(scoped, ['c2'])).toBe(false);
  expect(noticeForCompanies(scoped, ['c2', 'c1'])).toBe(true);
  expect(noticeForCompanies(scoped, [7])).toBe(true);
  expect(noticeForCompanies(scoped, ['7'])).toBe(true);
});

test('public version: only with its text, only when public: true (tests run as a production build)', () => {
  const pub = { ...notice, publicTitle: 'T', publicSections: [{ id: 'x', heading: 'H', body: 'B' }] };
  expect(hasPublicVersion(notice)).toBe(false);
  expect(isPublicVisible({ ...pub, public: false })).toBe(false);
  expect(isPublicVisible({ ...pub, public: true })).toBe(true);
  expect(isPublicVisible({ ...notice, public: true })).toBe(false);
  expect(statusNotices()).toEqual([]); // no real notices posted, samples are preview-only
});

test('timeline: oldest first, internal entries only in the signed-in notice, bad times dropped; resolved', () => {
  const n = { ...notice, resolvedAt: null, timeline: [
    { at: '2026-11-20T12:00:00+08:00', text: 'notified', internal: true },
    { at: '2026-11-20T08:00:00+08:00', text: 'began' },
    { at: 'later', text: 'no time' },
    { at: '2026-11-21T09:00:00+08:00', text: 'resolved' }
  ] };
  expect(noticeTimeline(n).map(e => e.text)).toEqual(['began', 'notified', 'resolved']);
  expect(noticeTimeline(n, true).map(e => e.text)).toEqual(['began', 'resolved']);
  expect(noticeTimeline({ id: 'x' })).toEqual([]);
  expect(isResolved(n)).toBe(false);
  expect(isResolved({ ...n, resolvedAt: '2026-11-21T09:00:00+08:00' })).toBe(true);
});
