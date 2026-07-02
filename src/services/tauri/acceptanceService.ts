import { invoke } from '@tauri-apps/api/core';
import {
  isAcceptanceDiagnostics,
  type AcceptanceDiagnostics,
  type AcceptanceRun,
} from '../../domain/acceptance/types';
import { createAcceptanceRun, isAcceptanceRun } from '../../domain/acceptance/runner';

const STORAGE_KEY = 'trading-buddy:task-12d-native-acceptance:v1';

export interface AcceptanceService {
  captureDiagnostics(): Promise<AcceptanceDiagnostics>;
  loadRun(): AcceptanceRun;
  saveRun(run: AcceptanceRun): void;
  resetRun(): AcceptanceRun;
}

export const tauriAcceptanceService: AcceptanceService = {
  async captureDiagnostics() {
    const value = await invoke<unknown>('get_acceptance_diagnostics');
    if (!isAcceptanceDiagnostics(value)) {
      throw new Error('Invalid guided acceptance diagnostic response.');
    }
    return value;
  },
  loadRun() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createAcceptanceRun();
    }
    try {
      const value: unknown = JSON.parse(raw);
      return isAcceptanceRun(value) ? value : createAcceptanceRun();
    } catch {
      return createAcceptanceRun();
    }
  },
  saveRun(run) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  },
  resetRun() {
    const run = createAcceptanceRun();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
    return run;
  },
};
