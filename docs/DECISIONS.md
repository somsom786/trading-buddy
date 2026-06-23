# Decisions

## 001 — One frontend bundle, two native windows

**Status:** Accepted

Both windows load the same Vite output and select a view using `?view=main` or `?view=buddy`. This
avoids duplicate build pipelines while preserving native window behavior.

## 002 — Native ownership of window lifecycle

**Status:** Accepted

Rust owns window opening, focusing, tray actions, and buddy position persistence. React calls a
narrow command rather than depending directly on Tauri window APIs throughout the component tree.

## 003 — JSON position persistence without a plugin

**Status:** Accepted

The buddy position is a two-integer JSON document in the application config directory. A storage
plugin would add dependency and permission surface without meaningful value for this small datum.

## 004 — No client-side router in the foundation

**Status:** Accepted

The main workspace currently contains placeholder navigation only. Query-based view selection is
enough for two windows, and avoiding a router keeps the initial dependency surface small.

## 005 — CSS pixel-art placeholder

**Status:** Accepted

The buddy graphic is composed with CSS so the foundation has no external art license or asset
pipeline. It can be replaced by a designed local asset later.

## 006 — Strict tooling from the first commit

**Status:** Accepted

TypeScript strictness, type-aware ESLint, Prettier, Vitest, React Testing Library, and Rust tests are
configured before domain features are introduced.

## 007 — Desktop-first local inference

**Status:** Accepted

Local inference is a core privacy requirement, so the desktop application is the primary product
surface rather than a browser-only client.

## 008 — Ollama native API

**Status:** Accepted

The application uses Ollama's native `/api/tags` and `/api/chat` endpoints rather than a paid cloud
provider or the OpenAI compatibility API. This preserves Ollama-specific streaming fields and
requires no account or token.

## 009 — Rust-side, loopback-only networking

**Status:** Accepted

Ollama networking lives in Rust. The frontend has no unrestricted HTTP capability. Endpoints must
be unauthenticated HTTP loopback URLs with explicit ports, and production is fixed to
`127.0.0.1:11434`.

## 010 — Streaming conversation

**Status:** Accepted

Responses stream through a per-request Tauri channel. Incremental output makes small local models
feel responsive and provides a natural cancellation boundary.

## 011 — Session-only conversation storage

**Status:** Accepted

Messages remain in memory for this milestone. Persistent storage is deferred until retention,
deletion, and migration behavior can be designed explicitly.

## 012 — Deterministic buddy states

**Status:** Accepted

Application lifecycle events select buddy states from a closed union. The model cannot invent or
direct animation names.

## 013 — Manual Ollama and model installation

**Status:** Accepted

Trading Buddy does not start Ollama, execute setup commands, or download models. The interface
provides instructions and a copyable example only.

## 014 — No tool calling

**Status:** Accepted

The local model receives conversation messages only. It cannot invoke application commands,
execute shell actions, trade, browse, or access integrations.

## 015 — Narrow official-site opener capability

**Status:** Accepted

The opener plugin is included solely to open the exact official Ollama website in the default
browser. Arbitrary URL and filesystem opening are not permitted.

## 016 — Rust-owned SQLite conversation storage

**Status:** Accepted

Conversation data is stored in SQLite through Rust repository code using `rusqlite` with bundled
SQLite. React calls typed Tauri commands and never receives raw SQL access. SQLite is mature,
local-first, easy to test with temporary databases, and sufficient for durable conversations,
settings, retention, and export without running a separate backend server.

## 017 — No raw SQL exposed to React

**Status:** Accepted

The frontend receives specific commands for conversations, messages, settings, retention, export,
and deletion. A generic SQL command would make validation, permissions, migrations, and privacy
guarantees much harder to reason about.

## 018 — Local conversation content by default

**Status:** Accepted

Saved conversations remain on the user's device in Tauri's app-local data directory. This supports
the local-first product boundary and avoids cloud accounts, telemetry, remote databases, and cloud
backups.

## 019 — Application-level encryption deferred

**Status:** Accepted

The SQLite database is not claimed to be encrypted. Correct application-level encryption needs key
management, recovery behavior, migration testing, export implications, and clear UX. Until that is
implemented and verified, documentation states the limitation and points users to operating-system
disk encryption as a separate layer.

## 020 — Hidden thinking is never persisted

**Status:** Accepted

Ollama thinking chunks are treated as non-visible provider metadata. They are not rendered as chat
messages, not checkpointed, and not exported. The same boundary applies to system prompts and future
model-internal reasoning.

## 021 — Deterministic local conversation titles

**Status:** Accepted

Initial titles are derived from the first user message by normalizing whitespace and applying a
bounded length. The LLM is not called for title generation, which keeps startup fast, predictable,
private, and testable.

## 022 — Checkpoint assistant content instead of token-level writes

**Status:** Accepted

Streaming output is buffered and checkpointed after a character threshold or short interval, then
finalized on completion, cancellation, or failure. This avoids excessive disk writes while
preserving most visible generated content if the application exits unexpectedly.

## 023 — Temporary chats are explicit

**Status:** Accepted

Temporary chat is off by default and visibly labeled when enabled. It uses the same local model
pipeline but does not create conversation/message rows. Switching modes starts a new session rather
than silently converting private temporary content into saved history.

## 024 — Retention defaults to keep-until-delete

**Status:** Accepted

The default policy is `Keep until I delete`. Automatic 30-day and 90-day cleanup are available, run
from Rust, and use UTC latest activity timestamps. Archived conversations are also subject to the
selected retention policy.

## 025 — Honest deletion limitations

**Status:** Accepted

Delete-all clears conversation rows, clears last-opened state, checkpoints the WAL, vacuums, and
uses SQLite `secure_delete = ON`. The product still does not promise forensic erasure because SSD
wear leveling, OS caches, backups, filesystem snapshots, and external tools can retain data.

## 026 — Native save dialog for export

**Status:** Accepted

Conversation export uses a native save-file dialog via `rfd` so the frontend never supplies
arbitrary filesystem paths. The extra dependency is limited to user-selected local file export;
alternatives were delaying export or exposing a path-taking command, which would weaken the current
security boundary.
