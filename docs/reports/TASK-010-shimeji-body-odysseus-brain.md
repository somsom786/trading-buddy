# Task 10 Report — M1/M2 Creature-First Reset

**Date:** 2026-06-26
**Project label:** Trading Buddy BETA v0.2
**Status:** M1 and M2 complete. M3–M13 remain pending.
**Audience:** GPT-5.5 task author / durable GitHub project journal

## Outcome

Trading Buddy is now explicitly organized around a living local desktop creature rather than a
trading dashboard with a mascot. Task 9E is paused after its completed E1 setting migration, and
the existing read-only Hyperliquid work remains operational beneath an optional Skills layer.

The first native creature prerequisite is implemented: a typed, geometry-only desktop-world
snapshot for monitors, usable work areas, sanitized Windows top-level window rectangles,
buddy/bubble geometry, and explicit cursor opt-in.

This report does not claim that movement, physics, animation, semantic memory, context compaction,
consolidation, conversation modes, or the full Task 10 mission is complete.

## Baseline repository state

The repository entered Task 10 clean at commit `4fd7817`.

Untouched baseline:

- frontend: 38 Vitest files / 136 tests passed;
- Rust: 66 tests passed;
- Prettier, ESLint, strict TypeScript, Rust fmt, and Clippy with warnings denied passed;
- frontend production build passed;
- Tauri debug and release no-bundle builds passed;
- `git diff --check` passed.

Pre-existing failures: none observed.

## External-reference research

### Shimeji

The current [shimejis.xyz](https://shimejis.xyz/) experience was studied for interaction
principles: persistent character presence, autonomous movement, surface interaction, and direct
pickup/drag. No Shimeji character, art, sprite, action data, or extension code was used.

### Odysseus

The current
[pewdiepie-archdaemon/odysseus](https://github.com/pewdiepie-archdaemon/odysseus) repository was
inspected at commit `a9b208f4704da8ff36c8cf8700c0310bfd06065e`, including every file required by
the mission brief.

Useful concepts included:

- durable transcripts separate from memory;
- explicit memory operations;
- provider-neutral memory boundaries and degradation;
- semantic retrieval with lexical fallback;
- model/context discovery and budgeting;
- compaction that preserves recent context;
- bounded, restart-aware background jobs;
- untrusted external and memory context.

Odysseus declares AGPL-3.0-or-later. No code, prompt, test, schema, documentation text, or asset was
copied, adapted, translated, or vendored. The full record is in
`docs/references/COMPANION_INSPIRATION.md`.

## M1 — Product and architecture reset

- Reframed the product hierarchy as:
  1. living desktop creature;
  2. companion identity and emotional presence;
  3. natural local conversation;
  4. long-term continuity;
  5. journal/routines;
  6. optional skills;
  7. Companion Home.
- Updated Companion Home navigation to Companion, Conversations, Memory, Journal, Skills, Privacy,
  and Settings.
- Grouped the existing Trading panel under an explicit Skills surface.
- Documented that trading does not initialize with the buddy or enter unrelated conversation
  context.
- Added relationship boundaries: no affection score, jealousy, guilt, fake consciousness, or
  dependency mechanics.
- Preserved local Ollama as the default intelligence boundary and offline creature behavior as a
  product requirement.
- Marked Task 9E E2+ paused in task tracking.

## M2 — Desktop world architecture

### Native contract

`src-tauri/src/desktop_world.rs` adds:

- `Point`;
- `SurfaceRect`;
- `MonitorSurface`;
- `WorkArea`;
- `DesktopWorldSnapshot`;
- `SurfaceSupport`;
- an internal platform adapter boundary.

The Tauri command `get_desktop_world_snapshot` accepts `includeCursor`. Cursor collection defaults
off.

### Windows implementation

Windows uses operating-system geometry APIs to collect:

- all monitor bounds;
- monitor work areas;
- Tauri-reported monitor scale factors;
- visible, non-minimized top-level window rectangles;
- optional cursor position.

Before returning data, the service:

- removes zero/invalid rectangles;
- removes rectangles that do not intersect a monitor;
- removes buddy and visible bubble rectangles;
- sorts and deduplicates results;
- caps visible surfaces at 256.

Unsupported platforms currently return monitor geometry through Tauri and identify themselves as
`monitor_only_fallback`. No macOS or Linux visible-window support is claimed.

### Privacy boundary

The DTO contains no field for:

- window titles;
- application or process names;
- browser URLs;
- pixels or screenshots;
- screen/application text;
- keyboard input;
- clipboard content;
- accessibility-tree data.

The Windows implementation never calls APIs for those values. Rust serialization tests and
TypeScript boundary tests enforce the geometry-only shape.

### Frontend boundary

`src/domain/desktop-world/types.ts` defines the framework-independent contract and strict runtime
guard. `src/services/tauri/desktopWorldService.ts` is the only frontend native adapter. No creature
component imports Windows or Tauri geometry APIs directly.

M2 is snapshot-on-demand. It does not introduce an unbounded poll loop, idle CPU loop, per-tick
database writes, or automatic cursor tracking.

## Tests added

Frontend:

- accepts multiple monitors, negative coordinates, work areas, and scale factors;
- validates optional cursor points;
- rejects malformed rectangles and unsupported support labels;
- confirms the contract does not model identity/content fields.

Rust:

- filters invalid, off-screen, duplicate, buddy, and bubble rectangles;
- preserves partial intersection on a negative-coordinate monitor;
- checks serialized geometry contains no prohibited identity/content keys;
- probes real Windows monitor/work-area APIs on this machine.

The real probe exposed and led to a fix for `i32` overflow in extreme rectangle comparisons.

## Files created

- `docs/qa/TASK-010-plan.md`
- `docs/qa/TASK-010-journal.md`
- `docs/references/COMPANION_INSPIRATION.md`
- `docs/reports/TASK-010-shimeji-body-odysseus-brain.md`
- `src-tauri/src/desktop_world.rs`
- `src/domain/desktop-world/types.ts`
- `src/domain/desktop-world/types.test.ts`
- `src/services/tauri/desktopWorldService.ts`

## Notable files changed

- `README.md`
- `docs/PRODUCT.md`
- `docs/MVP.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/TASKS.md`
- `docs/PROGRESS.md`
- `src-tauri/Cargo.toml`
- `src-tauri/src/lib.rs`
- `src/views/MainView.tsx`
- `src/views/MainView.test.tsx`
- `src/components/chat/ChatWorkspace.tsx`
- `src/styles.css`

## Final verification

Passed:

- `corepack pnpm format`
- `corepack pnpm format:check`
- `corepack pnpm lint`
- `corepack pnpm typecheck`
- `corepack pnpm test` — 39 files / 140 tests
- `corepack pnpm build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- `cargo test --manifest-path src-tauri/Cargo.toml` — 70 tests
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `corepack pnpm tauri build --debug --no-bundle`
- `corepack pnpm tauri build --no-bundle`
- debug executable smoke launch — process remained alive for four seconds

## Not verified

- direct invocation/readback of a full snapshot through a live WebView;
- real multi-monitor and negative-coordinate buddy movement;
- mixed-DPI transitions;
- taskbar relocation, resolution changes, or display rotation;
- monitor disconnect/reconnect;
- real visible-window surface following;
- cursor-aware creature behavior;
- M3 movement/physics and every later checkpoint;
- prior Task 9D manual WebView fixture QA.

## Security confirmation

No screen capture, OCR, title collection, process collection, application-content reading,
keylogging, clipboard monitoring, telemetry, cloud memory, private-key handling, wallet signing,
exchange write path, trade execution, or autonomous trading was added.

Hyperliquid remains a preserved, read-only optional skill.

## Recommended next checkpoint

Proceed with **M3 only**:

1. define a deterministic fixed-timestep creature motion model;
2. add velocity, acceleration, gravity, terminal velocity, landing, edges, and destination
   tolerance;
3. integrate drag/drop and recover states without pretending static poses are animation clips;
4. clamp restored and moving positions to current work areas;
5. add a tray action named **Bring Buddy Back**;
6. verify safe spawn, out-of-bounds recovery, negative coordinates, and model-offline movement;
7. stop with a coherent passing M3 report before M4.
