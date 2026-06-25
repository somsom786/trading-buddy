# Task 8 Conversational Journaling Implementation Plan

Date: 2026-06-24

## Baseline

- Repository started clean on `main` at `09fb3b8`.
- `corepack pnpm check` passed before implementation.
- `cargo test --manifest-path src-tauri/Cargo.toml` passed before implementation.
- Focused memory lifecycle storage test passed.
- Real desktop app launched to the buddy window.
- Full human WebView memory smoke was not completed because the available automation still cannot
  safely drive the React WebView. This will be recorded as unverified rather than claimed.

## Implementation slices

1. Add a numbered journal SQLite migration.
2. Add Rust journal models, preferences, validation, repository functions, exports, diagnostics,
   fixtures, and narrow Tauri commands.
3. Add TypeScript journal domain modules for:
   - types and validators;
   - deterministic intent detection;
   - guided prompt flows;
   - session reducer;
   - structured local-Qwen summary/reflection/daily-review parsing;
   - emotional safety helpers.
4. Add a storage-service journal boundary with response validation.
5. Add a compact desktop-bubble journal mode for guided/free-write sessions, explicit save, draft,
   discard, optional ratings, and optional AI summary/reflection.
6. Add Companion Home journal library and development-only Journal Lab.
7. Keep journal and memory separate by default; only explicit per-entry opt-in may create normal
   memory proposals.
8. Update README and product/architecture/decision/task/progress docs.
9. Add tests across Rust repository behavior and frontend domain/session/model parsing.
10. Run full verification and create the GPT-5.5 handoff report.

## Non-goals for this implementation

- No exchange integrations, wallet connections, market data, browser extension, cloud sync,
  authentication, voice, screen reading, keylogging, embeddings, vector database, therapy claims, or
  autonomous trading.
- No streaks, XP, affection meters, or profit-celebration mechanics.

## Verification target

Automated verification must pass. Manual desktop QA will be documented honestly; no scenario will
be marked complete unless it was actually performed.
