# Task 4 QA Journal

**Date:** June 23, 2026  
**Scope:** Desktop QA, storage UX hardening, and release-readiness checks for Trading Buddy BETA
v0.1.

## Baseline validation before changes

All baseline checks passed before Task 4 implementation:

- `corepack pnpm check`
- `corepack pnpm build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `corepack pnpm tauri build --debug --no-bundle`
- `corepack pnpm tauri build --no-bundle`

No pre-existing automated failures were observed.

## Real desktop smoke evidence

- Verified `ollama list` worked locally. Installed models included `qwen3:8b`, `qwen3.5:9b`, and
  `llama3.1:8b`; the previously recommended `qwen3:4b` was not installed.
- Launched the debug Tauri desktop executable.
- Confirmed a running `trading-buddy.exe` process with the main window title
  `Trading Buddy — BETA v0.1`.
- Confirmed the app created its local SQLite files under
  `C:\Users\raynh\AppData\Local\com.tradingbuddy.desktop`:
  - `trading-buddy.db`
  - `trading-buddy.db-shm`
  - `trading-buddy.db-wal`
- Stopped the debug process after the smoke check.

## Automation limitations

Windows UI Automation did not expose reliable WebView controls for the React UI, and screenshot
capture returned unreliable desktop/Alt-Tab imagery during this session. Because of that, this
journal does not claim the full manual desktop checklist passed. The full checklist remains in
[`TASK-004-manual-qa-plan.md`](TASK-004-manual-qa-plan.md) for direct user-visible verification.

Tray overflow interactions also remain pending because they were not reliably controllable from the
available automation.

## Issues found and hardening applied

### Export feedback exposed too much path detail

- **Issue:** Successful export feedback displayed the full filesystem path.
- **Fix:** Native export still writes to the selected path, but the UI reports only the filename.
- **Tests:** Added React test coverage for filename-only export feedback.

### Temporary chat needed clearer exit/transition UX

- **Issue:** Temporary mode existed, but the not-saved state and exit path needed to be more
  unmistakable.
- **Fix:** Added visible not-saved labeling, explanatory text, exit action, and confirmation before
  discarding temporary messages during transitions.
- **Tests:** Added React coverage proving temporary chat bypasses persistent storage.

### Non-completed assistant statuses were mixed into content

- **Issue:** Cancelled, failed, and interrupted states were represented by decorating message
  content.
- **Fix:** Kept stored content raw and moved status explanation into separate message metadata/UI.
- **Tests:** Updated storage type tests to assert raw content plus separate status notes.

### Storage diagnostics were too thin for QA

- **Issue:** QA needed safe visibility into schema, counts, retention cleanup, and interrupted
  recovery state without raw SQL or full private paths.
- **Fix:** Added `get_storage_diagnostics`, safe app-local summaries, and development-only Storage
  Lab controls.
- **Tests:** Added frontend display-helper tests and Rust repository diagnostics tests.

### Interrupted-generation recovery needed a safe fixture

- **Issue:** Recovery was tested in Rust, but desktop QA needed a safe way to create a streaming
  message without raw SQL.
- **Fix:** Added a debug-only interrupted-generation fixture command and Storage Lab trigger.
- **Tests:** Added Rust coverage that the fixture becomes `interrupted` on recovery while retaining
  checkpointed visible content.

## Verification after changes

Completed so far:

- `corepack pnpm format`
- `corepack pnpm test` - 14 files, 52 tests passed
- `cargo test --manifest-path src-tauri/Cargo.toml` - 33 tests passed

Full final verification is recorded in the Task 4 report after all checks complete.

## Still unverified manually

- Three-message real persistent chat across quit/relaunch.
- Native save-dialog export content inspection.
- Delete-one and delete-all behavior against the real app database.
- Tray menu click-through for Open Buddy, Open Main Window, and Quit.
- Full accessibility/performance spot checks with large generated data.
