export const BUDDY_STATES = [
  'idle',
  'listening',
  'thinking',
  'talking',
  'happy',
  'concerned',
  'sleeping',
  'error',
] as const;

export type BuddyState = (typeof BUDDY_STATES)[number];

export type BuddyLifecycleEvent =
  | 'input_started'
  | 'input_cleared'
  | 'message_submitted'
  | 'response_started'
  | 'generation_completed'
  | 'generation_cancelled'
  | 'provider_unavailable'
  | 'generation_failed';

export function buddyStateForLifecycle(
  event: BuddyLifecycleEvent,
  fallback: BuddyState = 'idle',
): BuddyState {
  switch (event) {
    case 'input_started':
      return 'listening';
    case 'message_submitted':
      return 'thinking';
    case 'response_started':
      return 'talking';
    case 'generation_completed':
    case 'generation_cancelled':
      return 'idle';
    case 'provider_unavailable':
      return 'concerned';
    case 'generation_failed':
      return 'error';
    case 'input_cleared':
      return fallback;
  }
}

export function isBuddyState(value: unknown): value is BuddyState {
  return typeof value === 'string' && (BUDDY_STATES as readonly string[]).includes(value);
}

export function buddyStateToVisualState(state: BuddyState) {
  switch (state) {
    case 'listening':
      return { emotion: 'curious', activity: 'listening' } as const;
    case 'thinking':
      return { emotion: 'calm', activity: 'thinking' } as const;
    case 'talking':
      return { emotion: 'happy', activity: 'talking' } as const;
    case 'happy':
      return { emotion: 'happy', activity: 'breathing' } as const;
    case 'concerned':
      return { emotion: 'concerned', activity: 'alert' } as const;
    case 'sleeping':
      return { emotion: 'sleepy', activity: 'sleeping' } as const;
    case 'error':
      return { emotion: 'concerned', activity: 'alert' } as const;
    case 'idle':
      return { emotion: 'calm', activity: 'breathing' } as const;
  }
}
