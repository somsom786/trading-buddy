# Task 12D QA Plan — Native companion acceptance and latency

## Scope

Complete the Task 12B/12C acceptance work without starting Task 13 or redesigning the product.
Trading Buddy's current inference boundary is NVIDIA-hosted DeepSeek V4 Pro, so stale Ollama-specific
steps are translated into equivalent cloud-provider availability and recovery checks. Optional
Ollama continuity behavior remains in scope only where it still exists.

## Evidence classes

- **Human-observed:** a tester directly saw or performed the behavior in the native Tauri app.
- **Automatically measured:** safe native diagnostics, process/runtime state, timings, or storage
  evidence captured without private content.
- **Fixture-only:** deterministic automated test or simulated failure evidence.
- **Not tested:** no current evidence.

Automated tests never become human-observed evidence.

## Checkpoints

### A1 — Baseline and guided acceptance runner

- Audit current `main`, the pinned Hermes fork, required reports, runtime ownership, windows, tray,
  temporary sessions, retry/deletion, and privacy boundaries.
- Run the complete automated baseline and record pre-existing failures.
- Add a development-only runner with one step at a time, safe notes/diagnostics, resume, and
  Markdown/JSON export.

### A2 — Native body and bubble acceptance

- Record direct buddy launch, placement, click/drag/drop/fall/land/recover, Bring Buddy Back,
  transparency, sleep/wake, reduced motion, bubble attachment/focus, keyboard behavior, scrolling,
  long content, and error states.
- Fix reproducible failures and add narrow regression coverage.

### A3 — Cross-window stream, Stop, Retry, and Copy

- Verify one active request and one assistant attempt across Bubble and Companion Home.
- Verify Stop from both surfaces, explicit Copy, reopen/restart restoration, and retry without a
  duplicate user message.

### A4 — Provider and gateway recovery

- Verify honest NVIDIA-provider failure/recovery behavior without fake responses.
- Verify bounded gateway restart, no blind resubmission, recoverable ambiguous turns, and bounded
  repeated-failure behavior.

### A5 — Temporary sessions, deletion, and privacy

- Verify temporary non-durability and reset/restart behavior.
- Verify conversation/mapping/attempt deletion and best-effort backend cleanup.
- Reconfirm no ordinary tools, hidden reasoning, signing, screen, clipboard-read, or unrestricted
  native paths.

### A6 — Latency instrumentation and optimization

- Capture application, gateway, session, context, prompt, provider, visible-delta, persistence, and
  cross-window timings without content.
- Separate Trading Buddy, backend/session, provider/model, and rendering overhead.
- Preserve immediate honest lifecycle feedback and Stop.

### A7 — Monitor, DPI, tray, and shutdown

- Run available monitor/scaling checks and mark unavailable hardware honestly.
- Verify tray actions and zero owned orphan processes after Quit without touching unrelated
  processes.

### A8 — Complete acceptance rerun

- Execute the exact ordered walkthrough in the development-only runner.
- Every step receives Pass, Fail, Blocked, or Not available on this hardware plus evidence class.
- Every fixed failure receives a retest result.

### A9 — Documentation and publication

- Run complete validation.
- Update all required reports, architecture, decisions, tasks, progress, acceptance-runner, and
  performance documentation.
- Push coherent tested checkpoints and final accepted state to GitHub `main`.

## Current-provider translation

The task brief predates the explicit cloud-provider decision. These substitutions are authoritative:

| Stale instruction                    | Current acceptance                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| Stop/restart Ollama for visible chat | Remove/reject/recover NVIDIA credential or simulate the typed provider boundary safely |
| Benchmark installed Qwen models      | Benchmark the pinned V4 Pro route and retain historical Qwen results as comparison     |
| Real Ollama stream test              | Real NVIDIA V4 Pro stream test through the same Rust/private-gateway application path  |
| “Still working locally…”             | “Still working…” / “The provider is taking longer than usual.”                         |

No local model is silently downloaded and no cloud fallback is silently introduced.
