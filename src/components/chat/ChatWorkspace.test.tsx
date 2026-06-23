import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CompanionService } from '../../services/tauri/companionService';
import type { LocalAiService } from '../../services/tauri/localAiService';
import type { WindowService } from '../../services/windowService';
import { ChatWorkspace } from './ChatWorkspace';

const companionService: CompanionService = {
  setState: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
  emitInteraction: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(() => {
    return undefined;
  }),
  subscribeInteractions: vi.fn().mockResolvedValue(() => {
    return undefined;
  }),
  startDragging: vi.fn().mockResolvedValue(undefined),
};

const windowService: WindowService = {
  openMainWindow: vi.fn().mockResolvedValue(undefined),
  controlBuddy: vi.fn().mockResolvedValue(undefined),
};

describe('ChatWorkspace', () => {
  it('lists models and streams a response into the assistant placeholder', async () => {
    const user = userEvent.setup();
    const streamChat = vi.fn((request, onEvent) => {
      onEvent({ type: 'started', requestId: request.requestId });
      onEvent({ type: 'content_delta', requestId: request.requestId, content: 'Local hello' });
      onEvent({ type: 'completed', requestId: request.requestId });
      return Promise.resolve();
    });
    const service: LocalAiService = {
      listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
      cancel: vi.fn().mockResolvedValue(undefined),
      streamChat,
    };
    render(
      <ChatWorkspace
        localAiService={service}
        companionService={companionService}
        windowService={windowService}
      />,
    );

    await screen.findByText('Ollama connected');
    const input = screen.getByRole('textbox', { name: 'Message' });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.type(input, 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('Local hello');
    expect(streamChat).toHaveBeenCalledOnce();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('prevents duplicate submission while a request is active', async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const streamChat = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const service: LocalAiService = {
      listModels: vi.fn().mockResolvedValue([{ name: 'qwen3:4b' }]),
      cancel: vi.fn().mockResolvedValue(undefined),
      streamChat,
    };
    render(
      <ChatWorkspace
        localAiService={service}
        companionService={companionService}
        windowService={windowService}
      />,
    );
    await screen.findByText('Ollama connected');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'One request');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('button', { name: 'Stop generation' })).toBeInTheDocument();
    expect(streamChat).toHaveBeenCalledOnce();
    if (release) {
      release();
    }
  });

  it('shows an offline state without exposing a raw error as the heading', async () => {
    const service: LocalAiService = {
      listModels: vi.fn().mockRejectedValue({
        code: 'ollama_not_running',
        userMessage: 'Ollama is not running.',
        technicalMessage: 'connection refused',
        retryable: true,
      }),
      streamChat: vi.fn(),
      cancel: vi.fn(),
    };
    render(
      <ChatWorkspace
        localAiService={service}
        companionService={companionService}
        windowService={windowService}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('Local AI is offline')).toBeInTheDocument();
    });
    expect(screen.getByText(/127.0.0.1:11434/)).toBeInTheDocument();
  });

  it('runs the Buddy Lab mock stream without Ollama or a selected model', async () => {
    const user = userEvent.setup();
    const streamChat = vi.fn();
    const service: LocalAiService = {
      listModels: vi.fn().mockRejectedValue({
        code: 'ollama_not_running',
        userMessage: 'Ollama is not running.',
        retryable: true,
      }),
      streamChat,
      cancel: vi.fn(),
    };
    render(
      <ChatWorkspace
        localAiService={service}
        companionService={companionService}
        windowService={windowService}
      />,
    );
    await screen.findByText('Local AI is offline');
    await user.click(screen.getByRole('button', { name: 'Mock stream' }));
    await screen.findByText('This is a local mock stream. No Ollama request was made.', undefined, {
      timeout: 2_000,
    });
    expect(streamChat).not.toHaveBeenCalled();
  });
});
