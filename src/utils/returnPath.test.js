import { returnPathFrom, returnStateFor, DEFAULT_AFTER_SIGN_IN } from './returnPath';

describe('returnPathFrom', () => {
  test('returns the page first opened', () => {
    expect(returnPathFrom({ from: '/notices/SAMPLE-A' })).toBe('/notices/SAMPLE-A');
    expect(returnPathFrom({ from: '/tickets?id=5#c2' })).toBe('/tickets?id=5#c2');
    expect(returnPathFrom('/admin')).toBe('/admin');
  });

  test('falls back to the dashboard without a usable path', () => {
    [undefined, null, {}, { from: 5 }, { from: '' }, { from: 'notices/x' }].forEach(s =>
      expect(returnPathFrom(s)).toBe(DEFAULT_AFTER_SIGN_IN));
  });

  test('never leaves the app or loops back to sign-in', () => {
    ['//evil.example/x', '/\\evil.example', 'https://evil.example/', 'javascript:alert(1)', '/login', '/login?x=1', '/',
      '/notices/a\nb'].forEach(from => expect(returnPathFrom({ from })).toBe(DEFAULT_AFTER_SIGN_IN));
  });
});

test('returnStateFor joins path, query and hash', () => {
  expect(returnStateFor({ pathname: '/notices/SAMPLE-B', search: '?a=1', hash: '#timeline' }))
    .toEqual({ from: '/notices/SAMPLE-B?a=1#timeline' });
});
