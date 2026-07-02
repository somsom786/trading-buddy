import { useLayoutEffect, useRef } from 'react';
import type { ChatMessage } from '../../domain/local-ai/types';

interface MessageListProps {
  messages: ChatMessage[];
  generating: boolean;
}

export function MessageList({ messages, generating }: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  useLayoutEffect(() => {
    const element = listRef.current;
    if (element && nearBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      className="message-list"
      ref={listRef}
      onScroll={(event) => {
        const element = event.currentTarget;
        nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
      }}
    >
      {messages.length === 0 ? (
        <div className="conversation-welcome">
          <span aria-hidden="true">◇</span>
          <h2>What’s on your mind?</h2>
          <p>
            Your transcript stays on this device. Messages and selected context are sent to DeepSeek
            through NVIDIA for inference.
          </p>
        </div>
      ) : (
        messages.map((message) => (
          <article
            key={message.id}
            className={`message message--${message.role} message--${message.status ?? 'live'}`}
          >
            <header>
              <div className="message__heading">
                <strong>{message.role === 'user' ? 'You' : 'Buddy'}</strong>
                {message.status && message.status !== 'completed' ? (
                  <span className="message-status" data-status={message.status}>
                    {message.status}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="copy-message"
                onClick={() => void navigator.clipboard.writeText(message.content)}
                disabled={!message.content}
              >
                Copy
              </button>
            </header>
            <p>{message.content || (generating ? 'Thinking…' : '')}</p>
            {message.statusNote ? (
              <p className="message__status-note">{message.statusNote}</p>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
