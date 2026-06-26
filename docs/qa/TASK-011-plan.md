# Task 11 QA Plan — Living and Learning Companion

**Date:** 2026-06-26
**Project label:** Trading Buddy BETA v0.2

## Mission

Make Trading Buddy physically live on the desktop and continuously learn from local conversation
history.

Task 11 postpones frontend-wide redesign. UI changes are limited to controls, inspection, privacy,
and development tooling required by the creature and continuity systems.

## Safety and licensing

- Shimeji remains behavioral inspiration only. No characters, art, sprites, action data, or code.
- Odysseus remains an AGPL-3.0-or-later conceptual reference only. No code, prompts, tests, schemas,
  documentation, or assets may be copied or adapted.
- No screen pixels, window titles, process/application names, URLs, keystrokes, clipboard data, or
  accessibility-tree content.
- No cloud memory or embeddings, telemetry, trade execution, private keys, wallet signing, or
  autonomous trading.
- No affection, relationship XP, jealousy, streak pressure, guilt, or dependency mechanics.

## Task 10 audit

Completed:

- M1 product/architecture reset and licensing record.
- M2 geometry-only desktop world snapshots for monitor/work-area/window rectangles and optional
  cursor position.

Not completed:

- M3–M13, including movement, physics, direct drop reaction, surface graph, animation intent,
  semantic/episodic/entity continuity, compaction, embeddings, consolidation, modes, and labs.

## Baseline

Untouched baseline at `c247c0e`:

- `corepack pnpm check` — passed, 39 files / 140 tests.
- `corepack pnpm build` — passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` — passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` — passed, 70 tests.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
  — passed.
- `corepack pnpm tauri build --debug --no-bundle` — passed.
- `corepack pnpm tauri build --no-bundle` — passed.
- `git diff --check` — passed.

Pre-existing failures: none observed.

## Checkpoints

1. **C1 — Baseline and Task 10 audit**
2. **C2 — Physics, safe spawn, Bring Buddy Back**
3. **C3 — Drag/drop, surfaces, autonomous planner**
4. **C4 — Animation intent and Creature Lab**
5. **C5 — Memory compatibility migration**
6. **C6 — Summaries, context budget, compaction**
7. **C7 — Embeddings and hybrid retrieval**
8. **C8 — Episodes, entities, current-life context**
9. **C9 — Consolidation jobs and restart learning**
10. **C10 — Conversation modes and companion state**
11. **C11 — Privacy UI, offline modes, Continuity Lab**
12. **C12 — Performance, manual QA, documentation**

## C2 checks

- Fixed timestep is independent of React render frequency.
- Walking reaches left/right destinations without overshoot.
- Gravity and terminal velocity are bounded.
- Falling lands on the earliest valid crossed surface.
- Edge movement clamps safely.
- Invalid/off-screen state recovers into a work area.
- Negative monitor coordinates are valid.
- Restored native positions are clamped on startup.
- Native movement cannot place the buddy outside every work area.
- Bring Buddy Back places the buddy visibly and reanchors the bubble.

## C3 checks

- Click and drag remain distinct.
- Native drag has one owner.
- Drag start cancels autonomy.
- Drag completion enters drop/fall/recover.
- Surface graph is geometry-only and expires stale window surfaces.
- Planner randomness is injectable and cooldown-bound.
- No autonomous movement during conversation, drag, Do Not Disturb, or disabled movement.
- Snapshot and movement schedules are bounded.
- Creature movement remains available without Ollama.

## Handoff rule

If a later checkpoint cannot be completed safely, stop at the latest passing checkpoint, update the
journal/report, preserve existing behavior, and identify the exact next step.
