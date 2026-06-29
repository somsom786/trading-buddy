# Data Migration Plan

No automatic user-data migration is implemented in Task 12.

## Current state

- The existing Tauri application owns its local SQLite data.
- The Hermes vertical slice uses an isolated `HERMES_HOME` and Hermes session storage.
- The Task 12 launcher creates a separate `%LOCALAPPDATA%\TradingBuddy` runtime profile.

## Migration principles

- Migrations must be explicit and reversible.
- User data must remain local.
- Transcript, memory, journal, and read-only trading data must keep source/provenance metadata.
- Model output must not be allowed to rewrite durable state without validation and user-visible
  intent.
- Secrets and wallet material must not be imported, exported, requested, logged, or persisted.

## Future migration work

- Map existing Tauri conversations to Hermes session records.
- Map confirmed memories to a constrained, user-reviewable memory format.
- Map journal entries to a durable local Hermes-compatible package or preserve them in a
  Trading-Buddy-owned local database.
- Preserve read-only trading data only as read-only facts with timestamps and source labels.
- Provide a dry-run report before writing migrated data.
