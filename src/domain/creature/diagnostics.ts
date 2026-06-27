import { isDesktopWorldSnapshot, type DesktopWorldSnapshot } from '../desktop-world/types';
import { MOVEMENT_INTENSITIES } from './preferences';
import type { CreatureAnimationIntent } from './animation';
import type { MovementIntensity } from './preferences';
import type { CreatureBehavior, CreaturePhysicalState, CreatureSurface } from './types';

export type CreatureLabAction =
  | 'walk_left'
  | 'walk_right'
  | 'fall'
  | 'land'
  | 'sit'
  | 'sleep'
  | 'writing'
  | 'drag_fixture'
  | 'drop_fixture'
  | 'remove_surface'
  | 'move_surface'
  | 'monitor_removal'
  | 'negative_monitor'
  | 'mixed_dpi'
  | 'offscreen_spawn'
  | 'bring_back'
  | 'reduced_motion'
  | 'autonomy_off'
  | 'planner_low'
  | 'planner_medium'
  | 'planner_lively';

export interface CreatureRuntimeDiagnostics {
  worldSnapshot: DesktopWorldSnapshot | null;
  surfaces: CreatureSurface[];
  physical: CreaturePhysicalState | null;
  behavior: CreatureBehavior | null;
  plannerSeed: number;
  nextDecisionAtMs: number;
  plannerDecision: string;
  animationIntent: CreatureAnimationIntent | null;
  pointerState: 'idle' | 'dragging' | 'released';
  movementIntensity: MovementIntensity;
  reducedMotion: boolean;
  autonomyEnabled: boolean;
  targetTickRateHz: number;
  observedTickRateHz: number;
  snapshotRequestCount: number;
  nativeMovementRequestCount: number;
  reactRenderCount: number;
}

export const CREATURE_LAB_ACTIONS: readonly CreatureLabAction[] = [
  'walk_left',
  'walk_right',
  'fall',
  'land',
  'sit',
  'sleep',
  'writing',
  'drag_fixture',
  'drop_fixture',
  'remove_surface',
  'move_surface',
  'monitor_removal',
  'negative_monitor',
  'mixed_dpi',
  'offscreen_spawn',
  'bring_back',
  'reduced_motion',
  'autonomy_off',
  'planner_low',
  'planner_medium',
  'planner_lively',
];

export function isCreatureLabAction(value: unknown): value is CreatureLabAction {
  return typeof value === 'string' && (CREATURE_LAB_ACTIONS as readonly string[]).includes(value);
}

export function isCreatureRuntimeDiagnostics(value: unknown): value is CreatureRuntimeDiagnostics {
  return (
    isRecord(value) &&
    (value.worldSnapshot === null || isDesktopWorldSnapshot(value.worldSnapshot)) &&
    Array.isArray(value.surfaces) &&
    value.surfaces.every(isSurface) &&
    (value.physical === null || isPhysical(value.physical)) &&
    (value.behavior === null || typeof value.behavior === 'string') &&
    Number.isFinite(value.plannerSeed) &&
    Number.isFinite(value.nextDecisionAtMs) &&
    typeof value.plannerDecision === 'string' &&
    (value.animationIntent === null || isAnimationIntent(value.animationIntent)) &&
    ['idle', 'dragging', 'released'].includes(value.pointerState as string) &&
    MOVEMENT_INTENSITIES.includes(value.movementIntensity as MovementIntensity) &&
    typeof value.reducedMotion === 'boolean' &&
    typeof value.autonomyEnabled === 'boolean' &&
    Number.isFinite(value.targetTickRateHz) &&
    Number.isFinite(value.observedTickRateHz) &&
    Number.isFinite(value.snapshotRequestCount) &&
    Number.isFinite(value.nativeMovementRequestCount) &&
    Number.isFinite(value.reactRenderCount)
  );
}

function isSurface(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    ['monitor_floor', 'window_top', 'work_area_edge'].includes(value.kind as string) &&
    isPoint(value.start) &&
    isPoint(value.end) &&
    isPoint(value.normal) &&
    typeof value.monitorId === 'string' &&
    Number.isFinite(value.validUntilMs)
  );
}

function isPhysical(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPoint(value.position) &&
    isPoint(value.velocity) &&
    isPoint(value.acceleration) &&
    ['left', 'right'].includes(value.facing as string) &&
    typeof value.grounded === 'boolean' &&
    (value.currentSurfaceId === null || typeof value.currentSurfaceId === 'string') &&
    typeof value.locomotion === 'string'
  );
}

function isAnimationIntent(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.locomotion === 'string' &&
    typeof value.behavior === 'string' &&
    ['left', 'right'].includes(value.facing as string) &&
    Number.isFinite(value.intensity) &&
    typeof value.loop === 'boolean' &&
    Number.isFinite(value.enteredAt) &&
    typeof value.reasonCode === 'string'
  );
}

function isPoint(value: unknown): boolean {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
