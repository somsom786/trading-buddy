# Task 12B Correction Checkpoint - Physical Pet and Lifecycle

Date: June 29, 2026  
Status: **Task 12B remains in progress**

## Summary

This checkpoint moves the Hermes/Petdex reformation from a static overlay toward a physically alive
desktop companion. It adds deterministic movement and release behavior, native display clamping,
the full canonical pet-state vocabulary, real stream-lifecycle state wiring, and honest provider
offline classification.

This is not the Task 12B completion report. The required 25-step Windows walkthrough has not passed,
and the detached surface still lacks a streamed transcript, stop/retry/copy/history, real support
mode context, and bounded Hermes-backend recovery.

## Open-source foundation

- `next/agent` is the `somsom786/hermes-agent` fork.
- Its `upstream` remote remains `NousResearch/hermes-agent`.
- Hermes Agent is MIT-licensed, and the upstream `LICENSE` and copyright notice remain present.
- The preserved Tauri application remains in the parent repository while the Hermes/Petdex track is
  evaluated under `next/`.

## What changed

- Added the required canonical state vocabulary:
  `idle`, `walk_left`, `walk_right`, `sit`, `sleep`, `dragged`, `prefall`, `fall_left`,
  `fall_right`, `land`, `recover`, `listening`, `thinking`, `talking`, `writing`,
  `concerned`, and `offline`.
- Kept physical state above conversational state in deterministic state derivation.
- Added Petdex row aliases so existing packs degrade safely when a dedicated canonical row is not
  present.
- Added reduced-motion-aware autonomous short walks with bounded cooldown, step, duration, and
  direction.
- Added click-versus-drag threshold integration and a canonical `dragged` state.
- Added physical release behavior with horizontal inertia, gravity, floor collision, landing, and
  recovery.
- Added Electron work-area clamping for overlay open, drag, walking, release, and resize paths,
  including negative-coordinate monitor tests.
- Kept position persistence through the existing canonical overlay bounds bridge.
- Wired real agent lifecycle signals:
  typing/accepted → listening, preparation/reasoning/tools → thinking, assistant deltas → talking,
  completion → calm.
- Removed the automatic completion celebration from the real stream lifecycle. Financial outcomes
  do not produce celebration or shame animation.
- Added provider-offline error classification and an honest offline status that keeps the pet
  available.
- Corrected documentation language so the previous packaging milestone is Task 12A bootstrap and
  developer packaging, not Task 12B completion.
- Created and updated `docs/reformation/TASK-012B-GAP-AUDIT.md`.

## Architecture decisions

- Pure movement math lives in `apps/desktop/src/store/pet-motion.ts`; React owns timing and narrow
  native calls, while Electron remains authoritative for display-safe bounds.
- The popped-out overlay remains a puppet of the canonical main renderer and does not create a
  second gateway or Hermes session.
- Provider availability is derived from bounded error classification, not invented model output.
- Existing Petdex packs may use explicit new rows or deterministic aliases; no model-generated
  animation names are accepted.
- No new dependency was added.

## Commands run

```powershell
# Hermes/Petdex fork
npm --workspace apps/desktop run lint
npm --workspace apps/desktop run typecheck
npm --workspace apps/desktop run test:ui -- src/store/pet.test.ts src/store/pet-motion.test.ts src/store/pet-overlay.test.ts src/lib/provider-offline.test.ts
node --test apps/desktop/electron/companion-mode.test.cjs
npm --workspace apps/desktop run build

# Parent Trading Buddy
$env:CI='true'
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
pnpm next:check
pnpm tauri build --debug
```

The first parent `pnpm format:check` attempt stopped before checks because pnpm needed to recreate
`node_modules` after restart and would not prompt without a TTY. It was rerun non-interactively with
`CI=true`.

## Verification results

### Automated

- Hermes Desktop ESLint: passed with zero warnings.
- Hermes Desktop strict TypeScript: passed.
- Focused pet state, motion, overlay routing, and offline tests: 24 passed.
- Focused Electron companion startup/close/Bring Buddy Back/display tests: 5 passed.
- Hermes Desktop production renderer build: passed.
- Parent Prettier, ESLint, and strict TypeScript: passed.
- Parent Vitest: 44 files, 168 tests passed.
- Parent Rust: 88 tests passed.
- Petdex adapter: 3 tests passed.
- Tauri debug build: passed; debug MSI and NSIS bundles were produced.

### Build warnings

- Hermes Vite reports the existing large Tabler icon barrel/chunk warning.
- Hermes generated CSS reports the existing malformed comment optimizer warning.
- The Hermes build stamp correctly reported a dirty tree because verification ran before commit.

### Manually verified

- No new real Windows companion walkthrough was completed in this checkpoint.

### Fixture-only or logic-only

- Autonomous movement plan bounds.
- Release gravity, horizontal inertia, and floor landing.
- Negative-coordinate display clamping.
- Provider-offline message classification.
- Canonical pet-state priority and lifecycle mapping.

### Unverified hardware/runtime scenarios

- Mixed-DPI monitor transitions.
- Real pointer feel, fall timing, and landing animation.
- Real Ollama stop/restart recovery.
- Hermes backend kill/reconnect/session restoration.
- Shutdown process audit for orphan processes.

## Remaining Task 12B limitations

- The compact overlay contains a composer and status bubble, not the required distinct streamed
  transcript surface.
- Streaming response text is still shown only in the full application.
- Stop, retry, copy, and compact transcript history are not present in the detached bubble.
- Listen, reflect, plan, hang-out, and presence modes do not yet alter real Hermes request context.
- Backend reconnect is not yet bounded or proved duplicate-safe.
- Full bubble/session identity and stream ordering coverage remains incomplete.
- The exact 25-step Windows walkthrough remains unrun.

## Recommended next task

Continue Task 12B with one shared-session attached transcript:

1. expose canonical active-session messages and stream identity to the detached bubble;
2. render live deltas without storing duplicate delta messages;
3. add stop, retry, copy, compact history, and edge-aware placement;
4. add and test real support-mode request context;
5. implement bounded backend reconnect;
6. run the exact Windows walkthrough and fix each failing step before creating
   `TASK-012B-actual-companion-completion.md`.
