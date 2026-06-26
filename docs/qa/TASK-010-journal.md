# Task 10 QA Journal — Creature-First Mission Reset

**Date:** 2026-06-26
**Project label:** Trading Buddy BETA v0.2

## Repository and reference inspection

- Inspected project conventions, README, product/MVP/architecture/decision/task/progress docs,
  Task 3–9 reports, QA plans/journals, all seven SQLite migrations, native capabilities, window and
  tray management, buddy/bubble renderers, companion state modules, memory workflow, journal
  boundary, Ollama provider, context construction, and Hyperliquid module boundaries.
- Studied the live Shimeji website on 2026-06-26. Its useful product lesson is persistent,
  non-conversational physical presence: independent movement, screen-surface interaction, and
  direct mouse pickup/drag.
- Inspected Odysseus commit `a9b208f4704da8ff36c8cf8700c0310bfd06065e` from 2026-06-26,
  including every file required by the task brief and its AGPL-3.0-or-later license.
- No Shimeji art/code or Odysseus code/prompts/tests/assets were copied into Trading Buddy.

## Untouched baseline

| Command                                                                                         | Result | Notes                            |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------------------- |
| `corepack pnpm check`                                                                           | Passed | 38 test files, 136 tests.        |
| `corepack pnpm build`                                                                           | Passed | Vite production build completed. |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check`                                        | Passed | Rust formatting clean.           |
| `cargo test --manifest-path src-tauri/Cargo.toml`                                               | Passed | 66 Rust tests.                   |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Passed | No warnings.                     |
| `corepack pnpm tauri build --debug --no-bundle`                                                 | Passed | Debug executable built.          |
| `corepack pnpm tauri build --no-bundle`                                                         | Passed | Release executable built.        |
| `git diff --check`                                                                              | Passed | Working tree had no changes.     |

Pre-existing failures: none observed.

## M1 implementation

- Reset product documentation to the hierarchy: living creature, companion soul, local
  intelligence, local memory, optional skills.
- Marked Task 9E paused after E1 and preserved the existing Hyperliquid foundation as a read-only
  optional skill.
- Updated Companion Home navigation to Companion, Conversations, Memory, Journal, Skills, Privacy,
  and Settings.
- Moved the existing Trading panel beneath an explicit Skills surface without changing its
  read-only behavior.
- Added `docs/references/COMPANION_INSPIRATION.md` with research, independent implementation, and
  AGPL boundaries.

## M2 implementation

- Added `src-tauri/src/desktop_world.rs` with a platform adapter boundary and typed geometry-only
  snapshots.
- Windows collection uses monitor/work-area, visible-window-rectangle, and optional cursor
  geometry APIs only.
- Minimized windows are excluded before rectangle collection.
- Invalid, off-screen, duplicate, buddy, and bubble rectangles are removed before returning the
  snapshot. Results are bounded to 256 rectangles.
- Cursor position is not queried or returned unless the caller sets `includeCursor`.
- Unsupported platforms expose monitor-only fallback semantics and make no visible-window claim.
- Added strict TypeScript runtime validation and a narrow Tauri service.
- Added Rust tests for negative coordinates, filtering, DTO privacy, and a real Windows
  monitor/work-area API probe.
- Added frontend tests for multi-monitor/scale-factor payloads, cursor typing, malformed geometry,
  and support labels.

## Issues found during implementation

1. The first focused Rust compile failed because `windows-sys` C structs do not implement
   `Default`. Explicit zeroed field initializers fixed the binding mismatch.
2. Strict TypeScript rejected an indirect point-to-rectangle narrowing. The rectangle guard now
   validates `x`, `y`, `width`, and `height` directly.
3. The real Windows geometry probe found an `i32` subtraction overflow in approximate rectangle
   comparison. Comparisons now widen to `i64` before subtraction.

All three fixes were retested successfully.

## Final automated verification

| Command                                                                                         | Result | Notes                           |
| ----------------------------------------------------------------------------------------------- | ------ | ------------------------------- |
| `corepack pnpm format`                                                                          | Passed | Repository formatted.           |
| `corepack pnpm check`                                                                           | Passed | 39 test files, 140 tests.       |
| `corepack pnpm build`                                                                           | Passed | Vite production build.          |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check`                                        | Passed | Rust formatting clean.          |
| `cargo test --manifest-path src-tauri/Cargo.toml`                                               | Passed | 70 Rust tests.                  |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` | Passed | No warnings.                    |
| `corepack pnpm tauri build --debug --no-bundle`                                                 | Passed | Debug executable built.         |
| `corepack pnpm tauri build --no-bundle`                                                         | Passed | Release executable built.       |
| Debug executable smoke launch                                                                   | Passed | Process remained alive for 4 s. |

## Manual QA

- A machine-local Windows API test confirmed at least one real monitor and valid work-area geometry.
- The debug desktop executable launched and remained running for the smoke interval.
- Multi-monitor movement, negative-coordinate placement in the real app, mixed DPI, taskbar
  position changes, rotation, display disconnect/reconnect, visible-window following, and cursor
  behavior were not manually exercised.
- No Task 10 movement, drag/drop physics, surface following, memory continuity, or conversation-mode
  scenario is claimed as passed.

## Continuation point

M1 and M2 are complete. Continue at M3: deterministic movement/physics, drag/drop recovery, safe
spawn/out-of-bounds recovery, and a tray-level Bring Buddy Back path. M4 and later remain pending.
