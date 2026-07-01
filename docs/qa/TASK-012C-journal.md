# Task 12C QA Journal — Canonical shared session bridge

Date started: 2026-07-01

## S1 — Baseline and ownership audit

### Repository state

- `main` was clean at Trading Buddy commit `f7f111a`.
- `next/agent` was clean at Hermes fork commit `87bb63c`.
- Work continues on `codex/task-12c-shared-session`.

### Ownership findings

- `BubbleView.tsx` and `ChatWorkspace.tsx` independently own local provider checks, transcript
  reducers, generation submission, stream handling, cancellation, assistant persistence, memory
  retrieval, continuity retrieval, and post-turn work.
- Rust SQLite already provides the correct authoritative prepare/checkpoint/complete/cancel/fail
  lifecycle for persistent visible messages.
- Existing deterministic trading execution refusals and journal intents run before local model
  submission and must remain outside Hermes.
- Existing memory and continuity retrieval are bounded locally and must be passed as hidden context,
  not merged into visible user text.

### Verified Hermes protocol

The official programmatic-integration documentation and fork source agree:

- Entry point: `python -m tui_gateway.entry`
- Transport: newline-delimited JSON-RPC 2.0 over stdio
- Ready event: `event` with type `gateway.ready`
- Required methods present:
  - `session.create`
  - `session.resume`
  - `session.list`
  - `session.history`
  - `session.status`
  - `prompt.submit`
  - `session.interrupt`
  - `session.close`
- Relevant events present:
  - `message.start`
  - `message.delta`
  - `message.complete`
  - `error`
- `prompt.submit` already accepts the strict Trading Buddy support modes and persists clean user text
  when a mode is supplied.

### Protocol gaps before implementation

- No Trading Buddy prompt idempotency key exists.
- No explicit ephemeral-session option guarantees that temporary chats avoid Hermes durable state.
- `session.close` closes a live process-local session but does not itself document deletion of the
  stored Hermes transcript.
- Gateway methods outside the companion allowlist exist and therefore must never be forwarded by
  the Rust adapter.
- Gateway `message.complete` may contain reasoning, rendered output, and usage; the adapter must
  retain visible text/status only.

### Baseline commands

```powershell
corepack pnpm format
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm next:check
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
next\agent\venv\Scripts\python.exe -m pytest -q `
  next\agent\tests\test_trading_buddy_support_modes.py `
  next\agent\tests\test_tui_gateway_server.py
corepack pnpm tauri build --debug
corepack pnpm tauri build --no-bundle
```

### Baseline results

- `format`: completed, but rewrote 66 otherwise unchanged tracked files because this Windows clone
  uses `core.autocrlf=true` and the repository had no explicit Prettier EOL policy. Those
  formatter-only worktree rewrites were removed. `endOfLine: auto` was added so future checks are
  deterministic without a mass line-ending commit.
- Initial `format:check`: failed on those same 66 pre-existing CRLF/LF differences. No semantic
  formatting defect was reported.
- ESLint: passed with zero warnings.
- Strict TypeScript: passed.
- Vitest: 47 files, 175 tests passed.
- Frontend production build: passed.
- Petdex pack validation: 3 tests passed.
- Rust formatting: passed.
- Rust tests: 89 passed.
- Rust clippy: passed with warnings denied.
- Hermes focused gateway/support suite: 311 tests passed.
- Tauri debug build: passed and produced MSI/NSIS bundles.
- Tauri release no-bundle build: passed.

## S2 — Shared session domain and Rust runtime

### Implemented

- Added a framework-independent TypeScript session contract with bounded runtime validators.
- Added deterministic stream reduction with stale-request rejection, duplicate rejection, terminal
  idempotency, bounded assistant accumulation, support-mode validation, and retry-source selection.
- Added a Tauri agent-session service and hook that mirror the Rust-authoritative snapshot.
- Added schema v11:
  - one `agent_session_links` row per local persistent conversation;
  - unique remote session key;
  - cascading deletion with the local conversation;
  - local `agent_turn_attempts` ownership fields reserved for S4 idempotent persistence.
- Added Rust snapshot/status types and one process-wide `AgentSessionRuntime`.

### Focused verification

- TypeScript: passed.
- Frontend tests: 49 files, 181 tests passed; five new domain tests and one hook test.
- Rust: 94 tests passed before the real process smoke.
- Clippy: passed with warnings denied after integrating the cleanup path.

## S3 — Hermes stdio JSON-RPC process integration

### Implemented

- Added the official `python -m tui_gateway.entry` launcher.
- Located only the project-pinned `next/agent/venv` environment and submodule.
- Added isolated app-local Hermes runtime data and a companion-safe no-tools configuration.
- Added hidden Windows process creation, piped stdin/stdout/stderr, kill-on-drop, explicit shutdown,
  protocol-only stdout parsing, bounded requests, bounded lines, and sanitized stderr diagnostics.
- Added a closed Rust `HermesMethod` enum. React cannot submit arbitrary gateway methods.
- Added lazy session create/resume mapping and persistent local conversation links.
- Added start/status/open/support-mode/interrupt/close/retry/stop Tauri commands.

### Real gateway verification

`cargo test ... launches_one_real_gateway_handshakes_and_shuts_it_down -- --nocapture` passed:

- one pinned Python gateway started;
- `gateway.ready` arrived over stdio;
- a second start reused the same process ID;
- `session.create` returned a real session;
- `session.close` succeeded;
- shutdown left no Python process containing `tui_gateway.entry`.

Automatic bounded crash restart, ordered prompt streaming, and user-visible integration remain S4–S7
work and are not claimed here.
