import { openUrl } from '@tauri-apps/plugin-opener';
import { LOCAL_AI_CONFIG } from '../../domain/local-ai/config';
import type { LocalAiStatus } from '../../domain/local-ai/types';

interface LocalAiStatusPanelProps {
  status: LocalAiStatus;
  onRetry: () => void;
}

export function LocalAiStatusPanel({ status, onRetry }: LocalAiStatusPanelProps) {
  if (status.status === 'checking') {
    return (
      <section className="local-ai-panel local-ai-panel--checking">Checking local AI…</section>
    );
  }

  if (status.status === 'connected') {
    return (
      <section className="local-ai-panel local-ai-panel--connected">
        <span className="connection-dot" aria-hidden="true" />
        <strong>Ollama connected</strong>
        <span>{status.models.length} local model(s)</span>
        <button type="button" className="text-button" onClick={onRetry}>
          Refresh
        </button>
      </section>
    );
  }

  if (status.status === 'ollama_not_running') {
    return (
      <section className="setup-panel">
        <h2>Local AI is offline</h2>
        <p>Trading Buddy uses a local AI model through Ollama.</p>
        <p>
          Ollama could not be reached at {LOCAL_AI_CONFIG.ollamaEndpointLabel}. Install or start
          Ollama, then try again.
        </p>
        <div className="button-row">
          <button type="button" onClick={onRetry}>
            Retry connection
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void openUrl(LOCAL_AI_CONFIG.ollamaWebsite)}
          >
            Open Ollama website
          </button>
        </div>
      </section>
    );
  }

  if (status.status === 'no_models') {
    const command = `ollama pull ${LOCAL_AI_CONFIG.recommendedModel}`;
    return (
      <section className="setup-panel">
        <h2>A local model is required</h2>
        <p>Ollama is running, but it has no installed models. Install one in your terminal:</p>
        <div className="copy-command">
          <code>{command}</code>
          <button type="button" onClick={() => void navigator.clipboard.writeText(command)}>
            Copy
          </button>
        </div>
        <button type="button" onClick={onRetry}>
          Check again
        </button>
      </section>
    );
  }

  return (
    <section className="setup-panel setup-panel--error">
      <h2>Local AI needs attention</h2>
      <p>{status.error.userMessage}</p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
      {import.meta.env.DEV && status.error.technicalMessage ? (
        <details>
          <summary>Technical details</summary>
          <pre>{status.error.technicalMessage}</pre>
        </details>
      ) : null}
    </section>
  );
}
