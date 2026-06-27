import type {
  CreatureBehavior,
  CreatureFacing,
  CreatureLocomotion,
  CreatureSimulationState,
} from './types';

export type CreatureAnimationReason =
  | 'initial_state'
  | 'autonomous_plan'
  | 'physics_transition'
  | 'direct_interaction'
  | 'conversation_state'
  | 'safe_recovery'
  | 'reduced_motion';

export interface CreatureAnimationIntent {
  locomotion: CreatureLocomotion;
  behavior: CreatureBehavior;
  facing: CreatureFacing;
  intensity: number;
  loop: boolean;
  enteredAt: number;
  reasonCode: CreatureAnimationReason;
}

export function createAnimationIntent(
  state: CreatureSimulationState,
  options: {
    nowMs: number;
    enteredAt?: number;
    reasonCode?: CreatureAnimationReason;
    reducedMotion?: boolean;
  },
): CreatureAnimationIntent {
  return {
    locomotion: state.physical.locomotion,
    behavior: state.behavior,
    facing: state.physical.facing,
    intensity: options.reducedMotion ? 0 : locomotionIntensity(state.physical.locomotion),
    loop: isLoopingLocomotion(state.physical.locomotion),
    enteredAt: options.enteredAt ?? options.nowMs,
    reasonCode:
      options.reducedMotion && state.physical.locomotion !== 'idle'
        ? 'reduced_motion'
        : (options.reasonCode ?? 'initial_state'),
  };
}

export function animationIntentChanged(
  previous: CreatureAnimationIntent | null,
  next: CreatureAnimationIntent,
): boolean {
  if (previous === null) {
    return true;
  }
  return (
    previous.locomotion !== next.locomotion ||
    previous.behavior !== next.behavior ||
    previous.facing !== next.facing ||
    previous.intensity !== next.intensity ||
    previous.loop !== next.loop ||
    previous.reasonCode !== next.reasonCode
  );
}

function locomotionIntensity(locomotion: CreatureLocomotion): number {
  switch (locomotion) {
    case 'walk':
      return 0.65;
    case 'fall':
    case 'dropped':
      return 1;
    case 'land':
    case 'recover':
      return 0.75;
    case 'dragged':
      return 0.5;
    case 'talking':
    case 'writing':
      return 0.55;
    case 'thinking':
    case 'listening':
      return 0.35;
    case 'sit':
    case 'sleep':
    case 'idle':
    case 'climb':
    case 'hang':
    case 'peek':
      return 0.2;
  }
}

function isLoopingLocomotion(locomotion: CreatureLocomotion): boolean {
  return !['land', 'dropped', 'recover'].includes(locomotion);
}
