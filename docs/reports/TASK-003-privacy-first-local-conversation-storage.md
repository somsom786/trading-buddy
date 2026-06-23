# Task 3 Report - Privacy-First Local Conversation Storage

**Audience:** ChatGPT GPT-5.5 / future task author
**Project:** Trading Buddy - BETA v0.1
**Date:** June 23, 2026
**Status:** Automated implementation complete; real desktop manual verification still required.

## Summary

Task 3 established durable local conversation storage for Trading Buddy without adding cloud
services, accounts, crypto integrations, telemetry, autonomous trading, or browser-extension scope.

The implementation keeps SQLite ownership in Rust/Tauri and exposes only narrow typed commands to
React. The frontend does not execute raw SQL and does not use `localStorage` for conversation
content.

## What was implemented

- Rust-owned SQLite database named `trading-buddy.db` in Tauri's app-specific local data directory.
- Explicit migration v1 for:
  - `storage_metadata`
  - `conversations`
  - `messages`
  - `app_settings`
- SQLite configuration:
  - `foreign_keys = ON`
  - `journal_mode = WAL`
  - `busy_timeout = 5000`
  - `secure_delete = ON`
  - `synchronous = NORMAL`
- Repository/service architecture behind typed Tauri commands.
- Typed storage errors with user-safe messages and optional technical detail.
- Conversation list, loading state, empty state, storage error state, and active conversation title.
- New chat, conversation switching, rename, archive, restore, delete, and delete-all controls.
- Persistent selected model setting.
- Last-opened conversation restoration.
- Retention policies:
  - Keep until I delete
  - Delete after 30 days
  - Delete after 90 days
- Startup cleanup for retention policy.
- Startup recovery of abandoned `streaming` assistant messages to `interrupted`.
- Temporary chat mode that keeps messages in memory and does not create conversation/message rows.
- JSON export through a native save-file dialog.
- Documentation updates for architecture, decisions, README, MVP, product notes, and task tracking.

## Message persistence lifecycle

For persistent chats:

1. React validates input.
2. Rust prepares persistence before generation:
   - creates a conversation if needed;
   - saves the user message;
   - creates a streaming assistant placeholder;
   - updates latest activity and last-opened conversation.
3. Ollama generation starts only after the persistence preparation succeeds.
4. Visible assistant content is buffered in React.
5. Checkpoints are written after a character threshold or interval, not once per token.
6. Final visible content is stored on completion, cancellation, or failure.
7. Failed messages store typed error codes, not raw stack traces.
8. Hidden thinking chunks and system prompts are never stored as conversation messages.

## SQLite library decision

Selected `rusqlite` with bundled SQLite.

Reasoning:

- mature and widely used;
- simple fit for a local-first desktop database;
- easy to test with temporary/in-memory databases;
- no frontend database permission surface;
- avoids a separate backend server;
- avoids a Tauri SQL plugin that would expose broader database access to React.

The implementation uses `spawn_blocking` around synchronous database work so Tauri async commands do
not block the async runtime.

## Export

Export format:

```json
{
  "format": "trading-buddy-conversations",
  "version": 1,
  "exportedAt": "...",
  "conversations": []
}
```

Exports include visible user/assistant messages and omit:

- system prompts;
- hidden thinking;
- chain-of-thought;
- internal request IDs;
- database paths;
- secrets;
- Ollama internals;
- raw technical errors.

## Deletion and encryption limitations

The database is local but is not application-level encrypted. This is documented explicitly.

Delete-all clears conversations/messages, clears last-opened state, checkpoints the WAL, vacuums,
and uses SQLite `secure_delete = ON`. The docs do not promise forensic-grade deletion because SSD
behavior, OS caches, filesystem snapshots, and backups can retain historical data.

## Tests added

Rust tests cover:

- empty database initialization;
- migration rerun safety;
- schema version;
- foreign keys;
- required indexes;
- deterministic title derivation;
- conversation/message creation;
- assistant checkpoint, completion, cancellation, failure, and interrupted recovery;
- stale request rejection;
- archive, restore, permanent delete, and cascade message deletion;
- model preference and last-opened conversation;
- retention behavior;
- export structure and excluded internals;
- delete-all behavior.

Frontend tests cover:

- storage boundary validation;
- app settings validation;
- persisted conversation validation;
- rendering cancelled/failed/interrupted saved assistant messages;
- storage-backed streaming flow in the chat workspace.

## Verification run

Passed:

- `corepack pnpm check`
  - Prettier
  - ESLint
  - TypeScript
  - Vitest: 13 files, 46 tests
- `corepack pnpm build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml`: 31 tests
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `corepack pnpm tauri build --debug --no-bundle`
- `corepack pnpm tauri build --no-bundle`
- `git diff --check`

One transient debug build failed when run concurrently with the optimized build because Windows
locked the copied buddy concept image in `dist`. Rerunning the debug build by itself passed.

## Manual verification still required

Do not mark Task 3 fully complete until the live desktop app is manually checked for:

- several real Ollama messages;
- app close/restart persistence;
- second conversation creation and switching;
- rename;
- archive and restore;
- cancellation persistence;
- simulated interrupted streaming recovery;
- selected model restoration;
- temporary chat disappearance after restart;
- export dialog and JSON inspection;
- delete one conversation;
- delete all data;
- buddy and tray behavior regression checks.

`ollama list` was available and showed installed local models, so real-model manual verification is
possible on this machine.

## Known limitations

- No application-level database encryption yet.
- No import flow.
- No long-term memory, vector embeddings, journaling, trades, crypto integrations, auth, sync,
  telemetry, tool calling, or autonomous trading.
- Retention applies to active and archived conversations based on latest activity.
- Conversation switching during generation is prevented rather than auto-cancelling.

## Recommended Task 4

Run the full manual desktop verification checklist against a real local model, then polish the
storage UX based on actual use:

- smoother conversation-sidebar states;
- clearer temporary-chat affordance;
- export success affordance;
- storage failure recovery copy;
- manual QA evidence captured in the progress journal.
