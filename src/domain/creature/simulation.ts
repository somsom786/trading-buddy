import { stepCreaturePhysics, safeSpawn } from './physics';
import type {
  CreatureClockState,
  CreatureSimulationConfig,
  CreatureSimulationState,
  CreatureWorld,
} from './types';

export function createCreatureSimulation(
  world: CreatureWorld,
  config: CreatureSimulationConfig,
  nowMs: number,
): CreatureSimulationState {
  const preferred = world.snapshot.buddyRect;
  const spawn = safeSpawn(world.safeAreas, config, {
    x: preferred.x,
    y: preferred.y,
  });
  const restoredIsSafe = world.safeAreas.some(
    (area) =>
      preferred.x >= area.bounds.x &&
      preferred.x + config.buddySize.width <= area.bounds.x + area.bounds.width &&
      preferred.y >= area.bounds.y &&
      preferred.y + config.buddySize.height <= area.bounds.y + area.bounds.height,
  );
  return {
    behavior: restoredIsSafe ? 'resting' : 'recovering',
    physical: {
      position: restoredIsSafe ? { x: preferred.x, y: preferred.y } : spawn.position,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      facing: 'right',
      grounded: !restoredIsSafe || isOnSurface(preferred.y, world, config),
      currentSurfaceId:
        (!restoredIsSafe ? spawn.surfaceId : surfaceAt(preferred.y, world, config)) ?? null,
      locomotion: restoredIsSafe ? 'idle' : 'recover',
      dragState: { kind: 'none' },
      destination: null,
      stateElapsedMs: 0,
      updatedAtMs: nowMs,
    },
  };
}

export function advanceCreatureClock(
  clock: CreatureClockState,
  elapsedMs: number,
  world: CreatureWorld,
  config: CreatureSimulationConfig,
): CreatureClockState {
  let accumulatorMs = Math.min(
    clock.accumulatorMs + Math.max(0, elapsedMs),
    config.fixedTimestepMs * config.maxCatchUpSteps,
  );
  let simulation = clock.simulation;
  let steps = 0;
  while (accumulatorMs >= config.fixedTimestepMs && steps < config.maxCatchUpSteps) {
    simulation = {
      ...simulation,
      physical: stepCreaturePhysics(simulation.physical, world.surfaces, world.safeAreas, config),
    };
    accumulatorMs -= config.fixedTimestepMs;
    steps += 1;
  }
  return { simulation, accumulatorMs };
}

function isOnSurface(y: number, world: CreatureWorld, config: CreatureSimulationConfig): boolean {
  return surfaceAt(y, world, config) !== null;
}

function surfaceAt(
  y: number,
  world: CreatureWorld,
  config: CreatureSimulationConfig,
): string | null {
  const bottom = y + config.buddySize.height;
  return world.surfaces.find((surface) => Math.abs(surface.start.y - bottom) <= 1)?.id ?? null;
}
