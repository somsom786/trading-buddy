import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BuddyView } from './BuddyView';

describe('BuddyView', () => {
  it('opens the main window when activated', async () => {
    const user = userEvent.setup();
    const openMainWindow = vi.fn().mockResolvedValue(undefined);

    render(
      <BuddyView
        windowService={{ openMainWindow, controlBuddy: vi.fn().mockResolvedValue(undefined) }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Open Trading Buddy' }));

    expect(openMainWindow).toHaveBeenCalledOnce();
  });

  it('cleans up the cross-window listener on unmount', async () => {
    const unlisten = vi.fn();
    const subscribe = vi.fn().mockResolvedValue(unlisten);
    const { unmount } = render(
      <BuddyView
        windowService={{
          openMainWindow: vi.fn().mockResolvedValue(undefined),
          controlBuddy: vi.fn().mockResolvedValue(undefined),
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
