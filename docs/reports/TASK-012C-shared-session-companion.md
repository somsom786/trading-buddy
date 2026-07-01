# Task 12C report — Shared-session desktop companion

Date: 2026-07-01  
Branch: `codex/task-12c-shared-session`  
Trading Buddy commits: `8b7ded1`, `979814d`, `f37749b` plus the final documentation commit  
Hermes fork commit: `28f06366f`

## Outcome

The project-owned Tauri Bubble and Companion Home now use one Rust-owned Hermes-derived execution
session with a Rust SQLite authoritative transcript. Ordered visible deltas, five support modes,
shared Stop, explicit Copy, retry attempts without duplicate user messages, transcript restore,
ephemeral temporary sessions, bounded reconnect, missing-session continuation, and privacy cleanup
are implemented.

Hermes Desktop is not launched or copied into the product frontend. The fork contributes gateway
and agent execution logic behind typed private stdio. Companion chat has no shell, filesystem,
browser, clipboard-reading, approval, delegation, wallet, signing, or trading-execution path.

Task 12C is not declared fully complete because the exact 25-step native interaction walkthrough
was not directly driven in full.

## Architecture choices

- Rust owns one process-wide `AgentSessionRuntime`; React windows mirror its validated snapshot.
- Rust-owned SQLite remains authoritative for visible messages, status, retries, continuity, and
  deletion.
- `agent_session_links` lazily maps a persistent conversation to an isolated Hermes session.
- `agent_turn_attempts` links retry attempts to one original user message.
- Rust assigns monotonic stream sequence numbers and broadcasts transcript content only to
  `bubble` and `main`; the buddy receives lifecycle state only.
- Hermes uses a no-tools companion profile and receives support mode and bounded hidden context
  separately from clean visible user text.
- Gateway restart is bounded to 250 ms, 1 second, and 3 seconds. Ambiguous prompts are never
  automatically resubmitted.
- Temporary chat disables both Rust transcript persistence and Hermes session persistence.

## Major files created

- `src/domain/agent-session/` — contracts, validation, ordering, retry selection, presentation.
- `src/features/agent-session/` — shared hook, support picker, redacted Agent Session Lab.
- `src/services/tauri/agentSessionService.ts` — narrow frontend/native adapter.
- `src-tauri/src/agent_events.rs` — closed snapshot and stream event types.
- `src-tauri/src/agent_session.rs` — process-wide session coordinator.
- `src-tauri/src/hermes_process.rs` — pinned gateway lifecycle and stdio actor.
- `src-tauri/src/hermes_rpc.rs` — closed RPC allowlist and bounded parser.
- `docs/reformation/SHARED-SESSION-OWNERSHIP.md`.
- `docs/reformation/HERMES-GATEWAY-LIFECYCLE.md`.
- `docs/qa/TASK-012C-plan.md` and `docs/qa/TASK-012C-journal.md`.

The full changed-file list is available from the commits above.

## Automated verification

- `corepack pnpm format:check` — passed.
- `corepack pnpm lint` — passed with zero warnings.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm test` — 50 files, 183 tests passed.
- `corepack pnpm build` — passed.
- `corepack pnpm next:check` — 3 Petdex checks passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` — passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 97 passed, 1 real-provider test ignored by
  default.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
  — passed.
- Focused Hermes gateway/support suite — 315 passed.
- `corepack pnpm tauri build --debug` — passed; MSI and NSIS bundles produced.
- `corepack pnpm tauri build --no-bundle` — passed.
- `git diff --check` — passed.

## Real Hermes and Ollama verification

Ollama was running on loopback with local models. The ignored-by-default Rust integration test was
run explicitly against the pinned gateway and installed `qwen3:8b`:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml `
  streams_one_real_companion_turn_through_ollama -- --ignored --nocapture
```

It created a Trading Buddy ephemeral session, submitted clean text plus Presence metadata and
bounded hidden context, received visible streamed deltas, completed, closed the session, and shut
down without an orphan. Warm observations on this development machine:

| Observation         | Result    |
| ------------------- | --------- |
| Gateway ready       | 393 ms    |
| Session create      | 189 ms    |
| Submit accepted     | < 1 ms    |
| First visible token | 16,939 ms |
| Completion          | 19,946 ms |

The first cold run completed in 97.62 seconds, dominated by local model loading. These are local
observations, not universal performance claims.

## Native Tauri verification

`corepack pnpm desktop:dev` was launched. Process/log inspection observed:

- Vite ready in 212 ms;
- one `trading-buddy.exe` process with the buddy window title;
- one logical `tui_gateway.entry` instance;
- no TCP listening socket owned by the Tauri/gateway processes;
- idle five-second CPU delta of 0.047 seconds for Tauri and 0 for the gateway;
- approximately 47.6 MiB Tauri working set and 111.7 MiB combined Python launcher/runtime working
  set;
- clean final check with no Trading Buddy or gateway process after closing/stopping the smoke run.

The uv-created Windows environment represents one logical gateway as a 4.9 MiB venv launcher and a
106.8 MiB base Python runtime process. This is documented rather than misreported as two gateway
instances.

## Fixture-only verification

- Cross-window stream rendering, active Stop state, temporary-mode rendering, and direct UI
  boundary behavior use a deterministic shared-session test service.
- Duplicate/stale/terminal reducer behavior is domain-tested.
- Process launch/session handshake uses the real gateway but not Ollama in the default Rust suite.
- Hyperliquid and many memory/journal edge paths remain fixture-backed as documented by their own
  task reports.

## Exact Windows walkthrough status

The development app launched and process topology was observed, but cursor-driven native
interaction was intentionally not automated through raw desktop input while the user could be
using the machine. Therefore these remain unverified in this report:

- drag/release/fall/land and Bring Buddy Back observation;
- Bubble attachment and Enter/Shift+Enter in the native WebView;
- opening Home during a live stream and stopping from both windows;
- native retry/copy/reopen/restart interaction;
- real Ollama stop/restart UI recovery;
- killing the gateway during a native UI turn;
- tray Quit behavior;
- secondary-monitor and non-100% DPI behavior.

No screenshot or full-desktop capture was taken, avoiding accidental capture of unrelated private
screen content.

## Known limitations

- The native 25-step interaction walkthrough is the remaining completion gate.
- Mixed-DPI and secondary-monitor behavior requires available hardware and direct observation.
- Bubble/Home still retain some legacy deterministic UI reducer code for local journal/refusal and
  development fixtures, but real conversation generation has one Rust authority and no direct
  frontend provider call.
- Backend cache deletion is best effort when the gateway is offline; local authoritative deletion
  still proceeds with an honest notice.
- Warm first-token latency for the tested 8B local model was about 17 seconds on this machine.

## Recommended next task

Do not start Task 13 or redesign the frontend. Run the exact 25-step Task 12C walkthrough with the
user present, record each observed result, fix only failures in the shared companion path, and then
close Task 12B/12C if every acceptance criterion is genuinely supported.
