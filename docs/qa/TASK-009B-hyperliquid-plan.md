# Task 9B QA Plan — Read-Only Hyperliquid Foundation

Date: 2026-06-25

## Baseline inspection summary

- Latest SQLite schema before this task: v4.
- Existing Rust HTTP dependency: `reqwest` with `rustls-tls`, `json`, and `stream`.
- Existing async runtime: Tokio through Tauri commands and local AI streaming.
- Existing error pattern: typed Rust errors serialized across Tauri, normalized by TypeScript
  runtime guards.
- Existing command pattern: narrow Rust Tauri commands registered in `src-tauri/src/lib.rs`.
- Existing frontend validation pattern: domain runtime guards in `src/domain/**` and checked
  `invoke` wrappers in `src/services/tauri/**`.
- Existing lab pattern: development-only `<details>` labs inside Companion Home.

## Baseline command results before editing

All baseline commands passed before Task 9B code changes:

- `corepack pnpm check`
- `corepack pnpm build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `corepack pnpm tauri build --debug --no-bundle`
- `corepack pnpm tauri build --no-bundle`
- `git diff --check`

Pre-existing failures: none observed.

## Implementation checkpoints

### B1 — Official contract and security boundary

- Research only official Hyperliquid documentation.
- Document allowlisted mainnet/testnet API URLs and read-only request contracts.
- Add a clear security boundary: no keys, signing, write/execution methods, arbitrary URLs, or raw
  provider bodies exposed to React.

### B2 — Provider types, parsing, decimal model, fixtures

- Add Rust Hyperliquid integration modules for environments, capabilities, address validation,
  decimal-safe parsing, official DTOs, normalized objects, fixtures, and fixture transport.
- Store authoritative financial values as exact strings, parsed/validated in Rust.
- Add sanitized provider-shaped fixtures.

### B3 — Migration and repositories

- Add the next SQLite migration after v4 for read-only integration accounts, sync state, snapshots,
  positions, fills, funding, open-order snapshots, and sync runs.
- Add typed repository operations with idempotent fill/funding behavior and transactional current
  snapshot replacement.

### B4 — Historical sync and idempotency

- Implement fixture-backed sync first and official read-only transport behind the same interface.
- Persist partial successes without deleting last-known data on ambiguous failures.
- Prevent duplicate active syncs and duplicate historical rows.

### B5 — Companion Home and desktop integration

- Add a minimal Trading section in Companion Home.
- Add TypeScript trading domain guards, formatting, freshness, and deterministic read-only intents.
- Add restrained desktop buddy account facts without profit celebration or trade signals.

### B6 — Performance, QA, documentation

- Add bounded performance fixtures and document machine-specific results.
- Run full validation.
- Add the implementation report under `docs/reports/` and link it from `docs/PROGRESS.md`.

## Scope guardrails

This task must remain read-only. It must not add order placement, cancellation, transfers,
withdrawals, private-key fields, seed phrase fields, wallet signing, exchange secrets, generic
RPC/HTTP proxying, cloud storage, telemetry, risk engines, recommendations, charts, or WebSocket
live sync.
