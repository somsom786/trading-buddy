import { describe, expect, it } from 'vitest';
import type { DesktopWorldSnapshot } from '../desktop-world/types';
import { planCreatureAction, createSeededRandom } from './planner';
import { safeSpawn, stepCreaturePhysics } from './physics';
import { advanceCreatureClock, createCreatureSimulation } from './simulation';
import { buildSafeAreas, buildSurfaceGraph } from './surfaces';
import { DEFAULT_CREATURE_CONFIG, type CreaturePhysicalState, type CreatureWorld } from './types';

const snapshot: DesktopWorldSnapshot = {
  monitors: [
    {
      id: 'monitor-left',
      bounds: { x: -1280, y: 0, width: 1280, height: 1024 },
      scaleFactor: 1,
      primary: false,
    },
    {
      id: 'monitor-main',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1.25,
      primary: true,
    },
  ],
  workAreas: [
    {
      monitorId: 'monitor-left',
      bounds: { x: -1280, y: 0, width: 1280, height: 984 },
    },
    {
      monitorId: 'monitor-main',
      bounds: { x: 0, y: 0, width: 1920, height: 1040 },
    },
  ],
  visibleWindowRects: [{ x: 300, y: 500, width: 700, height: 500 }],
  buddyRect: { x: 1600, y: 900, width: 140, height: 140 },
  bubbleRect: null,
  cursorPosition: null,
  capturedAtMs: 1_000,
  surfaceSupport: 'windows_geometry',
};

function world(value = snapshot): CreatureWorld {
  return {
    snapshot: value,
    safeAreas: buildSafeAreas(value),
    surfaces: buildSurfaceGraph(value),
  };
}

function groundedState(overrides: Partial<CreaturePhysicalState> = {}): CreaturePhysicalState {
  return {
    position: { x: 100, y: 900 },
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    facing: 'right',
    grounded: true,
    currentSurfaceId: 'monitor_floor:monitor-main',
    locomotion: 'idle',
    dragState: { kind: 'none' },
    destination: null,
    stateElapsedMs: 0,
    updatedAtMs: 1_000,
    ...overrides,
  };
}

describe('creature surface graph', () => {
  it('builds monitor floors and geometry-only window tops with stable ids', () => {
    const surfaces = buildSurfaceGraph(snapshot);
    expect(surfaces.map((surface) => surface.kind)).toContain('monitor_floor');
    expect(surfaces).toContainEqual(
      expect.objectContaining({
        id: 'window_top:monitor-main:300:500:700',
        kind: 'window_top',
      }),
    );
    expect(JSON.stringify(surfaces)).not.toMatch(/title|process|application|content/);
  });
});

describe('creature physics', () => {
  it('walks left and right and reaches a bounded destination', () => {
    let state = groundedState({
      locomotion: 'walk',
      destination: { x: 350, y: 900 },
    });
    for (let index = 0; index < 300 && state.destination; index += 1) {
      state = stepCreaturePhysics(
        state,
        world().surfaces,
        world().safeAreas,
        DEFAULT_CREATURE_CONFIG,
      );
    }
    expect(state.position.x).toBeCloseTo(350, 1);
    expect(state.locomotion).toBe('idle');

    state = {
      ...state,
      locomotion: 'walk',
      destination: { x: 40, y: 900 },
    };
    for (let index = 0; index < 300 && state.destination; index += 1) {
      state = stepCreaturePhysics(
        state,
        world().surfaces,
        world().safeAreas,
        DEFAULT_CREATURE_CONFIG,
      );
    }
    expect(state.facing).toBe('left');
    expect(state.position.x).toBeCloseTo(40, 1);
  });

  it('applies gravity, terminal velocity, lands, and recovers', () => {
    let state = groundedState({
      position: { x: 400, y: 100 },
      grounded: false,
      currentSurfaceId: null,
      locomotion: 'fall',
    });
    let maximumVelocity = 0;
    for (let index = 0; index < 240 && state.locomotion === 'fall'; index += 1) {
      state = stepCreaturePhysics(
        state,
        world().surfaces,
        world().safeAreas,
        DEFAULT_CREATURE_CONFIG,
      );
      maximumVelocity = Math.max(maximumVelocity, state.velocity.y);
    }
    expect(maximumVelocity).toBeLessThanOrEqual(DEFAULT_CREATURE_CONFIG.terminalVelocity);
    expect(state.locomotion).toBe('land');
    expect(state.position.y).toBe(360);

    for (let index = 0; index < 30 && state.locomotion !== 'idle'; index += 1) {
      state = stepCreaturePhysics(
        state,
        world().surfaces,
        world().safeAreas,
        DEFAULT_CREATURE_CONFIG,
      );
    }
    expect(state.locomotion).toBe('idle');
  });

  it('uses release velocity for a drop and falls when its surface disappears', () => {
    const dropped = stepCreaturePhysics(
      groundedState({
        dragState: {
          kind: 'dropped',
          releasedAtMs: 1_000,
          releaseVelocity: { x: 20, y: 120 },
        },
        locomotion: 'dropped',
      }),
      world().surfaces,
      world().safeAreas,
      DEFAULT_CREATURE_CONFIG,
    );
    expect(dropped.locomotion).toBe('fall');
    expect(dropped.velocity.y).toBe(120);

    const missingSurface = stepCreaturePhysics(
      groundedState({ currentSurfaceId: 'window_top:gone' }),
      world().surfaces,
      world().safeAreas,
      DEFAULT_CREATURE_CONFIG,
    );
    expect(missingSurface.locomotion).toBe('fall');
  });

  it('recovers extreme and off-screen positions to the primary work area', () => {
    const recovered = stepCreaturePhysics(
      groundedState({ position: { x: Number.MAX_VALUE, y: Number.MAX_VALUE } }),
      world().surfaces,
      world().safeAreas,
      DEFAULT_CREATURE_CONFIG,
    );
    expect(recovered.locomotion).toBe('recover');
    expect(recovered.position.x).toBeGreaterThanOrEqual(0);
    expect(recovered.position.x).toBeLessThan(1920);
    expect(recovered.position.y).toBe(900);
  });

  it('supports safe spawn on negative-coordinate monitors', () => {
    const spawn = safeSpawn(world().safeAreas, DEFAULT_CREATURE_CONFIG, {
      x: -900,
      y: 300,
    });
    expect(spawn.position.x).toBeLessThan(0);
    expect(spawn.position.x).toBeGreaterThanOrEqual(-1280);
    expect(spawn.surfaceId).toBe('monitor_floor:monitor-left');
  });

  it('advances with a fixed timestep independent of render chunking', () => {
    const initial = createCreatureSimulation(world(), DEFAULT_CREATURE_CONFIG, 1_000);
    const moving = {
      ...initial,
      physical: {
        ...initial.physical,
        position: { x: 100, y: 900 },
        currentSurfaceId: 'monitor_floor:monitor-main',
        grounded: true,
        locomotion: 'walk' as const,
        destination: { x: 500, y: 900 },
      },
    };
    const once = advanceCreatureClock(
      { simulation: moving, accumulatorMs: 0 },
      DEFAULT_CREATURE_CONFIG.fixedTimestepMs * 2,
      world(),
      DEFAULT_CREATURE_CONFIG,
    );
    const first = advanceCreatureClock(
      { simulation: moving, accumulatorMs: 0 },
      DEFAULT_CREATURE_CONFIG.fixedTimestepMs,
      world(),
      DEFAULT_CREATURE_CONFIG,
    );
    const twice = advanceCreatureClock(
      first,
      DEFAULT_CREATURE_CONFIG.fixedTimestepMs,
      world(),
      DEFAULT_CREATURE_CONFIG,
    );
    expect(once.simulation.physical.position.x).toBeCloseTo(
      twice.simulation.physical.position.x,
      6,
    );
  });
});

describe('creature planner', () => {
  it('is deterministic, cooldown-bound, and pauses while busy or dragged', () => {
    const simulation = createCreatureSimulation(world(), DEFAULT_CREATURE_CONFIG, 1_000);
    const randomA = createSeededRandom(42);
    const randomB = createSeededRandom(42);
    const context = {
      nowMs: 1_000,
      autonomyEnabled: true,
      reducedMotion: false,
      doNotDisturb: false,
      conversationActive: false,
      journalActive: false,
      userIdleSeconds: 0,
      sleepAfterSeconds: 900,
      intensity: 'medium' as const,
      surfaces: world().surfaces,
    };
    expect(planCreatureAction(simulation, { ...context, random: randomA })).toEqual(
      planCreatureAction(simulation, { ...context, random: randomB }),
    );
    expect(
      planCreatureAction(simulation, {
        ...context,
        conversationActive: true,
        random: () => 0,
      }).reason,
    ).toBe('busy');
    expect(
      planCreatureAction(
        {
          ...simulation,
          physical: {
            ...simulation.physical,
            dragState: { kind: 'dragging', startedAtMs: 1_000 },
          },
        },
        { ...context, random: () => 0 },
      ).reason,
    ).toBe('dragging');
  });
});
