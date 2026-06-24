import { describe, expect, it } from 'vitest';
import { BUDDY_POSE_IDS, isBuddyPoseId, selectBuddyPose } from './poseSelection';
import type { BuddyVisualState } from './visualState';

function state(partial: Partial<BuddyVisualState>): BuddyVisualState {
  return {
    emotion: partial.emotion ?? 'calm',
    activity: partial.activity ?? 'breathing',
  };
}

describe('poseSelection', () => {
  it('lists every required pose once', () => {
    expect(new Set(BUDDY_POSE_IDS).size).toBe(BUDDY_POSE_IDS.length);
    expect(BUDDY_POSE_IDS).toEqual([
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
    ]);
  });

  it('validates pose IDs', () => {
    expect(isBuddyPoseId('happy')).toBe(true);
    expect(isBuddyPoseId('buddy-reference-sheet')).toBe(false);
  });

  it('uses explicit activity priority before emotion', () => {
    expect(selectBuddyPose(state({ emotion: 'happy', activity: 'sleeping' }))).toBe('sleeping');
    expect(selectBuddyPose(state({ emotion: 'happy', activity: 'writing' }))).toBe('writing');
    expect(selectBuddyPose(state({ emotion: 'proud', activity: 'thinking' }))).toBe('thinking');
  });

  it('selects emotional poses deterministically', () => {
    expect(selectBuddyPose(state({ emotion: 'concerned' }))).toBe('concerned');
    expect(selectBuddyPose(state({ emotion: 'proud' }))).toBe('proud');
    expect(selectBuddyPose(state({ emotion: 'happy' }))).toBe('happy');
    expect(selectBuddyPose(state({ emotion: 'curious' }))).toBe('curious');
  });

  it('selects curious for looking and neutral front by default', () => {
    expect(selectBuddyPose(state({ activity: 'looking' }))).toBe('curious');
    expect(selectBuddyPose(state({ emotion: 'calm', activity: 'breathing' }))).toBe(
      'neutral-front',
    );
  });
});
