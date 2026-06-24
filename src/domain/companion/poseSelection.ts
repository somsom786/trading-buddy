import type { BuddyVisualState } from './visualState';

export const BUDDY_POSE_IDS = [
  'neutral-front',
  'neutral-side',
  'neutral-back',
  'curious',
  'happy',
  'proud',
  'concerned',
  'thinking',
  'writing',
  'sleeping',
] as const;

export type BuddyPoseId = (typeof BUDDY_POSE_IDS)[number];

export function isBuddyPoseId(value: unknown): value is BuddyPoseId {
  return typeof value === 'string' && (BUDDY_POSE_IDS as readonly string[]).includes(value);
}

export function selectBuddyPose(visualState: BuddyVisualState): BuddyPoseId {
  if (visualState.activity === 'sleeping') {
    return 'sleeping';
  }
  if (visualState.activity === 'writing') {
    return 'writing';
  }
  if (visualState.activity === 'thinking') {
    return 'thinking';
  }
  if (visualState.emotion === 'concerned' || visualState.activity === 'alert') {
    return 'concerned';
  }
  if (visualState.emotion === 'proud') {
    return 'proud';
  }
  if (visualState.emotion === 'happy') {
    return 'happy';
  }
  if (visualState.emotion === 'curious' || visualState.activity === 'looking') {
    return 'curious';
  }
  return 'neutral-front';
}
