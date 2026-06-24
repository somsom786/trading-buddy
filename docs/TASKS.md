# Tasks

## Foundation

- [x] Scaffold Tauri 2, React, TypeScript, and Vite.
- [x] Configure pnpm and quality tooling.
- [x] Add buddy and main windows.
- [x] Add tray actions.
- [x] Persist buddy position locally.
- [x] Add foundation tests and documentation.

## BETA v0.1 identity and progress journal

- [x] Label the in-development desktop project BETA v0.1.
- [x] Add the current buddy concept board as a non-production design reference.
- [x] Surface the concept board in the development-only Buddy Lab.
- [x] Create a chronological project progress journal.
- [ ] Convert the approved buddy direction into original production sprite sheets.

## Task 2 — First Living Local Companion

- [x] Preserve existing Tauri windows, tray, focus behavior, and buddy position persistence.
- [x] Detect local Ollama through a Rust-side loopback client.
- [x] List and select locally installed models.
- [x] Prefer the centrally configured `qwen3:4b` model when installed.
- [x] Stream native Ollama chat responses through a Tauri channel.
- [x] Parse partial, multiple, blank, malformed, and final NDJSON records safely.
- [x] Add typed errors, request validation, timeouts, and cancellation.
- [x] Keep conversation state session-only.
- [x] Add deterministic buddy lifecycle states and reduced-motion CSS.
- [x] Add centralized validated cross-window contracts.
- [x] Prevent buddy dragging from opening the main window.
- [x] Add development-only Buddy Lab and mock streaming.
- [x] Add frontend and Rust tests for domain and integration boundaries.
- [x] Verify real Qwen inference and cancellation against a running local Ollama instance.
- [x] Verify closing the main window keeps the buddy alive and the buddy reopens main.
- [x] Re-verify buddy position persistence after Task 2 native changes.
- [ ] Manually click all tray items after Task 2 changes.

Task 2 implementation and automated checks are complete. Native inference, cancellation,
close/reopen behavior, tray-icon presence, and position persistence were verified on Windows. The
three tray menu items still require a direct manual click-through because desktop automation could
not reliably activate the overflow menu.

## Task 3 — Privacy-First Local Conversation Storage

- [x] Add Rust-owned SQLite storage in the app-specific local data directory.
- [x] Add explicit schema migration v1 for metadata, conversations, messages, and app settings.
- [x] Keep raw SQL behind Rust repository functions and typed Tauri commands.
- [x] Persist selected local model, retention policy, and last opened conversation.
- [x] Persist user messages before generation starts.
- [x] Create streaming assistant messages before Ollama generation starts.
- [x] Checkpoint visible assistant content without writing once per token.
- [x] Mark assistant messages completed, cancelled, failed, or interrupted.
- [x] Recover startup `streaming` messages as `interrupted`.
- [x] Add conversation list, loading/empty/error states, new chat, switching, rename, archive,
      restore, delete, and delete-all controls.
- [x] Add explicit temporary chat mode that does not create conversation or message records.
- [x] Add retention policies: keep until delete, delete after 30 days, delete after 90 days.
- [x] Add versioned local JSON export through a native save-file dialog.
- [x] Document that SQLite is local but not application-level encrypted yet.
- [x] Document deletion limitations honestly.
- [x] Add Rust tests for migration, repository, lifecycle, retention, export, cascade deletion, and
      stale request rejection.
- [x] Add frontend tests for storage boundary validation, message decoration, and storage-backed
      chat streaming.
- [ ] Manually verify persistence with a real running Ollama model after this change.
- [ ] Manually verify native save dialog export content.
- [ ] Manually verify delete-all against the real app-local database.
- [ ] Manually re-click tray menu items.

Unresolved limitations:

- The local SQLite database is not application-level encrypted.
- Retention cleanup uses latest conversation activity and does not yet expose per-conversation
  exemptions.
- Only export is implemented; import is deliberately out of scope.
- Journal, memory, trading, crypto integrations, authentication, sync, and autonomous trading remain
  out of scope.

## Task 4 - Desktop QA, Storage UX Hardening, and Release Readiness

- [x] Create a manual desktop QA plan before implementation.
- [x] Run baseline automated validation before hardening changes.
- [x] Smoke-launch the real desktop app and verify the app-local SQLite database is created.
- [x] Add storage diagnostics for schema version, safe database summary, conversation counts,
      message counts, and last retention cleanup.
- [x] Add development-only Storage Lab controls for diagnostics, retention cleanup, and
      interrupted-generation recovery fixtures.
- [x] Harden temporary chat UX with explicit not-saved labeling and exit/transition confirmation.
- [x] Report export success by filename rather than full private path.
- [x] Keep non-completed assistant status metadata separate from stored message content.
- [x] Add frontend tests for storage display helpers, temporary chat persistence behavior, and
      filename-only export feedback.
- [x] Add Rust tests for diagnostics and interrupted-generation recovery fixtures.
- [ ] Complete the full manual desktop QA checklist with direct user-visible interaction.
- [ ] Manually click all tray menu items.
- [ ] Manually verify native save-dialog export content in the real desktop app.

Task 4 automated checks and release-readiness hardening are complete. The real desktop smoke test
verified launch and database creation, but the full desktop checklist remains partially unverified
because WebView content and tray overflow interactions were not reliably controllable through the
available automation.

## Task 5 - Companion-First Desktop Experience

- [x] Run baseline validation before implementation.
- [x] Keep Companion Home hidden by default while the buddy starts visible.
- [x] Add a separate transparent, taskbar-skipped conversation bubble window.
- [x] Change single-click buddy behavior to toggle the bubble instead of opening Companion Home.
- [x] Keep explicit Companion Home actions from the bubble, tray, and main-window controls.
- [x] Stream local Ollama responses from the bubble through the existing conversation reducer and
      storage commands.
- [x] Add bubble cancellation and Escape-to-collapse behavior.
- [x] Add typed `BuddyEmotion`, `BuddyActivity`, and `BuddyVisualState` domain concepts.
- [x] Extend the placeholder renderer with breathing, blinking, looking, listening, thinking,
      talking, concerned, happy, sitting, sleeping, waking, and stretching distinctions.
- [x] Add deterministic ambient-life domain logic with injected time/randomness and reduced-motion
      support.
- [x] Add narrow OS idle-duration command without input capture or screen inspection.
- [x] Add deterministic proactive check-in domain logic with template content, cooldown, quiet
      hours, Do Not Disturb, and busy-state gates.
- [x] Add placement domain logic for free floating, dock left, dock right, taskbar perch, monitor
      recovery, work-area clamping, and bubble-side flipping.
- [x] Persist typed companion preferences in Rust-owned SQLite settings.
- [x] Update tray actions around the companion-first model: Talk, Open Companion Home, Show Buddy,
      Hide Buddy, Sleep, Wake, Do Not Disturb, Reset Position, Quit.
- [x] Rename/reframe the full window as Companion Home and add a return-to-buddy action.
- [x] Expand the development-only Buddy Lab into a Companion Lab preview for emotion/activity,
      proactive templates, and placement modes.
- [x] Add frontend tests for visual state, ambient life, proactive gates, placement, bubble
      behavior, and view routing.
- [x] Add Rust tests for companion preference persistence and native placement/clamp helpers.
- [ ] Implement user-facing docking controls that actively snap the native buddy to each persisted
      placement mode.
- [ ] Implement a native right-click buddy context menu.
- [ ] Implement global shortcut registration.
- [ ] Implement launch-at-login integration.
- [ ] Prove full shared active-generation handoff between bubble and Companion Home in a real
      desktop session.
- [ ] Manually verify the complete Task 5 desktop checklist with real WebView/tray interaction.

Task 5 establishes the companion-first shell and core deterministic architecture, but several OS
integration and manual-desktop verification items remain intentionally pending. The global shortcut
and launch-at-login settings are persisted but not yet wired to OS behavior.

## Art integration - Temporary buddy pose asset pack

- [x] Preserve the source reference sheet under `src/assets/buddy/source/`.
- [x] Create a reproducible pose extraction script.
- [x] Generate ten normalized transparent pose PNGs.
- [x] Use a shared 128×128 logical canvas.
- [x] Align standing poses to a consistent baseline.
- [x] Keep runtime code off the full source sheet.
- [x] Add a typed pose ID union and central asset manifest.
- [x] Add deterministic `BuddyVisualState` to pose selection.
- [x] Replace the normal CSS placeholder with the extracted pose renderer.
- [x] Keep the CSS placeholder as a fallback.
- [x] Add temporary pose-based breathing, looking, listening, thinking, talking, writing, happy,
      proud, and sleeping motion.
- [x] Respect reduced-motion behavior.
- [x] Prevent native image drag ghosts.
- [x] Expand Companion Lab to preview poses, selected pose ID, natural dimensions, motion toggles,
      scale, reduced motion, and missing-asset fallback.
- [x] Add tests for manifest coverage, source-sheet exclusion, pose-selection priority, generated
      PNG transparency, canvas dimensions, alpha corners, baseline alignment, and source-dimension
      rejection.
- [ ] Complete direct manual visual QA in the real desktop application.
- [ ] Perform artist cleanup for generated-art inconsistencies and production animation frames.

The pose pack is temporary. It is extracted from concept/reference art and should not be treated as
production-ready animation.

## Next — requires separate product approval

- [ ] Add official Tauri/native global-shortcut integration with registration-failure handling.
- [ ] Add launch-at-login integration and settings UI.
- [ ] Add user-facing companion preference controls for docking, quiet hours, Do Not Disturb,
      ambient motion, and startup behavior.
- [ ] Complete a direct human QA run against the Task 5 desktop checklist.
- [ ] Design a local persistence schema for journal and settings data.
- [ ] Add navigation state and empty feature routes.
- [ ] Define validated domain types for journal entries and reviews.
- [ ] Create threat models for read-only exchange integrations.
- [ ] Evaluate an optional model boundary with strict structured-output validation.
- [ ] Add accessibility and multi-monitor window behavior testing.

The unchecked items are planning notes, not authorization to implement integrations or model
features.

## Task 6 - Transparent Local Companion Memory

- [x] Run baseline validation before implementation.
- [x] Add schema v3 with typed memory preferences, `memories`, `memory_fts`, and
      `memory_usage_records`.
- [x] Keep memory persistence behind Rust repository functions and typed Tauri commands.
- [x] Preserve approved memories when source conversations are deleted by detaching provenance.
- [x] Add deterministic explicit memory intent detection.
- [x] Add deterministic candidate pre-filtering.
- [x] Add deterministic fake-secret detection and storage-boundary secret rejection.
- [x] Add local Qwen structured extraction prompt construction and strict frontend candidate
      validation.
- [x] Keep model-proposed candidates unable to write directly to SQLite.
- [x] Default to ask-every-time memory approval.
- [x] Retrieve only confirmed, non-expired, non-superseded memories.
- [x] Exclude sensitive memories from default retrieval and export.
- [x] Build labelled confirmed-memory context below the system prompt.
- [x] Add memory-used usage records with IDs and reason codes only.
- [x] Add desktop bubble memory proposal card.
- [x] Add Companion Home **What Buddy Knows About Me** with confirmed, pending, expiring, rejected,
      settings, search, filters, sort, edit, confirm, reject, delete, delete-all, and export.
- [x] Keep temporary chats from creating durable memory and default them away from existing-memory
      retrieval.
- [x] Add separate memory JSON export.
- [x] Add Rust tests for preferences, lifecycle, retrieval exclusions, secret rejection, provenance
      detachment, usage logging, export, and memory deletion separation.
- [x] Add frontend tests for intent detection, pre-filtering, structured extraction validation,
      secret detection, and memory context construction.
- [ ] Complete full real-desktop local-Qwen manual verification of remember/restart/retrieve/edit/
      delete/export scenarios.
- [ ] Add full conflict-resolution UX for contradictory memories.
- [ ] Add bulk natural-language forgetting by category/source.
- [ ] Add fixture-scale development Memory Lab controls for 100/1,000 memory performance runs.
- [ ] Add restore/extend/convert temporary memory controls beyond the basic edit/delete path.
- [ ] Add exhaustive shared queue synchronization tests across separate bubble and Companion Home
      webviews.

Task 6 establishes the durable transparent memory foundation. Some advanced UX and manual-QA
acceptance items remain pending and are recommended for Task 7 rather than being silently claimed.

## Task 7 - Memory Reliability, Conflict Resolution, Forgetting, and Desktop QA

- [x] Run baseline validation before implementation.
- [x] Write `docs/qa/TASK-007-memory-qa-plan.md` before implementation.
- [x] Add deterministic conflict classification for duplicate, update, conflict, and unrelated
      memories.
- [x] Add deterministic natural-language forgetting resolution for exact, ambiguous, category,
      all, and not-found requests.
- [x] Wire exact forget requests into both Companion Home and Bubble chat flows.
- [x] Keep broad/ambiguous forget requests confirmation-first instead of bulk-deleting.
- [x] Add superseding behavior for confirmed memory updates.
- [x] Keep proposed updates from superseding old memories until confirmation.
- [x] Add Memory Lab diagnostics and bounded 100/1,000 fixture generation/cleanup.
- [x] Move Rust memory listing filters into SQLite for bounded list behavior.
- [x] Add restore and remove-expiry controls for temporary/rejected/expired memories.
- [x] Add stable retrieval reason codes.
- [x] Verify local Qwen availability through Ollama loopback.
- [x] Smoke-launch the real desktop debug build and visually verify the buddy window.
- [x] Run frontend checks, Rust tests, clippy, Vite build, and Tauri debug/release no-bundle
      builds.
- [ ] Complete fully driven real-desktop local-Qwen remember/confirm/retrieve/forget/export QA in
      the WebView UI.
- [ ] Add full cross-WebView proposal queue synchronization tests.
- [ ] Add richer user-facing conflict-resolution UI for contradictory memories.
- [ ] Add selectable bulk forget confirmation UI for category/source requests.

Task 7 hardens memory reliability and adds development tooling. The remaining unchecked items need
direct human WebView interaction or additional UX design rather than silent automation claims.
