import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BuddyView } from './BuddyView';

describe('BuddyView', () => {
  it('toggles the desktop bubble when activated', async () => {
    const user = userEvent.setup();
    const toggleCompanionBubble = vi.fn().mockResolvedValue(undefined);

    render(
      <BuddyView
        windowService={{
          openMainWindow: vi.fn().mockResolvedValue(undefined),
          toggleCompanionBubble,
          controlBubble: vi.fn().mockResolvedValue(undefined),
          positionCompanionBubble: vi.fn().mockResolvedValue(undefined),
          resetBuddyPosition: vi.fn().mockResolvedValue(undefined),
          controlBuddy: vi.fn().mockResolvedValue(undefined),
          getOsIdleSeconds: vi.fn().mockResolvedValue(0),
        }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Talk to Trading Buddy' }));

    expect(toggleCompanionBubble).toHaveBeenCalledOnce();
  });

  it('cleans up the cross-window listener on unmount', async () => {
    const unlisten = vi.fn();
    const subscribe = vi.fn().mockResolvedValue(unlisten);
    const { unmount } = render(
      <BuddyView
        windowService={{
          openMainWindow: vi.fn().mockResolvedValue(undefined),
          toggleCompanionBubble: vi.fn().mockResolvedValue(undefined),
          controlBubble: vi.fn().mockResolvedValue(undefined),
          positionCompanionBubble: vi.fn().mockResolvedValue(undefined),
          resetBuddyPosition: vi.fn().mockResolvedValue(undefined),
          controlBuddy: vi.fn().mockResolvedValue(undefined),
          getOsIdleSeconds: vi.fn().mockResolvedValue(0),
        }}
        companionService={{
          setState: vi.fn().mockResolvedValue(undefined),
          send: vi.fn().mockResolvedValue(undefined),
          emitInteraction: vi.fn().mockResolvedValue(undefined),
          subscribe,
          subscribeInteractions: vi.fn().mockResolvedValue(() => {
            return undefined;
          }),
          startDragging: vi.fn().mockResolvedValue(undefined),
        }}
      />,
    );
    await vi.waitFor(() => {
      expect(subscribe).toHaveBeenCalledOnce();
    });
    unmount();
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
