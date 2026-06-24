import { invoke } from '@tauri-apps/api/core';

export interface WindowService {
  openMainWindow(): Promise<void>;
  toggleCompanionBubble(): Promise<void>;
  controlBubble(action: 'show' | 'hide' | 'focus'): Promise<void>;
  positionCompanionBubble(): Promise<void>;
  resetBuddyPosition(): Promise<void>;
  controlBuddy(action: 'show' | 'hide' | 'focus'): Promise<void>;
  getOsIdleSeconds(): Promise<number>;
}

export const tauriWindowService: WindowService = {
  async openMainWindow() {
    await invoke('open_app_window', { label: 'main' });
  },
  async toggleCompanionBubble() {
    await invoke('toggle_companion_bubble');
  },
  async controlBubble(action) {
    await invoke('control_app_window', { label: 'bubble', action });
  },
  async positionCompanionBubble() {
    await invoke('position_companion_bubble');
  },
  async resetBuddyPosition() {
    await invoke('reset_buddy_position');
  },
  async controlBuddy(action) {
    await invoke('control_app_window', { label: 'buddy', action });
  },
  async getOsIdleSeconds() {
    const value = await invoke<unknown>('get_os_idle_seconds');
    return typeof value === 'number' ? value : 0;
  },
};
