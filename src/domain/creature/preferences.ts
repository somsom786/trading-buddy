export const MOVEMENT_INTENSITIES = ['low', 'medium', 'lively'] as const;

export type MovementIntensity = (typeof MOVEMENT_INTENSITIES)[number];

export interface CreatureMovementPreferences {
  autonomousMovementEnabled: boolean;
  movementIntensity: MovementIntensity;
  surfaceInteractionEnabled: boolean;
  followMovingSurfaces: boolean;
  cursorAwarenessEnabled: boolean;
  multiMonitorWanderingEnabled: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_CREATURE_MOVEMENT_PREFERENCES: CreatureMovementPreferences = {
  autonomousMovementEnabled: true,
  movementIntensity: 'medium',
  surfaceInteractionEnabled: true,
  followMovingSurfaces: true,
  cursorAwarenessEnabled: false,
  multiMonitorWanderingEnabled: true,
  reducedMotion: false,
};

export function isCreatureMovementPreferences(
  value: unknown,
): value is CreatureMovementPreferences {
  return (
    isRecord(value) &&
    typeof value.autonomousMovementEnabled === 'boolean' &&
    typeof value.movementIntensity === 'string' &&
    MOVEMENT_INTENSITIES.includes(value.movementIntensity as MovementIntensity) &&
    typeof value.surfaceInteractionEnabled === 'boolean' &&
    typeof value.followMovingSurfaces === 'boolean' &&
    typeof value.cursorAwarenessEnabled === 'boolean' &&
    typeof value.multiMonitorWanderingEnabled === 'boolean' &&
    typeof value.reducedMotion === 'boolean'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
