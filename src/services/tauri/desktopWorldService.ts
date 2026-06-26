import { invoke } from '@tauri-apps/api/core';
import {
  isDesktopWorldSnapshot,
  type DesktopWorldSnapshot,
} from '../../domain/desktop-world/types';

export interface DesktopWorldService {
  snapshot(options?: { includeCursor?: boolean }): Promise<DesktopWorldSnapshot>;
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
};
