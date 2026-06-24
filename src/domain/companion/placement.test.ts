import { describe, expect, it } from 'vitest';
import { resolveBubblePlacement, resolveBuddyPlacement, type MonitorArea } from './placement';

const monitors: MonitorArea[] = [
  {
    id: 'left',
    workArea: { x: -1280, y: 0, width: 1280, height: 720 },
  },
  {
    id: 'primary',
    primary: true,
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  },
];

describe('companion placement', () => {
  it('keeps free-floating positions on their monitor, including negative coordinates', () => {
    const result = resolveBuddyPlacement({
      mode: 'free',
      freePosition: { x: -300, y: 100 },
      buddySize: { width: 140, height: 140 },
      monitors,
    });
    expect(result.monitorId).toBe('left');
    expect(result.recovered).toBe(false);
    expect(result.position.x).toBe(-300);
  });

  it('recovers disconnected saved positions to the primary monitor', () => {
    const result = resolveBuddyPlacement({
      mode: 'free',
      freePosition: { x: 9000, y: 9000 },
      buddySize: { width: 140, height: 140 },
      monitors,
    });
    expect(result.monitorId).toBe('primary');
    expect(result.recovered).toBe(true);
    expect(result.position.x).toBeLessThan(1920);
  });

  it('supports left, right, and taskbar-perch placement modes', () => {
    expect(
      resolveBuddyPlacement({
        mode: 'dock_left',
        buddySize: { width: 140, height: 140 },
        monitors,
      }).position.x,
    ).toBe(16);
    expect(
      resolveBuddyPlacement({
        mode: 'dock_right',
        buddySize: { width: 140, height: 140 },
        monitors,
      }).position.x,
    ).toBe(1764);
    expect(
      resolveBuddyPlacement({
        mode: 'taskbar_perch',
        buddySize: { width: 140, height: 140 },
        monitors,
      }).position.y,
    ).toBe(884);
  });

  it('flips the bubble near screen edges and clamps vertically', () => {
    const primary = monitors[1];
    if (!primary) {
      throw new Error('primary monitor fixture missing');
    }
    const right = resolveBubblePlacement(
      { x: 40, y: 20, width: 140, height: 140 },
      { width: 340, height: 260 },
      primary.workArea,
    );
    expect(right.direction).toBe('right');

    const left = resolveBubblePlacement(
      { x: 1750, y: 950, width: 140, height: 140 },
      { width: 340, height: 260 },
      primary.workArea,
    );
    expect(left.direction).toBe('left');
    expect(left.position.y).toBeLessThanOrEqual(764);
  });
});
