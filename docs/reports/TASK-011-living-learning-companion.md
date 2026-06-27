# Task 11 Report — Living and Learning Companion

**Date:** 2026-06-26
**Project:** Trading Buddy BETA v0.2
**Repository:** `somsom786/trading-buddy`
**Checkpoint claim:** C1 and C2 complete; C3 partially complete; C4-C12 pending

## Outcome

Trading Buddy now has an independently implemented deterministic desktop body that can safely
spawn, fall, land, recover, and move autonomously without Ollama. Native movement is clamped to
current work areas, and Bring Buddy Back provides a durable recovery path.

This is not completion of Task 11. Moving-window following, movement-preference UI, animation
intent, Creature Lab, and the entire Odysseus-inspired learning-mind scope remain pending.

## What changed

### Audit and references

- Confirmed Task 10 completed M1/M2 only and that M3-M13 were not complete.
- Re-fetched Shimeji for behavioral reference.
- Inspected the current Odysseus default `dev` branch at
  `a9b208f4704da8ff36c8cf8700c0310bfd06065e`.
- Preserved the independent-implementation and AGPL boundary. No external code, prompts, schemas,
  tests, documentation, action data, or assets were copied.
- Created the Task 11 plan and living QA journal.

### Creature domain

- Added separate physical, behavior, locomotion, drag, surface, and simulation-clock types.
- Added a bounded 30 Hz fixed-step accumulator independent of React.
- Added deterministic walking, acceleration, braking, facing, gravity, terminal velocity,
  collision, landing, edge handling, drop, and recovery.
- Added safe spawn/recovery across negative, removed, invalid, extreme, and off-screen geometry.
- Added monitor-floor and expiring geometry-only window-top surfaces.
- Added a seedable cooldown-based planner for idle, walk, sit, sleep, and writing.

### Runtime and native boundary

- Added a narrow desktop creature runtime that schedules snapshots at bounded rates and suppresses
  overlapping native movement calls.
- Added activity-aware refresh intervals: moving, resting, and sleeping.
- Paused autonomous relocation during drag, conversation, journal activity, reduced-motion
  transitions, and Do Not Disturb where applicable.
- Kept native Tauri dragging as the only operating-system drag owner.
- Added native programmatic movement clamping and shared startup restoration validation.
- Added Bring Buddy Back to select, persist, and focus a safe visible location.
- Removed continuous persistence from autonomous movement ticks.

### Renderer integration

- Connected locomotion to existing temporary pose fallbacks without claiming frame animation.
- Preserved click-to-conversation behavior and the existing six-pixel drag threshold.
- Wired drag start/completion, interaction wake-up, conversation pause, and Bring Buddy Back event
  handling into the runtime.

## Architecture decisions

1. Physics belongs in framework-independent TypeScript domain modules, not React components.
2. A bounded fixed timestep controls simulation; UI rendering observes state.
3. Rust is the final geometry safety boundary for native window movement.
4. Geometry snapshots remain transient and contain no titles, processes, pixels, text, clipboard,
   keystrokes, or application identity.
5. Native Tauri drag remains the single drag owner.
6. Autonomous ticks are not persisted; direct placement and recovery actions are.
7. Current artwork is an honest state fallback pending an animation-intent renderer.
8. Body behavior is completely model-independent and continues when Ollama is stopped.

## Files created

- `docs/qa/TASK-011-plan.md`
- `docs/qa/TASK-011-journal.md`
- `docs/reports/TASK-011-living-learning-companion.md`
- `src/domain/creature/types.ts`
- `src/domain/creature/surfaces.ts`
- `src/domain/creature/physics.ts`
- `src/domain/creature/simulation.ts`
- `src/domain/creature/planner.ts`
- `src/domain/creature/creature.test.ts`
- `src/services/creatureRuntime.ts`
- `src/services/creatureRuntime.test.ts`

## Files updated

- `README.md`
- `docs/PRODUCT.md`
- `docs/MVP.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/TASKS.md`
- `docs/PROGRESS.md`
- `docs/references/COMPANION_INSPIRATION.md`
- `src-tauri/src/desktop_world.rs`
- `src-tauri/src/window_manager.rs`
- `src-tauri/src/lib.rs`
- `src/components/buddy/BuddyRenderer.tsx`
- `src/components/buddy/BuddyRenderer.test.tsx`
- `src/domain/companion/events.ts`
- `src/domain/companion/events.test.ts`
- `src/domain/desktop-world/types.ts`
- `src/services/tauri/companionService.ts`
- `src/services/tauri/desktopWorldService.ts`
- `src/views/BuddyView.tsx`

## Tests and QA

The untouched baseline passed with 140 frontend tests and 70 Rust tests. The checkpoint adds ten
frontend tests and one Rust test, bringing the expected totals to 150 frontend tests and 71 Rust
tests.

A real debug desktop smoke probe observed the buddy fall from `y=189` to the monitor floor at
`y=958`, then move horizontally across 12 unique x positions. This verifies native fall and
autonomous walk behavior without requiring Ollama.

The final command results are recorded in `docs/qa/TASK-011-journal.md`.

## Known limitations and unverified items

- C3 is not complete: moving-window following and movement preference UI remain.
- Direct manual pointer drag/drop was not completed in this checkpoint's smoke session.
- Tray-menu clicking, window-top landing, surface following, multi-monitor negative-coordinate
  movement, mixed DPI, taskbar movement, rotation, and display-change QA remain manual checks.
- Static poses are fallbacks; animation intent and Creature Lab are C4.
- No memory migration, summaries, context budget, embeddings, hybrid retrieval, episodes, entities,
  consolidation, conversation modes, Continuity Lab, or learning-mind UI was implemented.
- No claim is made that Task 11's primary restart-continuity scenario works.

## Recommended next task

Finish C3 before entering memory work:

1. add conservative moving-window surface following and unsafe-motion fallback;
2. expose autonomous enablement and low/medium/lively movement intensity;
3. complete direct drag/drop, tray, window-top, multi-monitor, DPI, and display-change QA;
4. then implement C4's animation-intent interface and Creature Lab as a coherent checkpoint.

---

# Task 11B Continuation Report

**Date:** 2026-06-27

**Continuation claim:** C3A-C11 implemented and automatically verified; C12 remains open.

## Outcome

This continuation completes the code path joining the living creature to durable local
conversation continuity. The creature interaction architecture, movement settings, animation
intent, Creature Lab, schema v9, summaries, episodes, entities, current-life context, local vector
persistence, hybrid retrieval, durable consolidation, conversation modes, and focused transparency
UI now exist and pass the repository's automated/build gates.

Task 11 is not declared complete. The required real Ollama restart-semantic scenario was not
performed because `embeddinggemma:300m` is not installed, and the task explicitly forbids silent
model downloads. Direct human pickup/drop and moving-window QA also remain open.

## Previous checkpoint versus this continuation

The June 26 checkpoint already delivered deterministic fixed-timestep physics, gravity, landing,
recovery, safe spawn, native clamping, monitor/window-top primitives, native programmatic movement,
Bring Buddy Back, offline autonomous planning, and a real fall/walk smoke observation.

This continuation added:

- a strict click/press/threshold/drag/release/cancel state machine and inferred drop velocity;
- conservative geometry-only moving-surface tracking with hysteresis and safe detach;
- Rust-owned movement preferences applied across windows without restart;
- animation intent, pose anchors/hitboxes/mirroring, runtime diagnostics, and Creature Lab;
- ordered schema v9 continuity storage while preserving existing memory records;
- validated structured local-Qwen consolidation and durable recoverable jobs;
- normalized loopback Ollama embeddings and SQLite little-endian float32 BLOB persistence;
- bounded hybrid/lexical retrieval with source and reason codes;
- deterministic response context budgeting and bounded recent-turn retention;
- episodes, aliases, relationships, unresolved current-life context, corrections, and deletion;
- listen, reflect, plan, hang-out, and presence modes plus inspectable identity state;
- Continuity settings, summaries/episode/entity/current-life/job inspection, correction, deletion,
  retry, re-embed, delete-all, usage transparency, and development Continuity Lab.

## Architecture decisions

- Existing confirmed memories remain authoritative for stable user facts.
- Summaries compress conversations; episodes represent events; entities represent named things;
  current-life context is temporary.
- React never receives generic database access. Narrow Tauri services validate all boundary data.
- Model JSON cannot write directly to storage. Rust validates limits, enums, provenance, secret
  patterns, and sensitivity before one transaction.
- Visible generation has priority. Consolidation starts only after the assistant response is
  durable.
- Vectors remain local SQLite metadata plus validated normalized float32 BLOBs. No external vector
  database or cloud service was added.
- `sha2` was added solely for durable embedding content hashes and stale-vector detection.

## Verification performed

- Frontend: 44 files / 167 tests passed.
- Rust: 79 tests passed.
- Format, ESLint, strict TypeScript, frontend production build, Rust format, and clippy passed.
- Tauri debug and optimized no-bundle builds passed.
- A real `pnpm tauri dev` launch produced the buddy window with Companion Home hidden.
- The disk-backed FarmTown test reopened SQLite, retrieved a paraphrased project through a synthetic
  vector, preserved the unresolved concern, used a corrected version on later lexical retrieval,
  and excluded the deleted episode.
- Consolidation job tests prove source-version coalescing and running-job recovery after restart.
- Ollama loopback was reachable. The configured embedding model was absent; an installed completion
  model returned HTTP 501 from `/api/embed`, confirming the honest unavailable path.

## Manual QA honesty

Manually verified:

- native development application launch;
- buddy-first startup with the main window hidden;
- Ollama loopback availability and installed-model listing;
- no silent embedding-model download.

Not manually verified:

- direct physical click versus drag, drop, bubble-follow, and moving-window interaction;
- multi-monitor, mixed-DPI, taskbar, rotation, and display-change behavior;
- a meaningful 20-turn local-Qwen conversation and resulting extracted records;
- real embedding generation, semantic paraphrase recall after application restart, or correction
  and deletion through the live UI;
- full conversation-mode walkthrough and machine-specific performance measurements.

## Known limitations

- `embeddinggemma:300m` must be installed explicitly before semantic memory can become ready.
- Continuity Lab supports real retrieval/consolidation/restart-read controls but does not yet
  synthesize every requested 1,000-turn or contradiction fixture in the UI.
- Relationship merge, episode merge, pin/expire controls, and direct source-message navigation are
  not all exposed as dedicated buttons.
- Conversation model context limits currently use a conservative 8,192-token fallback rather than
  model metadata returned by Ollama.
- Full Task 11 completion and the exact mandated product claim remain intentionally withheld.

## Recommended next task

Finish C12, without starting a frontend redesign:

1. explicitly install `embeddinggemma:300m` outside the app;
2. perform the full FarmTown conversation, consolidation, restart, semantic paraphrase, correction,
   and deletion walkthrough;
3. perform direct drag/drop, moving-window, multi-monitor, and reduced-motion QA;
4. capture bounded performance timings and close any defects found;
5. only then update this report with the full completion claim.
