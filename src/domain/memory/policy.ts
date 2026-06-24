import type { MemoryPreferences, MemorySensitivity } from './types';

export function canAutoConfirmMemory(
  sensitivity: MemorySensitivity,
  preferences: MemoryPreferences,
): boolean {
  if (!preferences.memoryEnabled || preferences.memoryApprovalMode !== 'auto_save_ordinary') {
    return false;
  }
  return sensitivity === 'ordinary';
}

export function canStoreMemorySensitivity(
  sensitivity: MemorySensitivity,
  preferences: MemoryPreferences,
): boolean {
  if (sensitivity === 'prohibited') {
    return false;
  }
  if (sensitivity === 'sensitive') {
    return preferences.allowSensitiveMemories;
  }
  if (sensitivity === 'personal') {
    return preferences.allowPersonalMemories;
  }
  return true;
}
