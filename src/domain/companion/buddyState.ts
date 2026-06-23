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
