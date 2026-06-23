import { describe, expect, it } from 'vitest';
import { isWindowPosition } from './windowPosition';

describe('isWindowPosition', () => {
  it('accepts integer screen coordinates', () => {
    expect(isWindowPosition({ x: -320, y: 144 })).toBe(true);
  });

  it.each([null, {}, { x: 1 }, { x: 1.5, y: 2 }, { x: '1', y: 2 }])(
    'rejects invalid position %j',
    (position) => {
      expect(isWindowPosition(position)).toBe(false);
    },
  );
});
