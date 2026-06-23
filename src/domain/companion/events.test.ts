import { describe, expect, it } from 'vitest';
import { isCompanionCommand, isCompanionInteraction } from './events';

describe('companion event validation', () => {
  it('accepts known typed payloads', () => {
    expect(isCompanionCommand({ type: 'set_state', state: 'talking' })).toBe(true);
    expect(isCompanionCommand({ type: 'hide' })).toBe(true);
    expect(isCompanionInteraction({ type: 'buddy_clicked' })).toBe(true);
  });

  it('rejects arbitrary states and event names', () => {
    expect(isCompanionCommand({ type: 'set_state', state: 'laser_mode' })).toBe(false);
    expect(isCompanionCommand({ type: 'delete_everything' })).toBe(false);
    expect(isCompanionInteraction({ type: 'unknown' })).toBe(false);
  });
});
