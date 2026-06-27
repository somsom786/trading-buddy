import { describe, expect, it } from 'vitest';
import { companionStatePrompt, decayIdentityState, identityStateForMode } from './identity';

describe('companion identity state', () => {
  it('maps conversation modes deterministically', () => {
    expect(identityStateForMode('listen', 10)).toEqual({
      state: 'quiet',
      reasonCode: 'user_requested_listening',
      enteredAt: 10,
    });
    expect(identityStateForMode('plan', 10).state).toBe('focused');
  });

  it('decays naturally to calm and remains inspectable', () => {
    const state = identityStateForMode('hang_out', 10);
    const decayed = decayIdentityState(state, 130_011);
    expect(decayed.state).toBe('calm');
    expect(companionStatePrompt(decayed)).toContain('Reason: natural_decay');
  });
});
