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
