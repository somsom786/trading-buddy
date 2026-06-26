import { invoke } from '@tauri-apps/api/core';
import {
  isDesktopPoint,
  isDesktopWorldSnapshot,
  type DesktopPoint,
  type DesktopWorldSnapshot,
} from '../../domain/desktop-world/types';

export interface DesktopWorldService {
  snapshot(options?: { includeCursor?: boolean }): Promise<DesktopWorldSnapshot>;
  moveBuddyTo(position: DesktopPoint): Promise<DesktopPoint>;
  bringBuddyBack(): Promise<void>;
  persistBuddyPosition(): Promise<void>;
}

export const tauriDesktopWorldService: DesktopWorldService = {
  async snapshot(options) {
    const value = await invoke<unknown>('get_desktop_world_snapshot', {
      includeCursor: options?.includeCursor ?? false,
    });
    if (!isDesktopWorldSnapshot(value)) {
      throw new Error('Trading Buddy received an invalid desktop geometry snapshot.');
    }
    return value;
  },
  async moveBuddyTo(position) {
    const value = await invoke<unknown>('move_buddy_to', {
      x: Math.round(position.x),
      y: Math.round(position.y),
    });
    if (!isDesktopPoint(value)) {
      throw new Error('Trading Buddy received an invalid clamped buddy position.');
    }
    return value;
  },
  async bringBuddyBack() {
    await invoke('bring_buddy_back');
  },
  async persistBuddyPosition() {
    await invoke('persist_current_buddy_position');
  },
};
