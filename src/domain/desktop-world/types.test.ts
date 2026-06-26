import { describe, expect, it } from 'vitest';
import { isDesktopWorldSnapshot } from './types';

const validSnapshot = {
  monitors: [
    {
      id: 'monitor-0',
      bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1.25,
      primary: false,
    },
    {
      id: 'monitor-1',
      bounds: { x: 0, y: 0, width: 2560, height: 1440 },
      scaleFactor: 1.5,
      primary: true,
    },
  ],
  workAreas: [
    {
      monitorId: 'monitor-0',
      bounds: { x: -1920, y: 0, width: 1920, height: 1040 },
    },
    {
      monitorId: 'monitor-1',
      bounds: { x: 0, y: 0, width: 2560, height: 1400 },
    },
  ],
  visibleWindowRects: [{ x: -1800, y: 50, width: 900, height: 700 }],
  buddyRect: { x: 100, y: 100, width: 140, height: 140 },
  bubbleRect: null,
  cursorPosition: null,
  capturedAtMs: 1_782_500_000_000,
  surfaceSupport: 'windows_geometry',
};

describe('desktop world snapshot boundary', () => {
  it('accepts multiple monitors, negative coordinates, and monitor scale factors', () => {
    expect(isDesktopWorldSnapshot(validSnapshot)).toBe(true);
  });

  it('accepts cursor coordinates only as a typed optional point', () => {
    expect(
      isDesktopWorldSnapshot({
        ...validSnapshot,
        cursorPosition: { x: -40, y: 80 },
      }),
    ).toBe(true);
    expect(
      isDesktopWorldSnapshot({
        ...validSnapshot,
        cursorPosition: { x: 'secret', y: 80 },
      }),
    ).toBe(false);
  });

  it('rejects malformed geometry and unverified surface support values', () => {
    expect(
      isDesktopWorldSnapshot({
        ...validSnapshot,
        visibleWindowRects: [{ x: 0, y: 0, width: 0, height: 50 }],
      }),
    ).toBe(false);
    expect(
      isDesktopWorldSnapshot({
        ...validSnapshot,
        surfaceSupport: 'macos_geometry',
      }),
    ).toBe(false);
  });

  it('does not require or model window identity or content fields', () => {
    const keys = JSON.stringify(validSnapshot);
    expect(keys).not.toContain('title');
    expect(keys).not.toContain('process');
    expect(keys).not.toContain('application');
    expect(keys).not.toContain('content');
    expect(keys).not.toContain('pixels');
  });
});
