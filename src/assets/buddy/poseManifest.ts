import { BUDDY_POSE_IDS, type BuddyPoseId } from '../../domain/companion/poseSelection';

export interface BuddyPoseAsset {
  id: BuddyPoseId;
  src: string;
  alt: string;
  anchor: {
    x: number;
    y: number;
  };
}

const POSE_ALT_TEXT: Record<BuddyPoseId, string> = {
  'neutral-front': 'Trading Buddy standing and facing forward',
  'neutral-side': 'Trading Buddy standing in side view',
  'neutral-back': 'Trading Buddy standing in rear view',
  curious: 'Trading Buddy looking curious',
  happy: 'Trading Buddy smiling happily',
  proud: 'Trading Buddy smiling with eyes closed',
  concerned: 'Trading Buddy looking concerned',
  thinking: 'Trading Buddy thinking with one hand raised',
  writing: 'Trading Buddy writing in a notebook',
  sleeping: 'Trading Buddy sleeping',
};

export const BUDDY_POSE_ASSETS: Record<BuddyPoseId, BuddyPoseAsset> = Object.fromEntries(
  BUDDY_POSE_IDS.map((id) => [
    id,
    {
      id,
      src: new URL(`./poses/${id}.png`, import.meta.url).href,
      alt: POSE_ALT_TEXT[id],
      anchor: {
        x: 64,
        y: id === 'sleeping' ? 110 : 118,
      },
    },
  ]),
) as Record<BuddyPoseId, BuddyPoseAsset>;
