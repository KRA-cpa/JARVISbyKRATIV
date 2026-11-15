import { isBusy } from './useSafeMoment';

describe('isBusy - no modal while the user is mid-activity', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  test('idle page: not busy', () => {
    expect(isBusy(document, 0)).toBe(false);
  });

  test('typing in a text field, textarea, select or editable area: busy', () => {
    document.body.innerHTML = '<input id="t" type="text"><textarea id="a"></textarea><select id="s"><option>x</option></select><div id="e" contenteditable="true"></div>';
    ['t', 'a', 's'].forEach(id => {
      document.getElementById(id).focus();
      expect(isBusy(document, 0)).toBe(true);
    });
    const editable = document.getElementById('e');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    editable.focus();
    expect(isBusy(document, 0)).toBe(true);
  });

  test('a focused checkbox or button is not typing', () => {
    document.body.innerHTML = '<input id="c" type="checkbox"><button id="b">Go</button>';
    document.getElementById('c').focus();
    expect(isBusy(document, 0)).toBe(false);
    document.getElementById('b').focus();
    expect(isBusy(document, 0)).toBe(false);
  });

  test('a request running or a form with unsaved input: busy', () => {
    expect(isBusy(document, 1)).toBe(true);
    document.body.innerHTML = '<form data-unsaved="true"></form>';
    expect(isBusy(document, 0)).toBe(true);
  });
});
