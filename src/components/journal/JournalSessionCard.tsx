import type { JournalPrompt } from '../../domain/journal/flows';
import type { JournalSession, JournalSupportMode } from '../../domain/journal/types';

interface JournalSessionCardProps {
  session: JournalSession;
  currentPrompt: JournalPrompt | null;
  onBodyChange: (body: string) => void;
  onAppend: () => void;
  onNextPrompt: () => void;
  onSwitchToFreeWrite: () => void;
  onSupportModeChange: (mode: JournalSupportMode) => void;
  onRatingChange: (
    field: 'mood' | 'energy' | 'stress' | 'confidence',
    value: number | null,
  ) => void;
  onSaveDraft: () => void;
  onSaveComplete: () => void;
  onDiscard: () => void;
}

export function JournalSessionCard({
  session,
  currentPrompt,
  onBodyChange,
  onAppend,
  onNextPrompt,
  onSwitchToFreeWrite,
  onSupportModeChange,
  onRatingChange,
  onSaveDraft,
  onSaveComplete,
  onDiscard,
}: JournalSessionCardProps) {
  return (
    <section className="journal-session-card" aria-label="Journal session">
      <p className="eyebrow">Buddy is journaling with you</p>
      {currentPrompt && session.mode !== 'free_write' ? (
        <blockquote>{currentPrompt.text}</blockquote>
      ) : (
        <blockquote>Free write. I’ll keep it local until you choose what to save.</blockquote>
      )}

      <label className="field">
        Journal text
        <textarea
          value={session.draftBody}
          onChange={(event) => {
            onBodyChange(event.currentTarget.value);
          }}
          rows={6}
          placeholder="Type what you want to capture…"
        />
      </label>

      <div className="journal-mode-row" role="group" aria-label="Support mode">
        {(['listen', 'reflect', 'plan'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={
              session.supportMode === mode ? 'secondary-button active' : 'secondary-button'
            }
            onClick={() => {
              onSupportModeChange(mode);
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="journal-ratings" aria-label="Optional ratings">
        {(['mood', 'energy', 'stress', 'confidence'] as const).map((field) => (
          <label key={field}>
            {field}
            <select
              value={String(session[field] ?? '')}
              onChange={(event) => {
                const value = event.currentTarget.value;
                onRatingChange(field, value ? Number(value) : null);
              }}
            >
              <option value="">optional</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
        ))}
      </div>

      <p className="muted">{session.draftBody.length.toLocaleString()} characters · local draft</p>

      <div className="button-row">
        {session.mode !== 'free_write' ? (
          <>
            <button type="button" onClick={onAppend}>
              Continue
            </button>
            <button type="button" className="secondary-button" onClick={onNextPrompt}>
              Skip
            </button>
            <button type="button" className="secondary-button" onClick={onSwitchToFreeWrite}>
              Free write
            </button>
          </>
        ) : null}
        <button type="button" className="secondary-button" onClick={onSaveDraft}>
          Save draft
        </button>
        <button type="button" onClick={onSaveComplete}>
          Save entry
        </button>
        <button type="button" className="stop-button" onClick={onDiscard}>
          Discard
        </button>
      </div>

      {session.lastError ? <p className="error-text">{session.lastError}</p> : null}
    </section>
  );
}
