# Architecture

## Shape

Trading Buddy is a single Tauri 2 desktop application with one React bundle and two native webview
windows.

```text
React views
  -> application logic
    -> service interfaces
      -> Tauri commands
        -> native window/tray/filesystem behavior
        -> Rust local-model service
          -> Ollama native API on loopback
```

## Frontend boundaries

- `views/` composes each window-level experience.
- `components/` contains reusable visual elements.
- `app/` contains application-level selection and coordination logic.
- `domain/` contains deterministic framework-independent rules and calculations.
- `services/` adapts UI needs to native or future external capabilities.

UI components should not own financial rules, persistence formats, or integration protocols.

## Local model provider

The Rust `local_ai` module defines the current provider boundary:

- `client.rs` owns the loopback-only Ollama HTTP client.
- `models.rs` defines command, provider, model, metric, and stream event structures.
- `errors.rs` maps failures to stable user-facing error codes.
- `stream.rs` incrementally parses newline-delimited Ollama JSON.
- `commands/local_ai.rs` exposes model listing, streaming chat, and cancellation.

Networking occurs in Rust so the webview receives no unrestricted network permission. Production
uses `http://127.0.0.1:11434`. A debug endpoint override is accepted only after validating that it
is an unauthenticated HTTP loopback URL with an explicit port.

Ollama is one implementation behind the local-model service boundary. A future provider can add a
client that produces the same model and stream event contracts without changing the conversation
reducer.

## Streaming lifecycle

The main window creates a unique request ID and a Tauri `Channel`, then invokes
`stream_local_chat`. Rust validates the request, enforces one active generation per conversation,
and streams `started`, content, hidden-thinking, completion, failure, or cancellation records over
that channel.

Ollama's response body is parsed incrementally. The parser preserves partial lines across network
reads, accepts multiple records in one chunk, ignores blank lines, rejects malformed records, and
requires a final `done` record. Cancellation tokens stop network stream processing and active
request guards remove completed or abandoned requests.

The frontend validates every channel payload before reducing it. Events with stale request IDs are
ignored, preventing late content from reaching a replaced or cancelled conversation.

## Conversation session

The conversation reducer owns messages, selected model, active request ID, status, typed error,
metrics, and whether separate thinking data was received. User and assistant placeholder messages
are created together when generation starts. Stream deltas append only to the active assistant
message.

Conversation data is intentionally memory-only for this milestone. Persistence is deferred until a
storage design can define retention, deletion, migrations, and privacy guarantees deliberately.

## Companion state and cross-window contracts

Buddy states are a closed TypeScript union. Input and generation lifecycle events map
deterministically to listening, thinking, talking, idle, concerned, or error states; model output
cannot choose arbitrary animations.

Cross-window messages use centralized event names and validated command/interaction payloads.
Window show, hide, and focus operations remain native commands. Event listeners return cleanup
functions and React effects remove them on unmount. Pointer movement must cross a drag threshold
before native window dragging starts, so dragging does not also open the main window.

## Native shell

Tauri creates:

- `main`: a normal resizable application window.
- `buddy`: a fixed-size transparent, undecorated, always-on-top window.

The native window manager handles tray actions, showing/focusing windows, and buddy position
persistence. Position data is a small JSON file in the operating system application config
directory; no cloud or database is involved. Closing the main window hides it instead of
destroying it, allowing the buddy and tray to reopen the existing session.

## Security posture

- Tauri capabilities are limited to the two declared windows and core defaults.
- The frontend invokes narrow application commands with validated labels, actions, IDs, model
  names, message counts, and content lengths.
- The only new plugin capability opens the exact official `https://ollama.com` URL.
- Ollama requests use Rust networking and never receive arbitrary remote URLs from the frontend.
- No secrets or financial credentials are accepted or stored.
- Future external inputs must be validated at service boundaries.

## Testing

Vitest and React Testing Library cover the reducer, validation, model selection, prompt boundaries,
buddy lifecycle, drag/click behavior, event payloads, listener cleanup, provider states, and mock
stream interaction. Rust tests cover endpoint and model validation, model-list parsing, error
mapping, cancellation, position serialization, and incremental NDJSON parsing. Platform window,
tray, and WebView behavior still require native smoke tests.
