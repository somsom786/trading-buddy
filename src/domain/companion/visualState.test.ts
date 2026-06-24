import { describe, expect, it } from 'vitest';
import {
  isBuddyActivity,
  isBuddyEmotion,
  isBuddyVisualState,
  visualStateLabel,
} from './visualState';

describe('buddy visual state', () => {
  it('accepts typed emotion/activity pairs', () => {
    expect(isBuddyEmotion('curious')).toBe(true);
    expect(isBuddyActivity('stretching')).toBe(true);
    expect(isBuddyVisualState({ emotion: 'happy', activity: 'talking' })).toBe(true);
    expect(visualStateLabel({ emotion: 'sleepy', activity: 'sleeping' })).toBe('sleepy + sleeping');
  });

  it('rejects arbitrary animation strings', () => {
    expect(isBuddyEmotion('laser')).toBe(false);
    expect(isBuddyActivity('spin_forever')).toBe(false);
    expect(isBuddyVisualState({ emotion: 'happy', activity: 'spin_forever' })).toBe(false);
  });
});
