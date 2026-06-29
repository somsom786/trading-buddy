# Task 12 Report: Trading Buddy Hermes/Petdex Reformation

**Date:** June 29, 2026  
**Project:** Trading Buddy BETA v0.2  
**Parent branch:** `codex/task-12-reformation`  
**Hermes branch:** `codex/trading-buddy-reformation`

## Summary

Created the first non-destructive Hermes/Petdex reformation slice for Trading Buddy. The existing
Tauri application remains preserved, while `next/` now contains a Hermes Desktop fork, a bundled
Petdex Trading Buddy pet, a local-first trader companion soul, a no-tools companion mode, and a
launcher that starts a visible buddy with the main window hidden.

## Files and areas changed

- Added Hermes Agent as a submodule at `next/agent`.
- Added `next/packages/petdex-adapter` with Petdex manifest and atlas validation.
- Added `next/scripts/build-petdex-pack.mjs` and generated
  `next/pets/trading-buddy-default/spritesheet.png`.
- Added `next/packages/trading-buddy-soul` with the companion soul, safety notes, support modes,
  relationship boundaries, process-over-PnL guidance, trader-culture notes, and state schema.
- Added `next/skills/trader-companion/SKILL.md`.
- Added `next/scripts/dev.ps1` for an isolated local development launch.
- Added `next/README.md`.
- Added root test/format exclusions so parent Trading Buddy checks do not traverse the Hermes
  submodule.
- Aligned package, Tauri, and Rust metadata to `0.2.0`.
- Rebranded the Hermes Desktop fork for `Trading Buddy BETA v0.2`.
- Added Hermes companion tray actions, hidden-main startup, Bring Buddy Back behavior, and
  companion-mode helpers/tests.
- Added the Hermes `trading-buddy-companion` no-tools toolset.
- Added Task 12 reformation, QA, and report docs.

## Architecture choices

- Preserve the existing Tauri product as the stable baseline.
- Keep the reformation in `next/` so it is reversible.
- Use Hermes Desktop's existing Petdex overlay rather than building a second pet runtime.
- Use Petdex's current 192 by 208 cell, 1536 by 1872 atlas convention.
- Use a default no-tools Hermes toolset for companion conversation.
- Use local Ollama through `http://localhost:11434/v1`.
- Keep runtime data isolated under `%LOCALAPPDATA%\TradingBuddy`.
- Treat DyberPet, Odysseus, and Agentic Desktop Pet as reference-only sources because of license
  or licensing uncertainty.

## Commands run and verification results

Passing checks:

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm tauri build --no-bundle
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
corepack pnpm next:pet:build
corepack pnpm next:pet:test
npm install
uv venv venv --python 3.12
uv pip install --python venv\Scripts\python.exe -e '.[all,dev]'
npm run typecheck --workspace apps/desktop
npm run build --workspace apps/desktop
node --test electron/companion-mode.test.cjs electron/window-state.test.cjs
npx vitest run --environment jsdom src/store/pet.test.ts
npx eslint electron/main.cjs electron/preload.cjs electron/companion-mode.cjs electron/companion-mode.test.cjs src/global.d.ts src/store/pet-overlay.ts src/app/pet-overlay/pet-overlay-app.tsx
```

Result counts:

- Parent frontend tests: 44 files, 168 tests passed.
- Parent Rust tests: 88 tests passed.
- Hermes focused desktop helper tests: 18 tests passed.
- Hermes focused pet store tests: 6 tests passed.
- Petdex adapter tests: 3 tests passed.

Runtime checks passed:

- `next/scripts/dev.ps1 -SkipInstall` launched the reformed desktop slice.
- Backend reported `HERMES_DASHBOARD_READY`.
- WebSocket gateway accepted the desktop connection.
- Pet overlay was visible while the main window stayed hidden.
- Pet click opened the composer.
- Composer message created persisted Hermes session `20260629_135418_7f6239`.
- Local model used `qwen3:8b` through Ollama loopback.
- The response streamed in chunks and ended with `tool_turns=0`.

## Finalization update

The Task 12 follow-up on branch `codex/task-12b-pet-skins-ui` closes the earlier lint/tooling and
developer-package documentation gaps:

- `npm run fmt --workspace apps/desktop`: passed after fixing the Windows shell quoting issue.
- `npm run lint --workspace apps/desktop`: passed.
- `npm run typecheck --workspace apps/desktop`: passed.
- `npm run build --workspace apps/desktop`: passed.
- `npm run pack --workspace apps/desktop`: passed and produced an unpacked Windows developer
  package at `next/agent/apps/desktop/release/win-unpacked/Trading Buddy.exe`.
- `corepack pnpm next:check`: passed.
- Developer packaging is documented in `docs/reformation/DEVELOPER-PACKAGING.md`.
- Migration is explicitly decided as no automatic migration for the preview, implemented by
  isolated runtime paths and documented in `docs/reformation/DATA-MIGRATION.md`.

## Could not be fully verified

- Full upstream Hermes Desktop UI tests still fail on unrelated existing test drift, including
  assistant rendering, pane width override, attachment/preview routing, model settings, messaging,
  and tool fallback tests.
- Full upstream platform tests still have update-relaunch failures on this Windows/bash path
  combination.
- Multi-monitor manual QA was not completed.
- Production installer signing for the Hermes track was not completed.
- Automatic Tauri-to-Hermes user-data migration was intentionally not implemented for the preview.

## Known limitations

- The Hermes track is a vertical slice, not yet the only product runtime.
- Internal Hermes names still exist in the forked codebase.
- The bundled pet atlas is generated from temporary concept poses and is not final production art.
- Default companion mode intentionally has no tools.
- No crypto execution, wallet signing, authentication, cloud infrastructure, telemetry, or
  autonomous trading was added.

## Recommended next task

Turn the reformation slice into a repeatable developer preview:

1. add a short manual QA checklist for humans to run on the Hermes track;
2. fix or explicitly quarantine the broader upstream Hermes Desktop UI test drift;
3. perform multi-monitor/DPI human QA;
4. keep automatic migration postponed until after the Hermes runtime stabilizes.
