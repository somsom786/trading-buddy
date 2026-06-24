import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BUDDY_POSE_ASSETS } from '../../assets/buddy/poseManifest';
import type { BuddyPoseAsset } from '../../assets/buddy/poseManifest';
import type { BuddyPoseId } from '../../domain/companion/poseSelection';
import { BuddyPoseRenderer } from './BuddyPoseRenderer';

const noop = vi.fn();

describe('BuddyPoseRenderer', () => {
  it('renders the selected pose asset with pixel-art image behavior', () => {
    render(
      <BuddyPoseRenderer
        state="idle"
        visualState={{ emotion: 'happy', activity: 'talking' }}
        onPointerDown={noop}
        onPointerMove={noop}
        onPointerUp={noop}
      />,
    );

    const button = screen.getByRole('button', { name: 'Talk to Trading Buddy' });
    expect(button).toHaveAttribute('data-pose', 'happy');
    expect(button).toHaveAttribute('data-motion', 'on');
    expect(screen.getByRole('img', { name: /smiling happily/i })).toHaveAttribute(
      'draggable',
      'false',
    );
  });

  it('marks motion disabled when reduced motion is requested', () => {
    render(
      <BuddyPoseRenderer
        state="idle"
        visualState={{ emotion: 'calm', activity: 'breathing' }}
        reducedMotion
        onPointerDown={noop}
        onPointerMove={noop}
        onPointerUp={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Talk to Trading Buddy' })).toHaveAttribute(
      'data-motion',
      'off',
    );
  });

  it('falls back to the CSS placeholder when a selected asset is missing', () => {
    const missingAssets = { ...BUDDY_POSE_ASSETS };
    delete (missingAssets as Partial<Record<BuddyPoseId, BuddyPoseAsset>>).thinking;

    render(
      <BuddyPoseRenderer
        state="thinking"
        visualState={{ emotion: 'calm', activity: 'thinking' }}
        assets={missingAssets}
        onPointerDown={noop}
        onPointerMove={noop}
        onPointerUp={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Talk to Trading Buddy' })).not.toHaveAttribute(
      'data-pose',
    );
  });

  it('falls back to the CSS placeholder after an image load error', () => {
    render(
      <BuddyPoseRenderer
        state="idle"
        visualState={{ emotion: 'curious', activity: 'looking' }}
        onPointerDown={noop}
        onPointerMove={noop}
        onPointerUp={noop}
      />,
    );

    fireEvent.error(screen.getByRole('img'));

    expect(screen.getByRole('button', { name: 'Talk to Trading Buddy' })).not.toHaveAttribute(
      'data-pose',
    );
  });
});
