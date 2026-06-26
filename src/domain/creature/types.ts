import type { DesktopPoint, DesktopWorldSnapshot, SurfaceRect } from '../desktop-world/types';

export interface Vector {
  x: number;
  y: number;
}

export type CreatureFacing = 'left' | 'right';

export type CreatureLocomotion =
  | 'idle'
  | 'walk'
  | 'sit'
  | 'sleep'
  | 'fall'
  | 'land'
  | 'dragged'
  | 'dropped'
  | 'recover'
  | 'climb'
  | 'hang'
  | 'peek'
  | 'writing'
  | 'listening'
  | 'talking'
  | 'thinking';

export type CreatureBehavior =
  | 'resting'
  | 'wandering'
  | 'seeking_surface'
  | 'sitting_on_edge'
  | 'sleeping'
  | 'observing_cursor'
  | 'interacting'
  | 'conversing'
  | 'journaling'
  | 'waiting'
  | 'recovering';

export type CreatureDragState =
  | { kind: 'none' }
  | { kind: 'dragging'; startedAtMs: number }
  | { kind: 'dropped'; releasedAtMs: number; releaseVelocity: Vector };

export interface CreaturePhysicalState {
  position: DesktopPoint;
  velocity: Vector;
  acceleration: Vector;
  facing: CreatureFacing;
  grounded: boolean;
  currentSurfaceId: string | null;
  locomotion: CreatureLocomotion;
  dragState: CreatureDragState;
  destination: DesktopPoint | null;
  stateElapsedMs: number;
  updatedAtMs: number;
}

export interface CreatureSimulationState {
  physical: CreaturePhysicalState;
  behavior: CreatureBehavior;
}

export interface CreatureSurface {
  id: string;
  kind: 'monitor_floor' | 'window_top' | 'work_area_edge';
  start: DesktopPoint;
  end: DesktopPoint;
  normal: Vector;
  monitorId: string;
  validUntilMs: number;
}

export interface CreatureSafeArea {
  monitorId: string;
  bounds: SurfaceRect;
  primary: boolean;
}

export interface CreatureSimulationConfig {
  fixedTimestepMs: number;
  maxCatchUpSteps: number;
  buddySize: { width: number; height: number };
  walkSpeed: number;
  walkAcceleration: number;
  gravity: number;
  terminalVelocity: number;
  destinationTolerance: number;
  landingDurationMs: number;
  recoveryDurationMs: number;
  edgeMargin: number;
}

export interface CreatureWorld {
  snapshot: DesktopWorldSnapshot;
  surfaces: CreatureSurface[];
  safeAreas: CreatureSafeArea[];
}

export interface CreatureClockState {
  simulation: CreatureSimulationState;
  accumulatorMs: number;
}

export const DEFAULT_CREATURE_CONFIG: CreatureSimulationConfig = {
  fixedTimestepMs: 1000 / 30,
  maxCatchUpSteps: 5,
  buddySize: { width: 140, height: 140 },
  walkSpeed: 82,
  walkAcceleration: 420,
  gravity: 1_650,
  terminalVelocity: 940,
  destinationTolerance: 3,
  landingDurationMs: 180,
  recoveryDurationMs: 320,
  edgeMargin: 8,
};
