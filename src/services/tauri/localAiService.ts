import { Channel, invoke } from '@tauri-apps/api/core';
import {
  isLocalChatEvent,
  isLocalModelList,
  LocalAiException,
  normalizeLocalAiError,
  type LocalAiError,
  type LocalChatEvent,
  type LocalChatRequest,
  type LocalModel,
} from '../../domain/local-ai/types';

export interface LocalAiService {
  listModels(): Promise<LocalModel[]>;
  streamChat(request: LocalChatRequest, onEvent: (event: LocalChatEvent) => void): Promise<void>;
  cancel(requestId: string): Promise<void>;
}

export const tauriLocalAiService: LocalAiService = {
  async listModels() {
    try {
      ensureTauri();
      const value = await invoke<unknown>('list_local_models');
      if (!isLocalModelList(value)) {
        throw new LocalAiException(
          invalidBoundaryError('Invalid local model list received from Rust.'),
        );
      }
      return value;
    } catch (error) {
      throw new LocalAiException(normalizeLocalAiError(error));
    }
  },

  async streamChat(request, onEvent) {
    ensureTauri();
    const channel = new Channel<unknown>();
    channel.onmessage = (value) => {
      if (isLocalChatEvent(value)) {
        onEvent(value);
      } else {
        onEvent({
          type: 'failed',
          requestId: request.requestId,
          error: invalidBoundaryError('Invalid streaming event received from Rust.'),
        });
      }
    };
    try {
      await invoke('stream_local_chat', { request, onEvent: channel });
    } catch (error) {
      throw new LocalAiException(normalizeLocalAiError(error));
    }
  },

  async cancel(requestId) {
    ensureTauri();
    try {
      await invoke('cancel_local_chat', { requestId });
    } catch (error) {
      const normalized = normalizeLocalAiError(error);
      if (normalized.code !== 'request_cancelled') {
        throw new LocalAiException(normalized);
      }
    }
  },
};

function ensureTauri() {
  if (!('__TAURI_INTERNALS__' in window)) {
    throw new LocalAiException({
      code: 'ollama_not_running',
      userMessage: 'Local AI is available in the desktop application.',
      technicalMessage: 'Tauri runtime is not present in this browser preview.',
      retryable: true,
    });
  }
}

function invalidBoundaryError(technicalMessage: string): LocalAiError {
  return {
    code: 'internal_application_error',
    userMessage: 'Trading Buddy received an invalid response from its local service.',
    technicalMessage,
    retryable: true,
  };
}
