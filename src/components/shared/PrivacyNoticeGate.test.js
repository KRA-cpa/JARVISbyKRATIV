import { noticeVersion } from './PrivacyNoticeGate';

describe('noticeVersion - which Privacy Policy version the user acknowledges', () => {
  test('published policy: its version, on every build', () => {
    expect(noticeVersion({ status: 'published', version: '1.0', lastUpdated: '1 December 2026' }, false)).toBe('1.0');
    expect(noticeVersion({ status: 'published', version: '1.0' }, true)).toBe('1.0');
  });

  test('draft: none in production (no notice for an unpublished policy); "draft <date>" on previews', () => {
    expect(noticeVersion({ status: 'draft', version: '', lastUpdated: '15 November 2026' }, false)).toBeNull();
    expect(noticeVersion({ status: 'draft', version: '', lastUpdated: '15 November 2026' }, true)).toBe('draft 15 November 2026');
  });

  test('the version always fits the server rule (letters, digits, . _ - space; 40 max)', () => {
    const v = noticeVersion({ status: 'draft', lastUpdated: '15 Nov 2026 <b>' + 'x'.repeat(60) }, true);
    expect(v).toMatch(/^[A-Za-z0-9._ -]{1,40}$/);
  });
});
