import { describe, expect, it } from 'vitest';
import { BUDDY_POSE_IDS } from '../../domain/companion/poseSelection';
import { BUDDY_POSE_ASSETS } from './poseManifest';

describe('BUDDY_POSE_ASSETS', () => {
  it('contains every required pose asset', () => {
    expect(Object.keys(BUDDY_POSE_ASSETS).sort()).toEqual([...BUDDY_POSE_IDS].sort());
  });

  it('does not point runtime poses at the source reference sheet', () => {
    for (const asset of Object.values(BUDDY_POSE_ASSETS)) {
      expect(asset.src).not.toContain('source');
      expect(asset.src).not.toContain('buddy-reference-sheet');
      expect(asset.src).toContain(`${asset.id}.png`);
      expect(asset.alt).toContain('Trading Buddy');
    }
  });

  it('uses stable logical anchors', () => {
    expect(BUDDY_POSE_ASSETS['neutral-front'].anchor).toEqual({ x: 64, y: 118 });
    expect(BUDDY_POSE_ASSETS.sleeping.anchor).toEqual({ x: 64, y: 110 });
  });
});
