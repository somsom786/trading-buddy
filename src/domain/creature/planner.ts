import type { CreatureSimulationState, CreatureSurface } from './types';
import type { MovementIntensity } from './preferences';

export interface CreaturePlannerContext {
  nowMs: number;
  autonomyEnabled: boolean;
  reducedMotion: boolean;
  doNotDisturb: boolean;
  conversationActive: boolean;
  journalActive: boolean;
  userIdleSeconds: number;
  sleepAfterSeconds: number;
  intensity: MovementIntensity;
  surfaces: CreatureSurface[];
  random: () => number;
}

export interface CreaturePlan {
  locomotion: 'idle' | 'walk' | 'sit' | 'sleep' | 'writing';
  destinationX: number | null;
  behavior: CreatureSimulationState['behavior'];
  nextDecisionAtMs: number;
  reason:
    | 'disabled'
    | 'reduced_motion'
    | 'busy'
    | 'dragging'
    | 'sleep'
    | 'wander'
    | 'sit'
    | 'write'
    | 'rest';
}

export function planCreatureAction(
  state: CreatureSimulationState,
  context: CreaturePlannerContext,
): CreaturePlan {
  const cooldown = cooldownRange(context.intensity);
  const nextDecisionAtMs =
    context.nowMs + cooldown.min + context.random() * (cooldown.max - cooldown.min);
  if (!context.autonomyEnabled || context.doNotDisturb) {
    return idlePlan('disabled', nextDecisionAtMs);
  }
  if (context.reducedMotion) {
    return idlePlan('reduced_motion', nextDecisionAtMs);
  }
  if (context.conversationActive || context.journalActive) {
    return idlePlan('busy', nextDecisionAtMs);
  }
  if (state.physical.dragState.kind !== 'none') {
    return idlePlan('dragging', nextDecisionAtMs);
  }
  if (context.userIdleSeconds >= context.sleepAfterSeconds) {
    return {
      locomotion: 'sleep',
      destinationX: null,
      behavior: 'sleeping',
      nextDecisionAtMs,
      reason: 'sleep',
    };
  }

  const roll = context.random();
  if (roll < 0.52) {
    const surface = currentOrFloorSurface(state, context.surfaces);
    if (surface) {
      const destinationX =
        surface.start.x + context.random() * Math.max(0, surface.end.x - surface.start.x);
      return {
        locomotion: 'walk',
        destinationX,
        behavior: 'wandering',
        nextDecisionAtMs,
        reason: 'wander',
      };
    }
  }
  if (roll < 0.7) {
    return {
      locomotion: 'sit',
      destinationX: null,
      behavior: 'sitting_on_edge',
      nextDecisionAtMs,
      reason: 'sit',
    };
  }
  if (roll < 0.8) {
    return {
      locomotion: 'writing',
      destinationX: null,
      behavior: 'journaling',
      nextDecisionAtMs,
      reason: 'write',
    };
  }
  return idlePlan('rest', nextDecisionAtMs);
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function currentOrFloorSurface(
  state: CreatureSimulationState,
  surfaces: CreatureSurface[],
): CreatureSurface | undefined {
  return (
    surfaces.find((surface) => surface.id === state.physical.currentSurfaceId) ??
    surfaces.find((surface) => surface.kind === 'monitor_floor')
  );
}

function idlePlan(reason: CreaturePlan['reason'], nextDecisionAtMs: number): CreaturePlan {
  return {
    locomotion: 'idle',
    destinationX: null,
    behavior: 'resting',
    nextDecisionAtMs,
    reason,
  };
}

function cooldownRange(intensity: MovementIntensity): { min: number; max: number } {
  switch (intensity) {
    case 'low':
      return { min: 18_000, max: 36_000 };
    case 'medium':
      return { min: 8_000, max: 18_000 };
    case 'lively':
      return { min: 4_000, max: 10_000 };
  }
}
