# Tasks

## Foundation

- [x] Scaffold Tauri 2, React, TypeScript, and Vite.
- [x] Configure pnpm and quality tooling.
- [x] Add buddy and main windows.
- [x] Add tray actions.
- [x] Persist buddy position locally.
- [x] Add foundation tests and documentation.

## BETA v0.1 identity and progress journal

- [x] Label the in-development desktop project BETA v0.1.
- [x] Add the current buddy concept board as a non-production design reference.
- [x] Surface the concept board in the development-only Buddy Lab.
- [x] Create a chronological project progress journal.
- [ ] Convert the approved buddy direction into original production sprite sheets.

## Task 2 — First Living Local Companion

- [x] Preserve existing Tauri windows, tray, focus behavior, and buddy position persistence.
- [x] Detect local Ollama through a Rust-side loopback client.
- [x] List and select locally installed models.
- [x] Prefer the centrally configured `qwen3:4b` model when installed.
- [x] Stream native Ollama chat responses through a Tauri channel.
- [x] Parse partial, multiple, blank, malformed, and final NDJSON records safely.
- [x] Add typed errors, request validation, timeouts, and cancellation.
- [x] Keep conversation state session-only.
- [x] Add deterministic buddy lifecycle states and reduced-motion CSS.
- [x] Add centralized validated cross-window contracts.
- [x] Prevent buddy dragging from opening the main window.
- [x] Add development-only Buddy Lab and mock streaming.
- [x] Add frontend and Rust tests for domain and integration boundaries.
- [x] Verify real Qwen inference and cancellation against a running local Ollama instance.
- [x] Verify closing the main window keeps the buddy alive and the buddy reopens main.
- [x] Re-verify buddy position persistence after Task 2 native changes.
- [ ] Manually click all tray items after Task 2 changes.

Task 2 implementation and automated checks are complete. Native inference, cancellation,
close/reopen behavior, tray-icon presence, and position persistence were verified on Windows. The
three tray menu items still require a direct manual click-through because desktop automation could
not reliably activate the overflow menu.

## Task 3 — Privacy-First Local Conversation Storage

- [x] Add Rust-owned SQLite storage in the app-specific local data directory.
- [x] Add explicit schema migration v1 for metadata, conversations, messages, and app settings.
- [x] Keep raw SQL behind Rust repository functions and typed Tauri commands.
- [x] Persist selected local model, retention policy, and last opened conversation.
- [x] Persist user messages before generation starts.
- [x] Create streaming assistant messages before Ollama generation starts.
- [x] Checkpoint visible assistant content without writing once per token.
- [x] Mark assistant messages completed, cancelled, failed, or interrupted.
- [x] Recover startup `streaming` messages as `interrupted`.
- [x] Add conversation list, loading/empty/error states, new chat, switching, rename, archive,
      restore, delete, and delete-all controls.
- [x] Add explicit temporary chat mode that does not create conversation or message records.
- [x] Add retention policies: keep until delete, delete after 30 days, delete after 90 days.
- [x] Add versioned local JSON export through a native save-file dialog.
- [x] Document that SQLite is local but not application-level encrypted yet.
- [x] Document deletion limitations honestly.
- [x] Add Rust tests for migration, repository, lifecycle, retention, export, cascade deletion, and
      stale request rejection.
- [x] Add frontend tests for storage boundary validation, message decoration, and storage-backed
      chat streaming.
- [ ] Manually verify persistence with a real running Ollama model after this change.
- [ ] Manually verify native save dialog export content.
- [ ] Manually verify delete-all against the real app-local database.
- [ ] Manually re-click tray menu items.

Unresolved limitations:

- The local SQLite database is not application-level encrypted.
- Retention cleanup uses latest conversation activity and does not yet expose per-conversation
  exemptions.
- Only export is implemented; import is deliberately out of scope.
- Journal, memory, trading, crypto integrations, authentication, sync, and autonomous trading remain
  out of scope.

## Task 4 - Desktop QA, Storage UX Hardening, and Release Readiness

- [x] Create a manual desktop QA plan before implementation.
- [x] Run baseline automated validation before hardening changes.
- [x] Smoke-launch the real desktop app and verify the app-local SQLite database is created.
- [x] Add storage diagnostics for schema version, safe database summary, conversation counts,
      message counts, and last retention cleanup.
- [x] Add development-only Storage Lab controls for diagnostics, retention cleanup, and
      interrupted-generation recovery fixtures.
- [x] Harden temporary chat UX with explicit not-saved labeling and exit/transition confirmation.
- [x] Report export success by filename rather than full private path.
- [x] Keep non-completed assistant status metadata separate from stored message content.
- [x] Add frontend tests for storage display helpers, temporary chat persistence behavior, and
      filename-only export feedback.
- [x] Add Rust tests for diagnostics and interrupted-generation recovery fixtures.
- [ ] Complete the full manual desktop QA checklist with direct user-visible interaction.
- [ ] Manually click all tray menu items.
- [ ] Manually verify native save-dialog export content in the real desktop app.

Task 4 automated checks and release-readiness hardening are complete. The real desktop smoke test
verified launch and database creation, but the full desktop checklist remains partially unverified
because WebView content and tray overflow interactions were not reliably controllable through the
available automation.

## Next — requires separate product approval

- [ ] Design a local persistence schema for journal and settings data.
- [ ] Add navigation state and empty feature routes.
- [ ] Define validated domain types for journal entries and reviews.
- [ ] Create threat models for read-only exchange integrations.
- [ ] Evaluate an optional model boundary with strict structured-output validation.
- [ ] Add accessibility and multi-monitor window behavior testing.

The unchecked items are planning notes, not authorization to implement integrations or model
features.
