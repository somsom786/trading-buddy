# Task 12B — Frontend ownership and companion placement correction

Date: 2026-06-30
Branch: `codex/task-12b-pet-skins-ui`

## Outcome

This checkpoint removes Hermes Desktop from the user-facing product path and restores the
project-owned Tauri/React application as the canonical Trading Buddy frontend.

The detached buddy now starts near the taskbar/right screen edge, opens a compact attached bubble,
sleeps after five seconds without hover during development, wakes on hover, and supports a small
validated Petdex skin catalog with the local Trading Buddy skin as an offline fallback.

Task 12B is **not complete**. The Tauri frontend is not yet connected to the Hermes-derived
shared-session streaming backend, so the exact conversation, reconnect, and 25-step Windows
acceptance walkthrough remain open.

## July 2 Task 12D update

The project-owned frontend now includes a development-only guided native acceptance recorder and
content-free diagnostics. One real native drag permission defect was fixed, but the human
walkthrough remains open.

## What changed

- Changed `desktop:dev` and the compatibility `next:dev` command to launch the canonical Tauri
  application rather than Hermes Desktop.
- Documented Hermes as a backend/session logic donor only; no Hermes renderer or branding is part
  of the Trading Buddy product.
- Kept DyberPet as a behavior reference for edge dwelling, taskbar rest, sleep, drag, and release
  without copying its GPL implementation.
- Added strict Petdex skin and state-row domain modules, a narrow frontend catalog service, and a
  native Tauri command that reads and validates the documented Petdex manifest only when the user
  opens the skin picker.
- Added local persistence and cross-window selection for Trading Buddy, Boba, Tiko, Wangcai, and
  Mallow skins.
- Added legacy/current Petdex atlas-layout detection so supported remote skins render safely, with
  automatic fallback to the bundled local buddy.
- Reduced the bubble to `300 × 220`, attached it four pixels from the buddy, limited the visible
  transcript, and collapsed secondary trading controls by default.
- Moved the default buddy home to the taskbar/right-edge work area and persisted the new untouched
  default through storage migration 10.
- Added a deterministic five-second development sleep deadline and immediate hover wake.
- Added backend-only support-mode request context for listen, reflect, plan, hang out, and presence
  in the Hermes fork, while keeping clean user text in persisted history.

## Architecture decisions

- Tauri 2 + React remains the only canonical frontend.
- Hermes-derived agent/session behavior must enter through narrow backend services; its desktop
  frontend is not reused.
- Petdex is read-only and opt-in at picker-open time. Manifest IDs and asset URLs are validated at
  the native boundary, and the bundled skin always works offline.
- Companion timing, sprite-state mapping, selection validation, and fallback behavior remain
  deterministic domain logic with tests.
- The five-second sleep delay is explicitly a development value, not a final product default.

## Verification

Commands run:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri build --debug
next\agent\venv\Scripts\python.exe -m pytest -q `
  next\agent\tests\test_trading_buddy_support_modes.py `
  next\agent\tests\test_tui_gateway_server.py `
  -k "support_mode or companion_support or persists_clean_user_text"
```

Results:

- Prettier: passed after formatting one new test file.
- ESLint: passed with zero warnings.
- TypeScript: passed in strict project mode.
- Vitest: 47 files, 175 tests passed.
- Rust: 89 tests passed.
- Hermes backend focused tests: 12 passed, 299 deselected.
- Tauri debug application and Windows MSI/NSIS bundles: built successfully.
- Live Windows development smoke:
  - project-owned buddy opened with Companion Home hidden;
  - buddy sat at the taskbar/right edge;
  - compact bubble opened next to the buddy;
  - the native Petdex picker loaded the curated skins;
  - Boba selection persisted across a development-process restart;
  - Boba's legacy atlas rendered after sleep-row layout correction;
  - five-second sleep and hover wake were observed;
  - Companion Home displayed Trading Buddy branding, not Hermes branding.

## Files created

- `src-tauri/src/petdex.rs`
- `src/components/buddy/PetdexBuddyRenderer.tsx`
- `src/components/buddy/PetdexBuddyRenderer.test.ts`
- `src/domain/petdex/skins.ts`
- `src/domain/petdex/skins.test.ts`
- `src/domain/petdex/stateRows.ts`
- `src/services/petdexCatalog.ts`
- `src/services/petdexCatalog.test.ts`
- `docs/reports/TASK-012B-frontend-ownership-correction.md`
- `next/agent/tests/test_trading_buddy_support_modes.py`

Other existing frontend, native, documentation, migration, and backend test files were updated.

## Not verified or not complete

- The Tauri bubble does not yet use the Hermes-derived canonical session/stream backend.
- Streamed assistant text, shared history, stop, retry, copy, reconnect ordering, and duplicate
  protection therefore still need end-to-end verification in the canonical Tauri UI.
- Support-mode prompts are implemented and tested in the backend fork but are not yet connected to
  the Tauri request path.
- The exact Task 12B 25-step Windows walkthrough, mixed-DPI/multi-monitor matrix, real backend
  restart recovery, and shutdown/orphan-process audit remain open.
- Petdex is a live third-party catalog and can be unavailable; the local Trading Buddy skin remains
  the guaranteed fallback.

## Recommended next task

Connect the project-owned Tauri conversation service to one Hermes-derived backend session with
ordered streaming events, shared transcript restoration, stop/retry/copy, support-mode context,
bounded reconnect, and duplicate protection. Then run and record the exact Task 12B Windows
walkthrough before declaring Task 12B complete.
