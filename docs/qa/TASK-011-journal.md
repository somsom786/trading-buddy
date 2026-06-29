# Task 11 QA Journal — Living and Learning Companion

**Date:** 2026-06-26
**Project label:** Trading Buddy BETA v0.2

## C1 — Audit and baseline

- Repository clean at `c247c0e`.
- Reconfirmed Task 10 completed M1/M2 only.
- Reconfirmed M3–M13 remained incomplete.
- Re-fetched the Odysseus default `dev` branch; reviewed commit remains
  `a9b208f4704da8ff36c8cf8700c0310bfd06065e`.
- Re-fetched `https://shimejis.xyz/` successfully.
- No external source, prompt, test, schema, action data, or asset was copied.

Baseline:

| Command                                                                                         | Result | Notes                      |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------------- |
| `corepack pnpm check`                                                                           | Passed | 39 files / 140 tests.      |
| `corepack pnpm build`                                                                           | Passed | Frontend production build. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check`                                        | Passed | Rust formatting clean.     |
| `cargo test --manifest-path src-tauri/Cargo.toml`                                               | Passed | 70 Rust tests.             |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Passed | No warnings.               |
| `corepack pnpm tauri build --debug --no-bundle`                                                 | Passed | Debug executable built.    |
| `corepack pnpm tauri build --no-bundle`                                                         | Passed | Release executable built.  |
| `git diff --check`                                                                              | Passed | No changes.                |

Pre-existing failures: none observed.

## C2 — Physics and safe recovery

Implemented:

- separated physical, behavior, locomotion, drag, surface, and clock state;
- added a bounded 30 Hz fixed-step simulation independent of React rendering;
- added walk acceleration/braking, gravity, terminal velocity, floor/window-top landing, edge
  clamping, dropped/fall/land/recover transitions, and disappearing-surface fallback;
- added safe spawn and recovery for absent, invalid, non-finite, extreme, negative, and off-screen
  positions;
- clamped restored and programmatic native positions to current work areas;
- changed the tray recovery action to Bring Buddy Back and kept bubble anchoring coherent;
- avoided per-tick position persistence.

Focused verification:

- creature domain tests cover walking in both directions, destination braking, falling, landing,
  terminal velocity, edge stopping, drop, negative coordinates, disappearing surfaces, and
  off-screen recovery;
- Rust tests cover no saved position, off-screen restore, removed monitor fallback, negative
  coordinates, extreme coordinates, invalid scale factor, and changed work areas.

## C3 — Drag/drop, surfaces, and autonomy

Partially implemented as a coherent passing checkpoint:

- retained one native Tauri drag owner behind the renderer's six-pixel threshold;
- autonomous movement pauses during drag and active conversation;
- drag completion persists the clamped native position and enters drop/fall/land/recover;
- reduced motion uses immediate safe drop placement;
- monitor floors and expiring geometry-only window tops form the surface graph;
- surface snapshots refresh every 1 second while moving, 4 seconds while resting, and 15 seconds
  while sleeping, with overlapping native moves suppressed;
- seeded planner decisions support idle, walk, sit, sleep, and writing with low/medium/lively
  cooldown ranges;
- planner does not depend on Ollama and does not implement guilt, attachment, or cursor chasing.

Still pending before C3 can be marked complete:

- conservative movement with a moving window surface;
- product UI for autonomous enablement and movement intensity;
- direct manual drag/drop, window-top, tray-click, multi-monitor, DPI, taskbar, and display-change
  QA.

## Real desktop smoke evidence

A debug Tauri executable was launched with Ollama not required. Native window geometry was sampled
from the running Trading Buddy process:

- an initial sample observed the buddy descend through `y=189`, `y=464`, and `y=958`;
- a longer 21-second sample recorded 42 observations, 15 unique positions, and 12 unique x
  positions;
- after landing at `y=958`, x advanced from `254` through `638`, demonstrating autonomous
  horizontal movement in the real desktop window.

One diagnostic retry failed because a temporary PowerShell `Add-Type` definition did not persist
between shell processes. The application process was stopped normally, and the complete follow-up
probe succeeded.

## Implementation issues caught

- Walk braking could flip facing at the final destination; target crossing now preserves the
  intended facing direction.
- Surface expiry initially used the native snapshot's older timestamp; validity is now anchored to
  WebView receipt time.

## Final validation

| Command                                                                                         | Result | Notes                                |
| ----------------------------------------------------------------------------------------------- | ------ | ------------------------------------ |
| `corepack pnpm format`                                                                          | Passed | Repository formatted.                |
| `corepack pnpm format:check`                                                                    | Passed | Included by `pnpm check`.            |
| `corepack pnpm lint`                                                                            | Passed | Zero ESLint warnings.                |
| `corepack pnpm typecheck`                                                                       | Passed | Strict TypeScript build clean.       |
| `corepack pnpm test`                                                                            | Passed | 41 files / 150 tests.                |
| `corepack pnpm build`                                                                           | Passed | Frontend production bundle built.    |
| `cargo fmt --manifest-path src-tauri/Cargo.toml`                                                | Passed | Rust sources formatted.              |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check`                                        | Passed | Rust formatting clean.               |
| `cargo test --manifest-path src-tauri/Cargo.toml`                                               | Passed | 71 Rust tests, including migrations. |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Passed | Zero warnings.                       |
| `corepack pnpm tauri build --debug --no-bundle`                                                 | Passed | Debug executable built.              |
| `corepack pnpm tauri build --no-bundle`                                                         | Passed | Release executable built.            |
| `git diff --check`                                                                              | Passed | No whitespace errors.                |

Embedding, retrieval, compaction, and consolidation tests were not run because their Task 11
systems do not exist yet; C5-C9 remain pending. Final diff hygiene is checked immediately before
commit.

## Later checkpoints

C4–C12 remain pending and must not be inferred complete from body-engine work.

## Task 11B continuation baseline — June 27, 2026

- Repository clean on `main` at `cb84ddc`.
- Re-fetched Shimeji successfully as behavioral reference only.
- Re-fetched the current Odysseus default `dev` branch at
  `ebead8083e84f58f7e1012f22c9a9266a13fa1ee`.
- Reviewed the required Odysseus memory, embedding, compaction, budget, search, event, and durable
  background-job concepts without copying source, schemas, prompts, tests, or documentation.
- Reviewed the official Ollama `/api/embed` and `/api/tags` contracts.
- Confirmed the current Trading Buddy schema is version 7 and migrations are embedded, ordered,
  transactional Rust migrations.
- Confirmed existing stable user facts remain in `memories`; current FTS retrieval only covers
  confirmed, non-expired memories.

Untouched Task 11B baseline:

| Command                                                                                         | Result | Notes                          |
| ----------------------------------------------------------------------------------------------- | ------ | ------------------------------ |
| `corepack pnpm check`                                                                           | Passed | 41 files / 150 tests.          |
| `corepack pnpm build`                                                                           | Passed | Frontend production build.     |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check`                                        | Passed | Rust formatting clean.         |
| `cargo test --manifest-path src-tauri/Cargo.toml`                                               | Passed | 71 Rust tests.                 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Passed | Zero warnings.                 |
| `corepack pnpm tauri build --debug --no-bundle`                                                 | Passed | Debug executable built.        |
| `corepack pnpm tauri build --no-bundle`                                                         | Passed | Optimized executable built.    |
| `git status --short`                                                                            | Passed | Clean before Task 11B editing. |

Pre-existing failures: none observed.

### C3A

Implemented and automatically verified:

- strict idle/pressed/threshold-pending/dragging/released/cancelled pointer state;
- six-pixel threshold with slight movement preserved as click;
- native Tauri remains the only operating-system drag owner;
- inferred bounded drop velocity and fall/land/recover;
- conservative moving-window surface reconciliation with hysteresis and 48-pixel correction cap;
- full-screen-like, invalid, minimized, closed, off-screen, and large-jump detach behavior;
- schema v8 persistent movement preferences and live cross-window application;
- focused movement settings UI.

Manual direct drag, multi-monitor, DPI, and moving-window walkthrough remains open.

### C4 - Animation intent and Creature Lab

- Added a physics-authoritative animation-intent projection for all required locomotion and
  conversation states.
- Added stable anchors, pose hitboxes, safe neutral-side mirroring, clipping, and nearest-neighbor
  rendering.
- Added bounded runtime diagnostics and deterministic Creature Lab controls without titles,
  process names, pixels, or application content.

### C5-C10 - Local continuity architecture

- Documented compatibility before migration: confirmed memories remain authoritative stable facts.
- Added schema v9 summaries, episodes, sources, entities, aliases, mentions, relationships,
  episode links, current-life context, embedding models/BLOBs, jobs, and usage.
- Added strict structured local-Qwen consolidation with source provenance, secret rejection,
  transactional persistence, maximum-three episodes, and sensitive proposal boundaries.
- Added deterministic context budgeting, bounded hybrid retrieval, alias/project reasons,
  lexical fallback, float32 validation, SHA-256 content hashes, stale-vector handling, retry,
  coalescing, cancellation, and startup recovery.
- Chat and bubble now enqueue only after a completed assistant message is durable.

### C11 - Modes and transparency

- Added deterministic listen, reflect, plan, hang-out, and presence detection/prompts.
- Added versioned inspectable companion identity state and natural decay.
- Added focused Continuity UI and development Continuity Lab for summaries, episodes, entities,
  current-life context, jobs, semantic state, correction, deletion, retry, re-embed, settings, and
  retrieval reasons.

### C12 - Verification status

Passed:

| Command                                                                                         | Result               |
| ----------------------------------------------------------------------------------------------- | -------------------- |
| `corepack pnpm format:check`                                                                    | Passed               |
| `corepack pnpm lint`                                                                            | Passed               |
| `corepack pnpm typecheck`                                                                       | Passed               |
| `corepack pnpm test`                                                                            | 44 files / 167 tests |
| `corepack pnpm build`                                                                           | Passed               |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check`                                        | Passed               |
| `cargo test --manifest-path src-tauri/Cargo.toml`                                               | 79 tests             |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Passed               |
| `corepack pnpm tauri build --debug --no-bundle`                                                 | Passed               |
| `corepack pnpm tauri build --no-bundle`                                                         | Passed               |

Real checks:

- `corepack pnpm tauri dev` launched the buddy with Companion Home hidden; the process was stopped
  after the smoke observation.
- Ollama was reachable and local completion models were listed.
- `embeddinggemma:300m` was absent. An already installed `qwen3:8b` correctly returned HTTP 501
  from `/api/embed`; no model was downloaded and lexical fallback remains the honest mode.
- The FarmTown Rust test closes/reopens a real SQLite file, semantically retrieves the project with
  a synthetic normalized vector, preserves the unresolved concern, applies a correction, and
  excludes the deleted episode.

Not verified:

- physical pickup/drop and moving-window following by direct human interaction;
- multi-monitor/mixed-DPI/taskbar/display-change behavior;
- real local-Qwen 20-turn consolidation output;
- real `embeddinggemma:300m` vector generation and end-to-end restart semantic recall;
- complete manual mode walkthrough and machine-specific performance timings.

Task 11 therefore remains open at C12; the correct full completion claim is not made.

## Task 11C C12 baseline - June 27, 2026

- Clean `main` at `ec7bd8a`; no pre-existing worktree changes.
- Reviewed the Task 10 report, both Task 11 report sections, Task 11 plan/journal, inspiration
  record, architecture, decisions, tasks, progress, and the implemented creature/continuity
  boundaries.
- Untouched baseline passed: 44 frontend files / 167 tests, 79 Rust tests, Prettier, ESLint, strict
  TypeScript, frontend build, Rust formatting, clippy with warnings denied, and Tauri debug/release
  no-bundle builds.
- Ollama CLI and `http://127.0.0.1:11434/api/tags` are reachable.
- Required `embeddinggemma:300m` is installed locally. Trading Buddy did not pull or install it.
- C12 real semantic QA is therefore unblocked.

## Task 11C real semantic QA - June 28–29, 2026

- Verified real `/api/embed` single/batch behavior with `embeddinggemma:300m`: 768 finite normalized
  dimensions, three-vector bounded batch, warm observations around 175–181 ms, and missing-model
  HTTP 404. Complete vectors were not logged.
- Completed a real native 20-user/20-assistant Qwen FarmTown transcript with no final failed or
  cancelled messages; the transcript survived a full process shutdown and restart.
- Reproduced and fixed worker-clone cancellation, rapid-turn lock release, new-chat reload,
  completed-status, equal-timestamp ordering, optional-value serialization, embedding-only chat
  discovery, structured-output transport/schema failures, and irrelevant continuity injection.
- Final local Llama consolidation completed in one attempt with one summary, one entity, six
  current-life records, seven persisted embeddings, and semantic status `ready`.
- After restart, the farming-game paraphrase retrieved the “too few users arrive/return” concern
  via `semantic_similarity`; the unrelated movie query returned zero continuity records after the
  relevance fix.
- Two real monitors were detected, including a negative-X secondary monitor. Trading Buddy windows
  were moved there without activation, but direct human drag/drop, mixed-DPI, rotation, display
  removal, and taskbar/scaling permutations were not certified.
- Final gates: 44 frontend files / 168 tests, 88 Rust tests, format, lint, strict TypeScript,
  frontend build, clippy with warnings denied, and Tauri debug/release no-bundle builds passed.
- Task 11 remains open: no valid FarmTown episode/project entity in the final durable run, no live
  correction/deletion, no human pointer certification, and no complete performance/control matrix.
