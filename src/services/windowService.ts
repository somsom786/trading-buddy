import { invoke } from '@tauri-apps/api/core';

export interface WindowService {
  openMainWindow(): Promise<void>;
  controlBuddy(action: 'show' | 'hide' | 'focus'): Promise<void>;
}

export const tauriWindowService: WindowService = {
  async openMainWindow() {
    await invoke('open_app_window', { label: 'main' });
  },
  async controlBuddy(action) {
    await invoke('control_app_window', { label: 'buddy', action });
  },
};
