# Task 12C QA Plan — Canonical shared session bridge

Date: 2026-07-01

## Baseline

- Trading Buddy baseline: `f7f111a`
- Hermes fork baseline: `87bb63c`
- Canonical frontend: project-owned Tauri/React buddy, bubble, and Companion Home
- User-facing transcript authority: Rust-owned `trading-buddy.db`
- Hermes transport: newline-delimited JSON-RPC 2.0 over stdio
- Gateway entry point: `next/agent/venv/Scripts/python.exe -m tui_gateway.entry`

## Checkpoints

### S1 — Baseline and ownership audit

- Read required product, architecture, decision, report, gap, and QA documents.
- Inspect existing bubble/Home generation and storage ownership.
- Inspect the forked gateway protocol and official programmatic-integration documentation.
- Record exact method/event shapes and missing Trading Buddy protocol guarantees.
- Run the complete pre-change baseline and record failures without hiding them.

### S2 — Shared session domain and Rust runtime

- Add a strictly validated framework-independent agent-session contract.
- Add deterministic event ordering, duplicate/stale rejection, terminal idempotency, retry, and
  support-mode tests.
- Add one process-wide Rust runtime state and a closed command/event boundary.
- Add the next ordered SQLite migration for local-to-Hermes session links.

### S3 — Hermes stdio JSON-RPC process integration

- Launch only the official gateway entry point from the pinned development environment.
- Keep stdout protocol-only and stderr diagnostic-only.
- Restrict requests to the companion allowlist.
- Add bounded process startup, shutdown, restart, line size, malformed JSON, timeout, and one-process
  tests.

### S4 — Ordered stream and idempotent persistence

- Persist one user message and one assistant placeholder before submit.
- Assign monotonic Rust sequences and stream into the existing placeholder.
- Reconcile terminal events once and never expose reasoning text.
- Add Hermes idempotency metadata if the existing gateway cannot deduplicate repeated submits.

### S5–S6 — Shared Bubble/Home experience

- Replace independent visible-generation ownership with one runtime subscription.
- Render the same snapshot and stream in both windows.
- Add support modes, Stop, Retry, and explicit assistant Copy.
- Preserve deterministic trading refusal and local journal/memory/continuity workflows.

### S7–S8 — Recovery, privacy, diagnostics

- Add bounded reconnect without blind prompt resubmission.
- Restore or safely continue missing sessions.
- Keep temporary sessions non-durable.
- Synchronize conversation deletion with mappings and supported backend cleanup.
- Add a development-only redacted Agent Session Lab.

### S9 — Real Windows acceptance

- Run the exact 25-step walkthrough.
- Record real Hermes/Ollama/process evidence separately from fixture evidence.
- Measure startup, first-token, rendering, reconnect, CPU, and memory on the development machine.
- Update final architecture, gap audit, report, and journal.

## Evidence rules

- Automated tests do not count as real desktop verification.
- Fixture process tests do not count as real Hermes or Ollama verification.
- A walkthrough step is passed only when directly observed.
- Mixed-DPI and secondary-monitor scenarios remain unverified unless the available hardware permits
  direct observation.
- Task 12C is complete only if every acceptance criterion is supported and the final report can make
  the prescribed completion claim honestly.
