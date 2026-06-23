# Task 4 Manual QA Plan

**Date:** June 23, 2026  
**Scope:** Desktop QA, storage UX hardening, and release-readiness checks for Trading Buddy BETA
v0.1.

## Baseline before implementation

- Git branch: `main`
- Working tree: clean before Task 4 inspection.
- Automated baseline:
  - `corepack pnpm check` passed.
  - `corepack pnpm build` passed.
  - `cargo test --manifest-path src-tauri/Cargo.toml` passed.
  - `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
    passed.
  - `corepack pnpm tauri build --debug --no-bundle` passed.
  - `corepack pnpm tauri build --no-bundle` passed.
- Pre-existing automated failures: none observed.

## Ground rules

- Use a real locally installed Ollama model for primary chat verification.
- Do not add long-term memory, journaling, crypto integrations, authentication, cloud sync,
  analytics, telemetry, tool calling, voice, or autonomous trading.
- Do not store private keys, seed phrases, exchange credentials, or private financial secrets in QA
  messages.
- Use only safe, reversible storage fixtures for interrupted-message, retention, performance, and
  database-statistics checks.
- Do not modify the real user database through raw SQL without creating a documented backup first.
- Do not claim a manual scenario passed unless it was performed against the real desktop app.

## Manual desktop scenarios

1. Basic persistent conversation
   - Launch the real app.
   - Send at least three messages.
   - Close/reopen main from buddy.
   - Fully quit/relaunch.
   - Verify message order, no duplicates, no empty assistant placeholders, selected conversation,
     and last-opened state.

2. Multiple conversations
   - Create two or more conversations.
   - Send messages in each.
   - Switch between them.
   - Restart and verify ordering by latest activity and last-opened restoration.

3. Rename
   - Verify valid rename persistence across restart.
   - Try empty, whitespace-only, long, emoji, Unicode, and duplicate titles.
   - Confirm invalid values are rejected safely.

4. Archive and restore
   - Archive, inspect active/archived lists, restart, restore, and verify persistence.

5. Cancellation persistence
   - Start a long real generation.
   - Stop after partial content appears.
   - Restart and verify partial cancelled response remains and conversation is still usable.

6. Interrupted-generation recovery
   - Use a safe fixture or development command to create a `streaming` assistant message.
   - Restart app and verify it becomes `interrupted`, keeps checkpointed visible content, and is not
     treated as active generation.

7. Model restoration and fallback
   - Select an installed model and restart.
   - Use a safe fixture to store a missing model and verify fallback selection.

8. Temporary chat
   - Enter temporary mode.
   - Send real Ollama messages.
   - Verify no persistent row/list item is created.
   - Restart and verify temporary messages are gone while saved conversations remain.

9. Export
   - Export through the native save dialog.
   - Inspect UTF-8 JSON for expected format/version/content and excluded internals.
   - Cancel save dialog and verify normal handling.
   - Safely trigger/export failure if possible and verify typed error UX.

10. Delete one conversation
    - Delete inactive and active conversations.
    - Restart and inspect cascade deletion through safe database/statistics tooling.

11. Delete all conversation data
    - Create several conversations.
    - Trigger delete-all with confirmation.
    - Restart and verify clean state, valid database, cleared last-opened state, and preserved
      non-conversation settings as intended.

12. Retention
    - Use safe fixture timestamps/test data.
    - Verify keep-until-delete, 30-day, and 90-day boundaries, archived handling, startup cleanup,
      policy-change cleanup, and cleanup count feedback.

13. Buddy/window/tray regression
    - Verify buddy launch, position persistence, close-main/reopen-from-buddy, dragging, tray menu
      actions where accessible, buddy state changes, cancellation/provider-failure state, and clean
      shutdown.

14. Performance and accessibility spot checks
    - Use generated safe test data with at least 100 conversations, one 500-message conversation,
      and long Unicode content.
    - Confirm list queries remain bounded, large conversation loading is usable, keyboard
      conversation selection works, status/error states are not color-only, and storage errors are
      announced.

## Evidence to record

For each scenario:

- Date/time.
- Build identifier or commit.
- Scenario tested.
- Result.
- Issue discovered, if any.
- Root cause.
- Fix applied.
- Retest result.

Do not include private conversation contents in the QA journal.
