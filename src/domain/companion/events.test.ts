import { describe, expect, it } from 'vitest';
import { isCompanionCommand, isCompanionInteraction } from './events';

describe('companion event validation', () => {
  it('accepts known typed payloads', () => {
    expect(isCompanionCommand({ type: 'set_state', state: 'talking' })).toBe(true);
    expect(isCompanionCommand({ type: 'hide' })).toBe(true);
    expect(isCompanionCommand({ type: 'toggle_bubble' })).toBe(true);
    expect(isCompanionCommand({ type: 'do_not_disturb' })).toBe(true);
    expect(isCompanionCommand({ type: 'bring_buddy_back' })).toBe(true);
    expect(
      isCompanionCommand({
        type: 'movement_preferences_changed',
        preferences: {
          autonomousMovementEnabled: true,
          movementIntensity: 'medium',
          surfaceInteractionEnabled: true,
          followMovingSurfaces: true,
          cursorAwarenessEnabled: false,
          multiMonitorWanderingEnabled: true,
          reducedMotion: false,
        },
      }),
    ).toBe(true);
    expect(isCompanionInteraction({ type: 'buddy_clicked' })).toBe(true);
  });

  it('rejects arbitrary states and event names', () => {
    expect(isCompanionCommand({ type: 'set_state', state: 'laser_mode' })).toBe(false);
    expect(isCompanionCommand({ type: 'delete_everything' })).toBe(false);
    expect(isCompanionInteraction({ type: 'unknown' })).toBe(false);
  });
});
