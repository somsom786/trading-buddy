# Task 10 QA Plan — Creature-First Mission Reset

**Date:** 2026-06-26
**Project label:** Trading Buddy BETA v0.2
**Mission:** Shimeji body, Odysseus brain, crypto-native soul.

## Safety and licensing boundary

- Preserve the existing read-only Hyperliquid foundation as an optional skill.
- Stop Task 9E after its completed E1 checkpoint.
- Do not add exchange WebSockets, execution, wallet signing, secrets, cloud memory, telemetry,
  screen capture, OCR, keylogging, clipboard monitoring, or application-content inspection.
- Desktop awareness is geometry-only. Window titles, process names, application names, URLs,
  pixels, text, and accessibility trees are prohibited.
- Shimeji is behavioral inspiration only. Do not use its character packs, art, or extension code.
- Odysseus is an AGPL-3.0-or-later architectural reference only. Do not copy, adapt, translate,
  vendor, or derive code, prompts, tests, or assets from it.

## Baseline

Run before implementation:

1. `corepack pnpm check`
2. `corepack pnpm build`
3. `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
4. `cargo test --manifest-path src-tauri/Cargo.toml`
5. `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
6. `corepack pnpm tauri build --debug --no-bundle`
7. `corepack pnpm tauri build --no-bundle`
8. `git diff --check`

## Checkpoints

1. **M1 — Research, licensing, product reset, baseline**
   - Inspect the current repository, migrations, reports, QA journals, native capabilities,
     windows, companion engine, model boundary, memory, journal, and trading skill.
   - Study the required Shimeji and Odysseus references.
   - Record the independent-implementation and licensing boundary.
   - Make product docs and Companion Home hierarchy creature-first.
   - Mark Task 9E paused without deleting its completed work.
2. **M2 — Desktop world model and geometry privacy**
   - Add typed monitor, work-area, visible-window-rectangle, buddy, bubble, and optional cursor
     geometry.
   - Implement Windows geometry collection without title/process/content access.
   - Add a monitor/work-area-only fallback for unsupported platforms.
   - Validate the native boundary in TypeScript.
   - Add tests for negative coordinates, sanitization, exclusions, and malformed payloads.
3. **M3 — Movement, physics, drag/drop, and safe recovery**
4. **M4 — Animation architecture and autonomous planner**
5. **M5 — Companion identity and deterministic internal state**
6. **M6 — Episodic/entity schema and compatibility migration**
7. **M7 — Local embeddings and hybrid retrieval**
8. **M8 — Context compaction and conversation continuity**
9. **M9 — Background consolidation**
10. **M10 — Conversation modes and presence experience**
11. **M11 — Local-model onboarding and offline modes**
12. **M12 — Privacy dashboard and development labs**
13. **M13 — Performance, manual QA, and final documentation**

Only checkpoints that end buildable, tested, and honest may be marked complete.

## M1 acceptance checks

- Task 9E is explicitly paused.
- Product hierarchy starts with the living creature and ends with optional skills/settings.
- Companion Home navigation shows Companion, Conversations, Memory, Journal, Skills, Privacy, and
  Settings.
- Trading is described and presented as an optional skill.
- Inspiration and AGPL licensing boundaries are documented.

## M2 acceptance checks

- The native API returns geometry only.
- Multiple monitors, negative coordinates, scale factors, work areas, and off-screen filtering are
  represented.
- Minimized windows are excluded on Windows.
- Buddy and bubble rectangles are excluded from visible application surfaces.
- Cursor coordinates are absent unless explicitly requested.
- No title/process/application/content field exists in the DTO.
- Unsupported platforms make no unverified visible-window claims.

## Final verification for each completed checkpoint

Run the baseline commands again, plus focused tests for the checkpoint. Native changes require both
Tauri no-bundle builds. Do not mark manual desktop scenarios passed unless they were performed.
