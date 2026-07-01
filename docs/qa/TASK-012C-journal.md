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

## S4 — Ordered stream and idempotent persistence

### Implemented

- Added one Rust-owned submit path that validates clean user text, request/turn identifiers, model
  names, support mode, temporary mode, and bounded hidden companion context.
- Added transactional local persistence for one user message, one assistant placeholder, and one
  `agent_turn_attempts` record per request ID. Repeated preparation with the same request ID returns
  the original records.
- Added Rust-assigned monotonic stream sequences and closed lifecycle events for accepted,
  listening, thinking, visible content deltas, completed, cancelled, failed, and connection lost.
- Broadcast transcript snapshots and stream content only to `bubble` and `main`; the buddy receives
  only a narrow visual-state command.
- Added bounded delta checkpointing and terminal persistence into the existing assistant
  placeholder. Stale request events and repeated terminal events are ignored and counted.
- Extended the forked gateway with:
  - strict `client_request_id` validation and live-session deduplication;
  - Trading Buddy ephemeral sessions with gateway and agent transcript persistence disabled;
  - a narrow Trading Buddy runtime-session deletion method;
  - bounded hidden `companion_context` separate from visible user text;
  - clean visible user-message persistence when support metadata or context wraps the model prompt;
  - Trading Buddy generic Hermes memory disabled to avoid a competing memory authority.

### Focused verification

- Strict TypeScript: passed.
- Rust tests: 96 passed, including idempotent turn preparation and real gateway lifecycle smoke.
- Rust clippy with warnings denied: passed.
- Hermes focused gateway/support suite: 315 passed.
- `git diff --check`: passed; Git reported only the clone's expected LF-to-CRLF warnings.

### Checkpoint boundary

The runtime and fork protocol are ready for frontend adoption. Bubble and Companion Home still use
their legacy generation owners, so shared live rendering, Stop/Retry/Copy, reconnect restoration,
privacy synchronization, and the Windows walkthrough remain unclaimed S5–S9 work.

## S5 — Bubble and Home shared live session

### Implemented

- Real Bubble and Companion Home sends now call `agent_session_submit`; neither surface directly
  calls the legacy Ollama stream for user conversation.
- Both windows subscribe to the same process-wide Rust snapshot and ordered stream.
- Both render the same Rust-authoritative local transcript, including a live assistant placeholder.
- Opening a saved conversation lazily creates/resumes one mapped gateway session and restores its
  SQLite transcript. Repeated Bubble/Home opens of the same conversation are idempotent.
- Existing deterministic journal and execution-refusal paths remain ahead of the agent call.
- Existing bounded read-only trading, memory, identity, and continuity material is passed as hidden
  companion context rather than pasted into visible user text.

## S6 — Support modes, Stop, Retry, and Copy

### Implemented

- Added the five support modes to both project-owned surfaces and routed the selected mode as
  separate gateway metadata.
- Stop in either surface interrupts the one shared Hermes request.
- Retry creates a new assistant attempt linked to the original user message; it never inserts a
  second user message.
- Home retains per-message explicit Copy and the compact Bubble now exposes Copy for the latest
  assistant response.
- Added shared-session UI fakes and updated prior UI tests to assert the new boundary rather than
  direct provider orchestration.

## S7 — Reconnect, restoration, and temporary chat

### Implemented

- Unexpected gateway exit marks an active turn recoverably failed without resubmission.
- Added bounded restart delays of 250 ms, 1 second, and 3 seconds, followed by explicit user retry.
- Persistent conversations resume their stored gateway key after recovery.
- A missing stored gateway session creates a fresh continuation runtime; bounded local context is
  supplied on the next turn and the mapping is updated.
- Temporary sessions have no SQLite transcript or durable mapping and request Hermes ephemeral
  mode; close/reset destroys the live temporary runtime.
- Provider/gateway failure does not stop the independent buddy body or local saved-history views.

## S8 — Privacy, diagnostics, and regression coverage

### Implemented

- Conversation deletion attempts isolated gateway-session purge before local deletion.
- Delete-all enumerates all durable mappings in Rust rather than relying on the UI's paginated
  conversation list.
- Local deletion still proceeds if an offline backend cache cannot be verified, with an honest
  notice.
- Added a development-only Agent Session Lab with redacted keys, process/runtime status, IDs,
  sequence, support mode, duplicate/stale counters, sanitized errors, and bounded lifecycle
  controls.

### Verification through S8

- Prettier: passed after formatting.
- ESLint: passed with zero warnings.
- Strict TypeScript: passed.
- Vitest: 50 files, 183 tests passed.
- Frontend production build: passed.
- Rust retry-focused test: passed and proves two attempts retain exactly one user message.
- Rust clippy with warnings denied: passed.

### Remaining boundary

The complete automated suites, Tauri builds, real Hermes/Ollama prompt path, exact native Windows
walkthrough, process/performance observations, final documentation, and report remain S9. No native
walkthrough result is claimed yet.
