import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopPoint, DesktopWorldSnapshot } from '../domain/desktop-world/types';
import type { DesktopWorldService } from './tauri/desktopWorldService';
import { DesktopCreatureRuntime } from './creatureRuntime';

const snapshot: DesktopWorldSnapshot = {
  monitors: [
    {
      id: 'monitor-0',
      bounds: { x: 0, y: 0, width: 800, height: 720 },
      scaleFactor: 1,
      primary: true,
    },
  ],
  workAreas: [
    {
      monitorId: 'monitor-0',
      bounds: { x: 0, y: 0, width: 800, height: 720 },
    },
  ],
  visibleWindowRects: [],
  buddyRect: { x: 100, y: 580, width: 140, height: 140 },
  bubbleRect: null,
  cursorPosition: null,
  capturedAtMs: 1_000,
  surfaceSupport: 'windows_geometry',
};

describe('DesktopCreatureRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-26T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves autonomously through the native boundary without any model service', async () => {
    const moveBuddyTo = vi.fn((position: DesktopPoint) => Promise.resolve(position));
    const service: DesktopWorldService = {
      snapshot: vi.fn().mockResolvedValue(snapshot),
      moveBuddyTo,
      bringBuddyBack: vi.fn().mockResolvedValue(undefined),
      persistBuddyPosition: vi.fn().mockResolvedValue(undefined),
    };
    const runtime = new DesktopCreatureRuntime({
      worldService: service,
      seed: 1,
      sleepAfterSeconds: 10_000,
    });

    await runtime.start();
    await vi.advanceTimersByTimeAsync(6_000);

    expect(moveBuddyTo).toHaveBeenCalled();
    runtime.stop();
  });

  it('turns native drag completion into a bounded drop and recovery path', async () => {
    const locomotions: string[] = [];
    const service: DesktopWorldService = {
      snapshot: vi.fn().mockResolvedValue(snapshot),
      moveBuddyTo: vi.fn((position: DesktopPoint) => Promise.resolve(position)),
      bringBuddyBack: vi.fn().mockResolvedValue(undefined),
      persistBuddyPosition: vi.fn().mockResolvedValue(undefined),
    };
    const runtime = new DesktopCreatureRuntime({
      worldService: service,
      seed: 2,
      onLocomotionChange: (locomotion) => {
        locomotions.push(locomotion);
      },
    });

    await runtime.start();
    runtime.beginDrag();
    await runtime.endDrag();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(locomotions).toContain('dragged');
    expect(locomotions).toContain('dropped');
    expect(locomotions).toContain('fall');
    expect(locomotions).toContain('land');
    runtime.stop();
  });
});
