import {
  parseAnnouncements, announcementPhase, activeAnnouncements, canHideBanner, modalStageNow, pendingModal, ackKeysFor,
  SOON_MS
} from './announcements';

const H = 60 * 60 * 1000;
const START = Date.parse('2026-11-20T22:00:00+08:00');
const maint = {
  id: 'M1', kind: 'maintenance', title: 'Maintenance', message: 'Read-only',
  startsAt: '2026-11-20T22:00:00+08:00', endsAt: '2026-11-20T23:00:00+08:00', readOnly: true
};

describe('parseAnnouncements', () => {
  test('keeps valid entries, drops broken ones and duplicates', () => {
    const list = parseAnnouncements({ announcements: [
      maint,
      { ...maint, id: 'M1' },                                   // duplicate id
      { ...maint, id: 'X1', kind: 'party' },                    // unknown kind
      { ...maint, id: 'X2', startsAt: '2026-11-20T22:00:00' },  // no offset: ambiguous
      { ...maint, id: 'X3', endsAt: '2026-11-20T21:00:00+08:00' }, // ends before it starts
      { ...maint, id: 'X4', title: '  ' },
      { id: 'O1', kind: 'outage', title: 'Outage', startsAt: '2026-11-20T10:00:00Z', endsAt: null, link: '//evil.example' }
    ] });
    expect(list.map(a => a.id)).toEqual(['M1', 'O1']);
    expect(list[1].endsAt).toBeNull();
    expect(list[1].link).toBe('/status');
    expect(list[0].showFrom).toBe(START - 3 * 24 * H);
  });

  test('anything that is not a list gives no entries', () => {
    expect(parseAnnouncements(null)).toEqual([]);
    expect(parseAnnouncements({ announcements: 'x' })).toEqual([]);
    expect(parseAnnouncements([maint])).toHaveLength(1);
  });
});

describe('phases and the banner', () => {
  const [a] = parseAnnouncements([maint]);
  test('hidden → upcoming → soon → live → ended at the edges', () => {
    expect(announcementPhase(a, START - 3 * 24 * H - 1)).toBe('hidden');
    expect(announcementPhase(a, START - 3 * 24 * H)).toBe('upcoming');
    expect(announcementPhase(a, START - SOON_MS - 1)).toBe('upcoming');
    expect(announcementPhase(a, START - SOON_MS)).toBe('soon');
    expect(announcementPhase(a, START)).toBe('live');
    expect(announcementPhase(a, START + H)).toBe('ended');
  });

  test('company scope; public pages only see the entries for everyone', () => {
    const list = parseAnnouncements([maint, { ...maint, id: 'M2', companyIds: [7] }]);
    expect(activeAnnouncements(list, ['7'], START - H).map(x => x.id)).toEqual(['M1', 'M2']);
    expect(activeAnnouncements(list, ['8'], START - H).map(x => x.id)).toEqual(['M1']);
    expect(activeAnnouncements(list, null, START - H).map(x => x.id)).toEqual(['M1']);
    expect(activeAnnouncements(list, ['7'], START + 2 * H)).toEqual([]);
  });

  test('a live maintenance window cannot be hidden; before it, it can', () => {
    expect(canHideBanner(a, START - H)).toBe(true);
    expect(canHideBanner(a, START + 1)).toBe(false);
  });
});

describe('modal stages', () => {
  const list = parseAnnouncements([maint, { id: 'I1', kind: 'info', title: 'Info', startsAt: '2026-11-20T00:00:00Z' }]);
  const [a] = list;
  test('notice, then soon, then live (read-only); info never', () => {
    expect(modalStageNow(a, START - H)).toBe('notice');
    expect(modalStageNow(a, START - 5 * 60 * 1000)).toBe('soon');
    expect(modalStageNow(a, START + 1)).toBe('live');
    expect(modalStageNow({ ...a, readOnly: false }, START + 1)).toBeNull();
    expect(modalStageNow(list[1], START)).toBeNull();
  });

  test('once per stage per user; a later "got it" covers the earlier stages', () => {
    expect(pendingModal(list, [], [], START - H)).toEqual({ announcement: a, stage: 'notice' });
    expect(pendingModal(list, [], ackKeysFor(a, 'notice'), START - H)).toBeNull();
    expect(pendingModal(list, [], ackKeysFor(a, 'notice'), START - 60 * 1000).stage).toBe('soon');
    expect(ackKeysFor(a, 'soon')).toEqual(['M1:notice', 'M1:soon']);
    expect(pendingModal(list, [], ['M1:soon'], START - 60 * 1000)).toBeNull();
    expect(pendingModal(list, [], ['M1:soon'], START + 1).stage).toBe('live');
  });
});
