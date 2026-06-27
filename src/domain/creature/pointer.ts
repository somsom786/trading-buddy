import type { DesktopPoint } from '../desktop-world/types';
import type { Vector } from './types';

export type CreaturePointerInteraction =
  | 'idle'
  | 'pressed'
  | 'drag_threshold_pending'
  | 'dragging'
  | 'released'
  | 'cancelled';

export interface PointerSample extends DesktopPoint {
  atMs: number;
}

export interface CreaturePointerState {
  interaction: CreaturePointerInteraction;
  pointerId: number | null;
  origin: PointerSample | null;
  previous: PointerSample | null;
  latest: PointerSample | null;
}

export interface PointerMoveResult {
  state: CreaturePointerState;
  dragStarted: boolean;
}

export interface PointerReleaseResult {
  state: CreaturePointerState;
  activate: boolean;
  releaseVelocity: Vector;
}

export const IDLE_POINTER_STATE: CreaturePointerState = {
  interaction: 'idle',
  pointerId: null,
  origin: null,
  previous: null,
  latest: null,
};

export function pressPointer(pointerId: number, sample: PointerSample): CreaturePointerState {
  return {
    interaction: 'pressed',
    pointerId,
    origin: sample,
    previous: sample,
    latest: sample,
  };
}

export function movePointer(
  state: CreaturePointerState,
  pointerId: number,
  sample: PointerSample,
  threshold = 6,
): PointerMoveResult {
  if (state.pointerId !== pointerId || !state.origin || !state.latest) {
    return { state, dragStarted: false };
  }
  if (state.interaction === 'dragging') {
    return {
      state: {
        ...state,
        previous: state.latest,
        latest: sample,
      },
      dragStarted: false,
    };
  }
  if (!['pressed', 'drag_threshold_pending'].includes(state.interaction)) {
    return { state, dragStarted: false };
  }
  const distance = Math.hypot(sample.x - state.origin.x, sample.y - state.origin.y);
  const dragStarted = distance >= threshold;
  return {
    state: {
      ...state,
      interaction: dragStarted ? 'dragging' : 'drag_threshold_pending',
      previous: state.latest,
      latest: sample,
    },
    dragStarted,
  };
}

export function releasePointer(
  state: CreaturePointerState,
  pointerId: number,
  sample: PointerSample,
): PointerReleaseResult {
  if (state.pointerId !== pointerId || !state.origin) {
    return {
      state: { ...IDLE_POINTER_STATE, interaction: 'released' },
      activate: false,
      releaseVelocity: { x: 0, y: 0 },
    };
  }
  const dragged = state.interaction === 'dragging';
  return {
    state: {
      ...state,
      interaction: 'released',
      previous: state.latest,
      latest: sample,
    },
    activate: !dragged,
    releaseVelocity: dragged
      ? sampleVelocity(state.latest ?? state.origin, sample)
      : { x: 0, y: 0 },
  };
}

export function cancelPointer(
  state: CreaturePointerState,
  pointerId: number,
): CreaturePointerState {
  if (state.pointerId !== pointerId) {
    return state;
  }
  return { ...state, interaction: 'cancelled' };
}

export function resetPointer(): CreaturePointerState {
  return IDLE_POINTER_STATE;
}

function sampleVelocity(previous: PointerSample, latest: PointerSample): Vector {
  const elapsedSeconds = Math.max(0.016, (latest.atMs - previous.atMs) / 1_000);
  return {
    x: clamp((latest.x - previous.x) / elapsedSeconds, -1_200, 1_200),
    y: clamp((latest.y - previous.y) / elapsedSeconds, -1_200, 1_200),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
