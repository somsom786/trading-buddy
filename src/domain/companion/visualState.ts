export const BUDDY_EMOTIONS = [
  'calm',
  'curious',
  'happy',
  'proud',
  'concerned',
  'sad',
  'sleepy',
  'surprised',
] as const;

export type BuddyEmotion = (typeof BUDDY_EMOTIONS)[number];

export const BUDDY_ACTIVITIES = [
  'idle',
  'breathing',
  'blinking',
  'looking',
  'listening',
  'thinking',
  'talking',
  'stretching',
  'sitting',
  'sleeping',
  'waking',
  'writing',
  'alert',
] as const;

export type BuddyActivity = (typeof BUDDY_ACTIVITIES)[number];

export interface BuddyVisualState {
  emotion: BuddyEmotion;
  activity: BuddyActivity;
}

export const DEFAULT_BUDDY_VISUAL_STATE: BuddyVisualState = {
  emotion: 'calm',
  activity: 'breathing',
};

export function isBuddyEmotion(value: unknown): value is BuddyEmotion {
  return typeof value === 'string' && (BUDDY_EMOTIONS as readonly string[]).includes(value);
}

export function isBuddyActivity(value: unknown): value is BuddyActivity {
  return typeof value === 'string' && (BUDDY_ACTIVITIES as readonly string[]).includes(value);
}

export function isBuddyVisualState(value: unknown): value is BuddyVisualState {
  return (
    typeof value === 'object' &&
    value !== null &&
    isBuddyEmotion((value as { emotion?: unknown }).emotion) &&
    isBuddyActivity((value as { activity?: unknown }).activity)
  );
}

export function visualStateLabel(state: BuddyVisualState): string {
  return `${state.emotion} + ${state.activity}`;
}
