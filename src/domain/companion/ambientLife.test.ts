import { describe, expect, it } from 'vitest';
import { conversationVisualState, decideAmbientLife, wakeVisualState } from './ambientLife';
import type { BuddyVisualState } from './visualState';

const current: BuddyVisualState = { emotion: 'calm', activity: 'breathing' };

describe('ambient life engine', () => {
  it('disables movement for reduced motion', () => {
    const decision = decideAmbientLife(
      { priority: 'ambient', current, osIdleSeconds: 0 },
      {
        enabled: true,
        reducedMotion: true,
        sleepAfterInactivitySeconds: 900,
        nowMs: 10_000,
        lastUserInteractionMs: 0,
        rng: () => 0.1,
      },
    );
    expect(decision.reason).toBe('disabled');
    expect(decision.state.activity).toBe('idle');
  });

  it('pauses ambient behavior during active conversation', () => {
    const decision = decideAmbientLife(
      {
        priority: 'active_conversation',
        current: { emotion: 'happy', activity: 'talking' },
        osIdleSeconds: 0,
      },
      {
        enabled: true,
        reducedMotion: false,
        sleepAfterInactivitySeconds: 900,
        nowMs: 1_000,
        lastUserInteractionMs: 1_000,
        rng: () => 0.1,
      },
    );
    expect(decision.reason).toBe('paused');
    expect(decision.state).toEqual({ emotion: 'happy', activity: 'talking' });
  });

  it('sleeps after configured inactivity', () => {
    const decision = decideAmbientLife(
      { priority: 'ambient', current, osIdleSeconds: 901 },
      {
        enabled: true,
        reducedMotion: false,
        sleepAfterInactivitySeconds: 900,
        nowMs: 901_000,
        lastUserInteractionMs: 0,
        rng: () => 0.2,
      },
    );
    expect(decision.reason).toBe('sleep');
    expect(decision.state).toEqual({ emotion: 'sleepy', activity: 'sleeping' });
  });

  it('selects bounded ambient activities from deterministic random values', () => {
    const rolls = [0.4, 0.5];
    const decision = decideAmbientLife(
      { priority: 'ambient', current, osIdleSeconds: 0 },
      {
        enabled: true,
        reducedMotion: false,
        sleepAfterInactivitySeconds: 900,
        nowMs: 1_000,
        lastUserInteractionMs: 1_000,
        rng: () => rolls.shift() ?? 0.5,
      },
    );
    expect(decision.reason).toBe('look');
    expect(decision.state).toEqual({ emotion: 'curious', activity: 'looking' });
    expect(decision.nextDelayMs).toBeGreaterThanOrEqual(2_500);
    expect(decision.nextDelayMs).toBeLessThanOrEqual(14_000);
  });

  it('maps direct conversation phases into visual state', () => {
    expect(wakeVisualState()).toEqual({ emotion: 'curious', activity: 'waking' });
    expect(conversationVisualState('listening')).toEqual({
      emotion: 'curious',
      activity: 'listening',
    });
    expect(conversationVisualState('talking')).toEqual({ emotion: 'happy', activity: 'talking' });
    expect(conversationVisualState('error')).toEqual({ emotion: 'concerned', activity: 'alert' });
  });
});
