import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import {
  COMPANION_EVENT_NAMES,
  isCompanionCommand,
  isCompanionInteraction,
  type CompanionCommand,
  type CompanionInteraction,
} from '../../domain/companion/events';
import type { BuddyState } from '../../domain/companion/buddyState';
import { tauriWindowService } from '../windowService';

export interface CompanionService {
  setState(state: BuddyState): Promise<void>;
  send(command: CompanionCommand): Promise<void>;
  emitInteraction(interaction: CompanionInteraction): Promise<void>;
  subscribe(handler: (command: CompanionCommand) => void): Promise<UnlistenFn>;
  subscribeInteractions(handler: (interaction: CompanionInteraction) => void): Promise<UnlistenFn>;
  startDragging(): Promise<void>;
}

export const tauriCompanionService: CompanionService = {
  setState(state) {
    return this.send({ type: 'set_state', state });
  },

  async send(command) {
    if (!('__TAURI_INTERNALS__' in window)) {
      return;
    }
    if (command.type === 'show' || command.type === 'hide' || command.type === 'focus') {
      await tauriWindowService.controlBuddy(command.type);
    }
    await emitTo('buddy', COMPANION_EVENT_NAMES.command, command);
  },

  async subscribe(handler) {
    if (!('__TAURI_INTERNALS__' in window)) {
      return () => undefined;
    }
    return listen<unknown>(COMPANION_EVENT_NAMES.command, (event) => {
      if (isCompanionCommand(event.payload)) {
        handler(event.payload);
      }
    });
  },

  async emitInteraction(interaction) {
    if ('__TAURI_INTERNALS__' in window) {
      await emitTo('main', COMPANION_EVENT_NAMES.interaction, interaction);
    }
  },

  async subscribeInteractions(handler) {
    if (!('__TAURI_INTERNALS__' in window)) {
      return () => undefined;
    }
    return listen<unknown>(COMPANION_EVENT_NAMES.interaction, (event) => {
      if (isCompanionInteraction(event.payload)) {
        handler(event.payload);
      }
    });
  },

  async startDragging() {
    if ('__TAURI_INTERNALS__' in window) {
      await getCurrentWindow().startDragging();
      await invoke('persist_current_buddy_position');
    }
  },
};
