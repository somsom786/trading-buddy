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
    const onDragStart = vi.fn();
    const onDragEnd = vi.fn();
    render(
      <BuddyRenderer
        state="idle"
        companionService={service}
        onActivate={onActivate}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />,
    );
    const buddy = screen.getByRole('button', { name: 'Talk to Trading Buddy' });
    fireEvent.pointerDown(buddy, { pointerId: 2, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(buddy, { pointerId: 2, clientX: 30, clientY: 30 });
    fireEvent.pointerUp(buddy, { pointerId: 2, clientX: 30, clientY: 30 });
    expect(startDragging).toHaveBeenCalled();
    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onActivate).not.toHaveBeenCalled();
    return vi.waitFor(() => {
      expect(onDragEnd).toHaveBeenCalledOnce();
    });
  });

  it('keeps sub-threshold motion clickable and cancels without activation', () => {
    const onActivate = vi.fn();
    render(<BuddyRenderer state="idle" companionService={service} onActivate={onActivate} />);
    const buddy = screen.getByRole('button', { name: 'Talk to Trading Buddy' });
    fireEvent.pointerDown(buddy, { pointerId: 3, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(buddy, { pointerId: 3, clientX: 13, clientY: 12 });
    fireEvent.pointerUp(buddy, { pointerId: 3, clientX: 13, clientY: 12 });
    expect(onActivate).toHaveBeenCalledOnce();

    fireEvent.pointerDown(buddy, { pointerId: 4, clientX: 10, clientY: 10 });
    fireEvent.pointerCancel(buddy, { pointerId: 4 });
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
