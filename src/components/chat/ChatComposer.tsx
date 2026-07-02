import type { KeyboardEvent } from 'react';

interface ChatComposerProps {
  input: string;
  maxLength: number;
  canSend: boolean;
  generating: boolean;
  onInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onClear: () => void;
}

export function ChatComposer({
  input,
  maxLength,
  canSend,
  generating,
  onInput,
  onSend,
  onStop,
  onClear,
}: ChatComposerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };

  return (
    <div className="composer">
      <textarea
        value={input}
        maxLength={maxLength}
        rows={3}
        placeholder="Talk to your companion…"
        aria-label="Message"
        onChange={(event) => {
          onInput(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <div className="composer__footer">
        <span>
          {input.length}/{maxLength}
        </span>
        <div className="button-row">
          <button type="button" className="text-button" onClick={onClear}>
            Clear session
          </button>
          {generating ? (
            <button type="button" className="stop-button" onClick={onStop}>
              Stop generation
            </button>
          ) : (
            <button type="button" onClick={onSend} disabled={!canSend}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
