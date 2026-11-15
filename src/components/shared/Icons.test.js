/**
 * Tests for Icons (src/components/shared/Icons.js) - rewritten 15 Nov 2026 (session 461f9ea9): the old test passed
 * data-testid to the icons, which only take { size, className }, listed 11 icons that no longer exist (Add, Cancel,
 * Success, ...) and checked the JSX name strokeWidth instead of the DOM attribute stroke-width - it failed on every case
 * without testing anything. It now checks EVERY icon the module exports, through the rendered <svg>.
 * (Icons used in the app but missing from the module are caught by check:api-contract - gap kind missing-icon.)
 */

import React from 'react';
import { render } from '@testing-library/react';
import Icons from './Icons';

const names = Object.keys(Icons);
const svgOf = (Icon, props = {}) => render(<Icon {...props} />).container.querySelector('svg');

describe('Icons', () => {
  test('the module exports a set of icon components', () => {
    expect(names.length).toBeGreaterThan(40);
    names.forEach(name => expect(typeof Icons[name]).toBe('function'));
  });

  describe.each(names)('%s', name => {
    test('renders one <svg> with a viewBox and drawing elements', () => {
      const svg = svgOf(Icons[name]);
      expect(svg).not.toBeNull();
      expect(svg.getAttribute('viewBox')).toBeTruthy();
      expect(svg.querySelectorAll('path, circle, polyline, polygon, line, rect, ellipse').length).toBeGreaterThan(0);
    });

    test('takes size (default 20) and className', () => {
      const plain = svgOf(Icons[name]);
      expect(plain.getAttribute('width')).toBe('20');
      expect(plain.getAttribute('height')).toBe('20');
      const sized = svgOf(Icons[name], { size: 32, className: 'text-red-500 hover:text-red-700' });
      expect(sized.getAttribute('width')).toBe('32');
      expect(sized.getAttribute('height')).toBe('32');
      expect(sized).toHaveClass('text-red-500', 'hover:text-red-700');
    });
  });

  test('edge sizes and missing props', () => {
    expect(svgOf(Icons.Bell, { size: 0 }).getAttribute('width')).toBe('0');
    expect(svgOf(Icons.Shield, { size: 1000 }).getAttribute('height')).toBe('1000');
    expect(() => render(<Icons.Info size={undefined} className={undefined} />)).not.toThrow();
  });

  test('stroke icons draw with the current text colour', () => {
    const svg = svgOf(Icons.Dashboard);
    expect(svg.getAttribute('stroke')).toBe('currentColor');
    expect(svg.getAttribute('stroke-width')).toBe('2');
  });
});
