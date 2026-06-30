import { describe, expect, it } from 'vitest';
import { petdexRowForVisualState } from '../../domain/petdex/stateRows';

describe('petdexRowForVisualState', () => {
  it('maps trusted companion state to deterministic Petdex rows', () => {
    expect(
      petdexRowForVisualState('idle', { emotion: 'calm', activity: 'breathing' }, 'right'),
    ).toBe(0);
    expect(
      petdexRowForVisualState('idle', { emotion: 'curious', activity: 'looking' }, 'left'),
    ).toBe(2);
    expect(
      petdexRowForVisualState('thinking', { emotion: 'calm', activity: 'thinking' }, 'right'),
    ).toBe(6);
    expect(
      petdexRowForVisualState('talking', { emotion: 'happy', activity: 'talking' }, 'right'),
    ).toBe(3);
    expect(
      petdexRowForVisualState('error', { emotion: 'concerned', activity: 'alert' }, 'right'),
    ).toBe(5);
    expect(
      petdexRowForVisualState('sleeping', { emotion: 'sleepy', activity: 'sleeping' }, 'right', 8),
    ).toBe(0);
    expect(
      petdexRowForVisualState('talking', { emotion: 'happy', activity: 'talking' }, 'right', 8),
    ).toBe(1);
  });
});
