# Data Migration Plan

No automatic user-data migration is implemented in Task 12. This is the implemented migration
strategy for the reformation preview: isolate the Hermes/Petdex runtime so the preserved Tauri
application and its local data are never modified by preview launches.

## Current state

- The existing Tauri application owns its local SQLite data.
- The Hermes vertical slice uses an isolated `HERMES_HOME` and Hermes session storage.
- The Task 12 launcher creates a separate `%LOCALAPPDATA%\TradingBuddy` runtime profile.
- Preview startup does not read, transform, or write the Tauri SQLite database.
- Existing Tauri data migration is deferred until the Hermes runtime proves product parity.

## Task 12 decision

**Decision:** no automatic migration in the Hermes/Petdex preview.

**Implementation:** isolated runtime paths and documentation. Users can run the preview without
touching the preserved Tauri app state. Future migration must be explicit, reversible, previewed by
a dry-run report, and gated by user action.

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
