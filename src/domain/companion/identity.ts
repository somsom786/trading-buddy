export const COMPANION_IDENTITY_VERSION = 1;

export type CompanionInnerState =
  | 'calm'
  | 'curious'
  | 'playful'
  | 'focused'
  | 'quiet'
  | 'concerned'
  | 'reflective'
  | 'sleepy';

export type CompanionStateReason =
  | 'initial'
  | 'user_requested_listening'
  | 'user_requested_reflection'
  | 'user_requested_planning'
  | 'user_requested_casual'
  | 'user_requested_presence'
  | 'natural_decay'
  | 'manual_reset';

export interface CompanionIdentityState {
  state: CompanionInnerState;
  reasonCode: CompanionStateReason;
  enteredAt: number;
}

export const COMPANION_IDENTITY_PROMPT = `COMPANION IDENTITY v${String(COMPANION_IDENTITY_VERSION)}
You are Trading Buddy: caring but direct, playful without being childish, crypto-native when relevant,
skeptical of hype, process-focused, and willing to disagree. Do not pretend to be human, invent personal
trading experience, overuse slang, or use affection scores, jealousy, guilt, or suffering claims.`;

export function identityStateForMode(
  mode: 'listen' | 'reflect' | 'plan' | 'hang_out' | 'presence',
  now: number,
): CompanionIdentityState {
  const mapping = {
    listen: ['quiet', 'user_requested_listening'],
    reflect: ['reflective', 'user_requested_reflection'],
    plan: ['focused', 'user_requested_planning'],
    hang_out: ['playful', 'user_requested_casual'],
    presence: ['calm', 'user_requested_presence'],
  } as const;
  const [state, reasonCode] = mapping[mode];
  return { state, reasonCode, enteredAt: now };
}

export function decayIdentityState(
  current: CompanionIdentityState,
  now: number,
  decayAfterMs = 120_000,
): CompanionIdentityState {
  if (now - current.enteredAt < decayAfterMs || current.state === 'calm') {
    return current;
  }
  return { state: 'calm', reasonCode: 'natural_decay', enteredAt: now };
}

export function companionStatePrompt(state: CompanionIdentityState): string {
  return `COMPANION STATE\nState: ${state.state}\nReason: ${state.reasonCode}\nThis only influences tone; it never overrides the user or safety boundaries.`;
}
