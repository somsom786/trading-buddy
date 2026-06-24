import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CompanionService } from '../../services/tauri/companionService';
import { BuddyRenderer } from './BuddyRenderer';

const startDragging = vi.fn().mockResolvedValue(undefined);
const service: CompanionService = {
  setState: vi.fn(),
  send: vi.fn(),
  emitInteraction: vi.fn(),
  subscribe: vi.fn().mockResolvedValue(() => {
    return undefined;
  }),
  subscribeInteractions: vi.fn().mockResolvedValue(() => {
    return undefined;
  }),
  startDragging,
};

describe('BuddyRenderer', () => {
  it('opens on a stationary click', () => {
    const onActivate = vi.fn();
    render(<BuddyRenderer state="idle" companionService={service} onActivate={onActivate} />);
    const buddy = screen.getByRole('button', { name: 'Talk to Trading Buddy' });
    fireEvent.pointerDown(buddy, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(buddy, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('starts dragging without opening the main window', () => {
    const onActivate = vi.fn();
    render(<BuddyRenderer state="idle" companionService={service} onActivate={onActivate} />);
    const buddy = screen.getByRole('button', { name: 'Talk to Trading Buddy' });
    fireEvent.pointerDown(buddy, { pointerId: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(buddy, { pointerId: 2, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(buddy, { pointerId: 2, clientX: 30, clientY: 30 });
    expect(startDragging).toHaveBeenCalled();
    expect(onActivate).not.toHaveBeenCalled();
  });
});
