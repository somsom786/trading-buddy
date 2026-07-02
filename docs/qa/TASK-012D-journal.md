# Task 12D QA Journal — Native companion acceptance and latency

## A1 — Baseline and ownership audit

### Repository state

- Parent branch: `main`
- Parent baseline: `6ecaa14`
- Public main before Task 12D work: `6ecaa14`
- Hermes fork pointer: `28f06366f`
- Hermes fork branch: `codex/task-12c-shared-session`
- Parent and submodule working trees: clean

The task brief's expected `b13bbd0` Task 12C branch and `f7f111a` public main are historical. Task
12C and the subsequent secure NVIDIA V4 Pro route are already published on current `main`.

### Ownership findings

- Tauri/React is the only canonical frontend.
- Rust `AgentSessionRuntime` owns the one active shared session.
- Rust SQLite owns the visible transcript, retry attempts, and conversation mapping.
- The pinned fork executes behind typed private stdio and contributes no product frontend.
- Bubble and Companion Home subscribe to one snapshot/stream.
- Companion chat uses a no-tools profile.
- Visible inference is pinned in Rust to NVIDIA-hosted DeepSeek V4 Pro.
- Optional Ollama remains only for continuity embeddings/background extraction.

### Pre-edit automated baseline

Commands run:

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm next:check
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
next\agent\venv\Scripts\python.exe -m pytest -q `
  next\agent\tests\test_trading_buddy_support_modes.py `
  next\agent\tests\test_tui_gateway_server.py
cargo test --manifest-path src-tauri/Cargo.toml `
  hermes_process::tests::streams_one_real_companion_turn_through_nvidia `
  -- --ignored --nocapture
corepack pnpm tauri build --debug
corepack pnpm tauri build --no-bundle
git diff --check
```

Results:

- Prettier, ESLint, and strict TypeScript: passed.
- Frontend: 50 files, 183 tests passed.
- Frontend/Petdex builds: passed; 3 Petdex tests passed.
- Rust: 99 passed, one live-network test ignored by default.
- Rust formatting and Clippy with warnings denied: passed.
- Focused Hermes gateway/support suite: 315 passed.
- Real V4 Pro application path: gateway 307 ms, session 146 ms, accepted under 1 ms, first visible
  token 12,725 ms, completion 13,028 ms.
- Tauri debug MSI/NSIS and release no-bundle builds: passed.
- `git diff --check`: passed.
- Pre-existing automated failures: none.

### Evidence boundary

The baseline proves build integrity, typed behavior, one real provider turn, and deterministic
geometry/recovery logic. It does not prove pointer feel, visual focus, cross-monitor behavior, tray
interaction, or the complete native walkthrough. Those remain **not tested** until recorded by a
human in the guided runner.

## A1 — Guided acceptance runner

Status: implemented; automated checkpoint verification complete.

Implementation:

- Added a development-only, one-step-at-a-time 25-step recorder in Companion Home.
- Added local resume/reset plus Markdown and JSON exports.
- Added explicit status and evidence classifications so fixture or automatic evidence cannot be
  mistaken for human observation.
- Added a narrow native diagnostic command for allowlisted Trading Buddy windows, display
  geometry, owned runtime state, redacted session identifiers, and duplicate/stale counters.
- Bounded and sanitized notes before persistence or export.
- Added domain, boundary, component, and Rust redaction tests.

Checkpoint verification:

```powershell
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
cargo test --manifest-path src-tauri/Cargo.toml acceptance -- --nocapture
```

- Strict TypeScript: passed.
- ESLint: passed after strict-indexing and safe-formatting fixes.
- Frontend: 53 files, 190 tests passed.
- Focused Rust acceptance diagnostics: 1 passed.

Human-observed native results remain not tested. The runner is now available to record them
without overstating automated evidence.

## A2–A9

Status: not started. Do not infer completion from automated baseline evidence.

## A6 — Latency instrumentation and provider benchmark

Status: implementation complete; native measurement pending the human walkthrough.

Implemented content-free spans for:

- Tauri application setup;
- gateway spawn and readiness;
- client context retrieval, budget construction, and hidden prompt construction;
- Rust turn preparation, session open/resume, prompt dispatch, and acceptance;
- first backend event, exact provider-request start, first visible content, and completion;
- SQLite finalization;
- cross-window event emission and frontend event-to-next-paint.

The pinned fork emits `provider.request` immediately before `agent.run_conversation`. The event
contains only the existing validated client request ID. Fork commit: `74a12b5aa`.

Real DeepSeek V4 Pro samples:

| Sample   | Gateway ready | Session | Accepted | First visible |  Complete |
| -------- | ------------: | ------: | -------: | ------------: | --------: |
| Baseline |        307 ms |  146 ms |    <1 ms |     12,725 ms | 13,028 ms |
| A6-1     |        375 ms |  197 ms |    <1 ms |      7,541 ms |  7,804 ms |
| A6-2     |        377 ms |  200 ms |    <1 ms |      5,172 ms |  5,755 ms |
| A6-3     |        412 ms |  204 ms |    <1 ms |      5,791 ms |  6,056 ms |

Median first-visible time across all four current-provider samples is 6,666 ms. This is below the
historical approximately 17-second warm `qwen3:8b` result, but provider/network variation is real
and the instrumentation is not presented as the cause.

Focused verification completed:

- 192 frontend tests passed across 54 files.
- 102 Rust tests passed; one real-network test remains ignored by default.
- Real NVIDIA application gateway test passed three times after instrumentation.
- Focused provider-marker Python test passed.
- Strict TypeScript, ESLint, Prettier, Rust format, and Clippy passed after replacing a helper newer
  than the project's Rust 1.77.2 MSRV.

## A2 — Native body and Bubble

Status: in progress; direct human retest pending.

Automatic native startup evidence:

- one responsive `trading-buddy.exe`;
- one logical private gateway rooted under that process;
- Companion Home hidden;
- one visible 140-by-140 Buddy at `(1902, 958)`, inside the primary 2048-by-1104 work area;
- the 300-by-220 Bubble existed hidden and was positioned next to Buddy;
- no owned TCP listening socket.

Native failure:

| Field      | Evidence                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Observed   | Moving past the drag threshold produced `window.start_dragging not allowed` in the live Tauri log. |
| Expected   | The Buddy window hands the intentional drag to the native window manager once.                     |
| Root cause | Tauri 2 capability configuration did not grant `core:window:allow-start-dragging`.                 |
| Fix        | Added a dedicated `buddy-drag` capability scoped only to the `buddy` window.                       |
| Regression | `buddy_alone_receives_the_native_drag_capability` passes.                                          |
| Retest     | Pending direct drag, drop, fall, land, and recover observation.                                    |

No later log entry has repeated the permission failure, but absence of a repeated log is not
substituted for the pending human retest.

## A4 — Provider and gateway recovery

Status: development recovery path implemented; direct turn-level walkthrough pending.

- Added **Crash backend safely** to the development Agent Session Lab.
- The command kills only the owned gateway child and intentionally follows the real Offline,
  bounded reconnect, interrupted-turn, and no-blind-resubmit path.
- The existing Stop control remains an intentional stop and is no longer presented as crash
  evidence.
- Development action failures are rendered as bounded errors rather than unhandled promise
  rejections.
- Native process-manager crash simulation test passed.
- Agent Session Lab action and error tests passed.

## A5 — Temporary sessions, deletion, and privacy

Status: fixture and boundary evidence complete; native walkthrough pending.

- Acceptance diagnostics now expose only aggregate local conversation, message, and session-mapping
  counts for before/after verification.
- Rust repository coverage passes for ephemeral preparation, retry without duplicate user text,
  mapping cascade, conversation deletion, and delete-all isolation.
- Hermes ephemeral-session coverage confirms no gateway database row is created.
- The companion toolset is asserted to contain zero tools and zero included toolsets.
- The parent typed RPC allowlist is asserted to exclude shell, filesystem, browser, clipboard,
  screen, wallet, and signing methods.
- Reasoning events are not mapped into the project-owned transcript event vocabulary.

These are fixture/boundary results, not human-observed deletion or Temporary-mode results.

## A7 — Monitor, idle, and native process observations

Status: automatic evidence captured; pointer/tray/DPI walkthrough pending.

- Two real monitors are available.
- The secondary monitor has negative coordinates: `(-1920, 156)` with a 1920-by-1032 work area.
- Primary work area: `(0, 0)` with 2048-by-1104 usable pixels.
- Five-second owned-process idle sample: Tauri 0.0156 CPU seconds; all gateway descendants combined
  0.0156 CPU seconds.
- Owned listening TCP sockets: zero.

Negative-coordinate fixtures pass, but cross-monitor drag and scaling remain unverified until the
human walkthrough records them.
