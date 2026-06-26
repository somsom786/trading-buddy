import type { DesktopPoint } from '../desktop-world/types';
import { activeSurfaces } from './surfaces';
import type {
  CreaturePhysicalState,
  CreatureSafeArea,
  CreatureSimulationConfig,
  CreatureSurface,
} from './types';

export function stepCreaturePhysics(
  current: CreaturePhysicalState,
  surfaces: CreatureSurface[],
  safeAreas: CreatureSafeArea[],
  config: CreatureSimulationConfig,
): CreaturePhysicalState {
  const dt = config.fixedTimestepMs / 1000;
  const nextTime = current.updatedAtMs + config.fixedTimestepMs;
  const availableSurfaces = activeSurfaces(surfaces, nextTime);

  if (
    !isFinitePhysicalState(current) ||
    !intersectsAnySafeArea(current.position, safeAreas, config)
  ) {
    return recoverPhysicalState(current, safeAreas, config, nextTime);
  }
  if (current.dragState.kind === 'dragging' || current.locomotion === 'dragged') {
    return {
      ...current,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      grounded: false,
      currentSurfaceId: null,
      locomotion: 'dragged',
      stateElapsedMs: current.stateElapsedMs + config.fixedTimestepMs,
      updatedAtMs: nextTime,
    };
  }
  if (current.dragState.kind === 'dropped' || current.locomotion === 'dropped') {
    const releaseVelocity =
      current.dragState.kind === 'dropped' ? current.dragState.releaseVelocity : current.velocity;
    return {
      ...current,
      velocity: {
        x: clamp(releaseVelocity.x, -config.walkSpeed * 2, config.walkSpeed * 2),
        y: clamp(releaseVelocity.y, -config.terminalVelocity, config.terminalVelocity),
      },
      acceleration: { x: 0, y: config.gravity },
      grounded: false,
      currentSurfaceId: null,
      locomotion: 'fall',
      dragState: { kind: 'none' },
      stateElapsedMs: 0,
      updatedAtMs: nextTime,
    };
  }

  if (
    current.grounded &&
    current.currentSurfaceId &&
    !availableSurfaces.some((surface) => surface.id === current.currentSurfaceId)
  ) {
    return beginFall(current, config, nextTime);
  }

  if (!current.grounded || current.locomotion === 'fall') {
    return stepFall(current, availableSurfaces, safeAreas, config, dt, nextTime);
  }

  if (current.locomotion === 'walk' && current.destination) {
    return stepWalk(current, availableSurfaces, config, dt, nextTime);
  }

  if (
    current.locomotion === 'land' &&
    current.stateElapsedMs + config.fixedTimestepMs >= config.landingDurationMs
  ) {
    return transition(current, 'recover', nextTime);
  }
  if (
    current.locomotion === 'recover' &&
    current.stateElapsedMs + config.fixedTimestepMs >= config.recoveryDurationMs
  ) {
    return transition(current, 'idle', nextTime);
  }

  return {
    ...current,
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    stateElapsedMs: current.stateElapsedMs + config.fixedTimestepMs,
    updatedAtMs: nextTime,
  };
}

export function safeSpawn(
  safeAreas: CreatureSafeArea[],
  config: CreatureSimulationConfig,
  preferred?: DesktopPoint,
): { position: DesktopPoint; surfaceId: string | null } {
  const area =
    (preferred
      ? safeAreas.find((candidate) => pointInside(preferred, candidate.bounds))
      : undefined) ??
    safeAreas.find((candidate) => candidate.primary) ??
    safeAreas[0];
  if (!area) {
    return { position: { x: 32, y: 32 }, surfaceId: null };
  }
  const minX = area.bounds.x + config.edgeMargin;
  const maxX = area.bounds.x + area.bounds.width - config.buddySize.width - config.edgeMargin;
  const floorY = area.bounds.y + area.bounds.height - config.buddySize.height;
  return {
    position: {
      x: clamp(preferred?.x ?? maxX - 24, minX, Math.max(minX, maxX)),
      y: floorY,
    },
    surfaceId: `monitor_floor:${area.monitorId}`,
  };
}

function stepWalk(
  current: CreaturePhysicalState,
  surfaces: CreatureSurface[],
  config: CreatureSimulationConfig,
  dt: number,
  nextTime: number,
): CreaturePhysicalState {
  const surface = surfaces.find((candidate) => candidate.id === current.currentSurfaceId);
  if (!surface || !current.destination) {
    return beginFall(current, config, nextTime);
  }
  const minX = surface.start.x + config.edgeMargin;
  const maxX = surface.end.x - config.buddySize.width - config.edgeMargin;
  const targetX = clamp(current.destination.x, minX, Math.max(minX, maxX));
  const distance = targetX - current.position.x;
  const stoppingDistance =
    (current.velocity.x * current.velocity.x) / (2 * config.walkAcceleration);
  const desiredSpeed =
    Math.abs(distance) <= config.destinationTolerance ? 0 : Math.sign(distance) * config.walkSpeed;
  const targetSpeed = stoppingDistance >= Math.abs(distance) ? 0 : desiredSpeed;
  const velocityX = approach(current.velocity.x, targetSpeed, config.walkAcceleration * dt);
  const proposedX = clamp(current.position.x + velocityX * dt, minX, Math.max(minX, maxX));
  const crossedTarget =
    distance !== 0 &&
    Math.sign(targetX - proposedX) !== 0 &&
    Math.sign(targetX - proposedX) !== Math.sign(distance);
  let x = proposedX;
  const reached =
    crossedTarget ||
    (Math.abs(targetX - x) <= config.destinationTolerance &&
      Math.abs(velocityX) <= config.walkAcceleration * dt);
  if (reached) {
    x = targetX;
  }
  return {
    ...current,
    position: { x, y: surface.start.y - config.buddySize.height },
    velocity: { x: reached ? 0 : velocityX, y: 0 },
    acceleration: { x: reached ? 0 : Math.sign(targetSpeed - current.velocity.x), y: 0 },
    facing: reached
      ? current.facing
      : velocityX < 0
        ? 'left'
        : velocityX > 0
          ? 'right'
          : current.facing,
    locomotion: reached ? 'idle' : 'walk',
    destination: reached ? null : current.destination,
    stateElapsedMs: reached ? 0 : current.stateElapsedMs + config.fixedTimestepMs,
    updatedAtMs: nextTime,
  };
}

function stepFall(
  current: CreaturePhysicalState,
  surfaces: CreatureSurface[],
  safeAreas: CreatureSafeArea[],
  config: CreatureSimulationConfig,
  dt: number,
  nextTime: number,
): CreaturePhysicalState {
  const velocityY = Math.min(config.terminalVelocity, current.velocity.y + config.gravity * dt);
  const velocityX = current.velocity.x * 0.985;
  const nextPosition = {
    x: current.position.x + velocityX * dt,
    y: current.position.y + velocityY * dt,
  };
  const oldBottom = current.position.y + config.buddySize.height;
  const newBottom = nextPosition.y + config.buddySize.height;
  const landingSurface = surfaces
    .filter(
      (surface) =>
        surface.start.y >= oldBottom - 1 &&
        surface.start.y <= newBottom &&
        horizontalOverlap(nextPosition.x, config.buddySize.width, surface),
    )
    .sort((left, right) => left.start.y - right.start.y)[0];

  if (landingSurface) {
    const minX = landingSurface.start.x + config.edgeMargin;
    const maxX = landingSurface.end.x - config.buddySize.width - config.edgeMargin;
    return {
      ...current,
      position: {
        x: clamp(nextPosition.x, minX, Math.max(minX, maxX)),
        y: landingSurface.start.y - config.buddySize.height,
      },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      grounded: true,
      currentSurfaceId: landingSurface.id,
      locomotion: 'land',
      destination: null,
      stateElapsedMs: 0,
      updatedAtMs: nextTime,
    };
  }

  if (!intersectsAnySafeArea(nextPosition, safeAreas, config)) {
    return recoverPhysicalState(current, safeAreas, config, nextTime);
  }
  return {
    ...current,
    position: nextPosition,
    velocity: { x: velocityX, y: velocityY },
    acceleration: { x: 0, y: config.gravity },
    grounded: false,
    currentSurfaceId: null,
    locomotion: 'fall',
    stateElapsedMs: current.stateElapsedMs + config.fixedTimestepMs,
    updatedAtMs: nextTime,
  };
}

function beginFall(
  current: CreaturePhysicalState,
  config: CreatureSimulationConfig,
  nextTime: number,
): CreaturePhysicalState {
  return {
    ...current,
    acceleration: { x: 0, y: config.gravity },
    grounded: false,
    currentSurfaceId: null,
    locomotion: 'fall',
    destination: null,
    stateElapsedMs: 0,
    updatedAtMs: nextTime,
  };
}

function recoverPhysicalState(
  current: CreaturePhysicalState,
  safeAreas: CreatureSafeArea[],
  config: CreatureSimulationConfig,
  nextTime: number,
): CreaturePhysicalState {
  const spawn = safeSpawn(safeAreas, config);
  return {
    ...current,
    position: spawn.position,
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    grounded: spawn.surfaceId !== null,
    currentSurfaceId: spawn.surfaceId,
    locomotion: 'recover',
    dragState: { kind: 'none' },
    destination: null,
    stateElapsedMs: 0,
    updatedAtMs: nextTime,
  };
}

function transition(
  current: CreaturePhysicalState,
  locomotion: CreaturePhysicalState['locomotion'],
  nextTime: number,
): CreaturePhysicalState {
  return {
    ...current,
    velocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
    locomotion,
    stateElapsedMs: 0,
    updatedAtMs: nextTime,
  };
}

function intersectsAnySafeArea(
  position: DesktopPoint,
  safeAreas: CreatureSafeArea[],
  config: CreatureSimulationConfig,
): boolean {
  return safeAreas.some(
    (area) =>
      position.x < area.bounds.x + area.bounds.width &&
      position.x + config.buddySize.width > area.bounds.x &&
      position.y < area.bounds.y + area.bounds.height &&
      position.y + config.buddySize.height > area.bounds.y,
  );
}

function pointInside(point: DesktopPoint, rect: CreatureSafeArea['bounds']): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function horizontalOverlap(x: number, width: number, surface: CreatureSurface): boolean {
  return x + width > surface.start.x && x < surface.end.x;
}

function isFinitePhysicalState(state: CreaturePhysicalState): boolean {
  return [
    state.position.x,
    state.position.y,
    state.velocity.x,
    state.velocity.y,
    state.acceleration.x,
    state.acceleration.y,
  ].every(Number.isFinite);
}

function approach(value: number, target: number, maxDelta: number): number {
  if (value < target) {
    return Math.min(value + maxDelta, target);
  }
  return Math.max(value - maxDelta, target);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
