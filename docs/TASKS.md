# Tasks

## Task 12 - Hermes/Petdex architectural reformation

- [x] Tag the preserved pre-reformation Tauri baseline.
- [x] Fork Hermes Agent to `somsom786/hermes-agent`.
- [x] Add Hermes as a submodule under `next/agent`.
- [x] Create a reversible `next/` reformation track.
- [x] Build a Petdex-compatible Trading Buddy pet pack from local temporary pose assets.
- [x] Validate Petdex manifests and atlas dimensions.
- [x] Add a local-first trader companion soul package.
- [x] Add a trader companion skill.
- [x] Add a no-tools Hermes companion toolset.
- [x] Rebrand the Hermes Desktop preview to Trading Buddy BETA v0.2.
- [x] Start the preview companion-first: buddy visible, main window hidden.
- [x] Add companion tray actions and Bring Buddy Back behavior.
- [x] Add an isolated local development launcher.
- [x] Verify pet click to composer, local Ollama streaming, persisted Hermes session, and zero tool
      calls.
- [x] Document repository audit, target architecture, migration stance, tool safety, pet runtime,
      trader core, QA plan, QA journal, and handoff report.
- [x] Surface existing Petdex skin selection from the buddy bubble, pet menu, and tray.
- [x] Add a warmer compact buddy bubble and custom game-like pet menu checkpoint.
- [x] Document Task 12B QA plan, QA journal, pet experience direction, upstream baseline, and
      handoff report.
- [ ] Manually verify Petdex skin switching persists across relaunch.
- [ ] Complete Task 12B real desktop companion manual QA.
- [ ] Clean or pin unrelated upstream Hermes Desktop lint/test failures.
- [ ] Package the Hermes preview as a repeatable developer build.
- [ ] Complete multi-monitor human QA.
- [ ] Decide and implement a Tauri-to-Hermes data migration strategy.

## Task 11 — Core companion completion

The frontend-wide redesign remains postponed. This task is proceeding through coherent,
independently passing checkpoints.

### Current checkpoint status

- [x] C1 — Audit Task 10, refresh mandatory references, establish a clean baseline, and create the
      Task 11 plan and QA journal.
- [x] C2 — Add deterministic fixed-timestep physics, gravity, landing, safe spawn/recovery,
      native work-area clamping, and Bring Buddy Back.
- [x] C3A — Complete drag/drop state, conservative moving surfaces, persistent movement settings,
      and offline autonomy.
  - [x] Click-versus-drag threshold and one native drag owner.
  - [x] Dropped, fall, land, and recover transitions, including reduced-motion safe placement.
  - [x] Monitor-floor and expiring geometry-only window-top surfaces.
  - [x] Seeded autonomous idle, walk, sit, sleep, and writing decisions with cooldowns.
  - [x] Activity-specific bounded world snapshot scheduling.
  - [x] Conservatively follow a moving window surface.
  - [x] Expose autonomous-movement enablement and low/medium/lively intensity in product UI.
  - [ ] Complete direct manual drag/drop, window-surface, multi-monitor, DPI, and tray QA.
- [x] C4 — Add animation intent, pose anchors/hitboxes, diagnostics, and Creature Lab.
- [x] C5 — Document compatibility and migrate existing data safely to schema v9.
- [x] C6 — Add structured summaries and deterministic bounded context budgeting.
- [x] C7 — Add loopback Ollama embeddings and validated SQLite float32 vector persistence.
- [x] C8 — Add episodes, entities/aliases/relationships, and current-life context.
- [x] C9 — Add bounded hybrid retrieval with lexical fallback and inspectable reasons.
- [x] C10 — Add persistent consolidation, retry/coalescing, and startup recovery.
- [x] C11 — Add conversation modes, inspectable identity state, continuity controls, and labs.
- [ ] C12 — Finish performance and full manual QA.
  - [x] Full automated/frontend/native build validation.
  - [x] Disk-backed FarmTown restart, correction, and deletion proof with synthetic vectors.
  - [x] Real native launch with Companion Home hidden.
  - [x] Real 20-turn local-Qwen transcript and full-process restart.
  - [x] Real `embeddinggemma:300m` generation, persistence, and bounded batch verification.
  - [x] Real post-restart semantic paraphrase retrieval with unrelated-query exclusion.
  - [ ] Real pickup/drop, moving-surface, multi-monitor, DPI, and mode walkthrough.
  - [ ] Produce a valid FarmTown episode/project entity and complete live correction/deletion.
  - [ ] Complete the requested bounded performance matrix and missing transparency controls.

## Task 10 — Creature-first mission reset

Mission: **Shimeji body. Odysseus brain. Crypto-native soul.**

### M1 — Research, licensing, product reset, baseline

- [x] Inspect the repository, migrations, native capabilities, companion, model, memory, journal,
      and optional trading boundaries.
- [x] Study the current Shimeji interaction model as behavioral inspiration.
- [x] Inspect the required current Odysseus files as an AGPL architectural reference.
- [x] Document independent implementation and licensing boundaries.
- [x] Run the untouched full validation baseline with no pre-existing failures.
- [x] Make product docs and Companion Home navigation creature-first.
- [x] Move Trading conceptually and visually under optional Skills.
- [x] Pause Task 9E without deleting its completed read-only foundation.

### M2 — Desktop world model and geometry privacy

- [x] Add a typed native desktop-world snapshot.
- [x] Add Windows monitor bounds, work areas, scale factors, and geometry-only visible window
      rectangles.
- [x] Exclude minimized, invalid, off-screen, buddy, and bubble rectangles.
- [x] Make cursor position explicit opt-in.
- [x] Add monitor-only fallback semantics for unsupported platforms.
- [x] Add a narrow TypeScript service and strict runtime validation.
- [x] Add privacy, negative-coordinate, sanitization, and malformed-boundary tests.
- [ ] Perform manual multi-monitor, DPI, taskbar, rotation, and window-surface QA.

### M3–M13 — Pending

- [ ] M3 — Movement, physics, drag/drop, and safe recovery.
- [ ] M4 — Animation architecture and autonomous planner.
- [ ] M5 — Companion identity and deterministic internal state.
- [ ] M6 — Episodic/entity schema and compatibility migration.
- [ ] M7 — Local embeddings and hybrid retrieval.
- [ ] M8 — Context compaction and conversation continuity.
- [ ] M9 — Background consolidation.
- [ ] M10 — Conversation modes and presence experience.
- [ ] M11 — Local-model onboarding and offline modes.
- [ ] M12 — Privacy dashboard and development labs.
- [ ] M13 — Performance, manual QA, and final documentation.

## Foundation

- [x] Scaffold Tauri 2, React, TypeScript, and Vite.
- [x] Configure pnpm and quality tooling.
- [x] Add buddy and main windows.
- [x] Add tray actions.
- [x] Persist buddy position locally.
- [x] Add foundation tests and documentation.

## Task 9B — Read-Only Hyperliquid Provider Foundation

- [x] Research current official Hyperliquid read-only API docs and document the contract.
- [x] Add typed mainnet/testnet environment mapping to official allowlisted hosts.
- [x] Add explicit read-only capabilities and avoid all execution/write capability types.
- [x] Add deterministic public address validation and normalization.
- [x] Add exact decimal-string validation for financial provider values.
- [x] Add official-shaped DTO parsing and normalized local trading objects.
- [x] Add synthetic Hyperliquid fixtures for metadata, mids, accounts, fills, funding, orders,
      duplicates, malformed data, and provider/rate-limit errors.
- [x] Add SQLite schema v5 for integration accounts, sync state, metadata, snapshots, positions,
      fills, funding, open orders, and sync runs.
- [x] Add Rust repository tests for account creation, duplicate rejection, idempotent fills/funding,
      and local data deletion.
- [x] Add a read-only sync path using fixture data and the official allowlisted REST transport.
- [x] Add narrow Tauri commands for validation, account management, sync, lists, and diagnostics.
- [x] Add frontend trading domain guards, formatting, freshness labels, and deterministic read-only
      execution refusal intent.
- [x] Add a minimal Companion Home Trading section.
- [ ] Complete live Hyperliquid QA with an explicit public test address.
- [ ] Add WebSocket live sync. Deferred.
- [ ] Add charts, risk rules, alerts, recommendations, and execution. Deferred and out of scope.

## Task 9C - Hyperliquid foundation hardening checkpoint

- [x] Add SQLite schema v6 for fixture scenario identity.
- [x] Add deterministic per-scenario synthetic fixture addresses.
- [x] Add active sync coalescing, progress state, and cooperative cancellation.
- [x] Record cancelled and failed sync runs without replacing last successful saved data.
- [x] Add slow/cancel/duplicate-heavy/performance fixture scenarios.
- [x] Add frontend scenario, diagnostics, sync progress, and cancellation service methods.
- [x] Add development-only Trading Lab for fixture QA.
- [x] Add coordinator and performance fixture tests.
- [ ] Manually verify Trading Lab fixture creation, repeat sync, cancellation, and performance
      timings in the desktop app.
- [x] Add desktop buddy quick actions for read-only trading facts.
- [x] Add bounded local-Qwen trading context for locally stored read-only trading facts.
- [ ] Complete optional live public-address QA when a test address is provided.

## Task 9D - Desktop trading awareness and bounded context

- [x] Preserve the strict read-only Hyperliquid boundary.
- [x] Add deterministic active-account selection helpers.
- [x] Persist and share the selected Hyperliquid account between Companion Home and the desktop
      bubble.
- [x] Add compact desktop bubble trading cards for account facts, positions, recent fills, funding,
      open orders, and sync progress.
- [x] Add selected-account refresh and cancel controls without adding any order/execution
      capability.
- [x] Add exact string-based funding total calculation for frontend display.
- [x] Tighten trading intent detection and deterministic execution refusal.
- [x] Add a bounded trading context builder for saved read-only facts.
- [x] Route bubble trading fact questions through bounded context when a local model is selected.
- [x] Keep trading fact cards and deterministic refusal useful when Ollama is offline.
- [x] Keep trading facts out of automatic memory and journal proposal flows.
- [x] Add Trading Lab bounded-context preview controls.
- [x] Add frontend tests for active-account runtime helpers, context building, exact decimal sums,
      and intent/refusal behavior.
- [ ] Manually verify the new bubble trading cards in the real desktop WebView.
- [ ] Manually verify the Trading Lab fixture smoke checklist in the real desktop WebView.
- [ ] Record machine-specific performance fixture timings from the real desktop app.
- [ ] Complete optional live public-address QA when a test address is provided.

## Task 9E - Live sync and reconstruction foundation

**Status:** Paused by Task 10 after E1. Preserve the completed read-only foundation; do not continue
E2+ during the creature-first mission.

### E1 - Rust-owned active-account setting

- [x] Create Task 9E QA plan and journal.
- [x] Run and record baseline validation.
- [x] Add schema v7 for `app_settings.active_hyperliquid_account_id`.
- [x] Add typed read/update commands for active Hyperliquid account selection.
- [x] Emit sanitized active-account change events to Companion Home and the desktop bubble.
- [x] Remove browser `localStorage` as the durable active-account source of truth.
- [x] Migrate/remove the legacy Task 9D browser key once where safe.
- [x] Preserve selection on pause/disconnect.
- [x] Clear selection on account deletion through the app-settings foreign key.
- [x] Repair invalid stored account IDs by clearing the setting.
- [x] Add Rust and frontend tests for active-account persistence and migration behavior.
- [ ] Manually verify active-account cross-window behavior in the real desktop WebView.

### E2+ - Still pending

- [ ] Paused: research and document the current official Hyperliquid WebSocket contract.
- [ ] Add official allowlisted WebSocket host mapping.
- [ ] Add typed read-only subscription model.
- [ ] Add Rust-owned live connection lifecycle and generation IDs.
- [ ] Add bounded reconnect and stale-generation rejection.
- [ ] Add HTTP reconciliation after startup/reconnect/resume.
- [ ] Add controlled live persistence strategy.
- [ ] Add trade-episode reconstruction schema and engine.
- [ ] Add trading-session reconstruction schema and engine.
- [ ] Add Companion Home live-state, episode, and session UX.
- [ ] Add desktop live-status/recent-episode/current-session cards.
- [ ] Extend bounded local-Qwen context with derived reconstruction facts.
- [ ] Add WebSocket fixture lab and performance fixtures.
- [ ] Complete manual fixture QA and optional live public-account QA.

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

## Task 8 - Conversational Journaling Foundation

- [x] Inspect Task 8 gate before starting Hyperliquid work.
- [x] Add schema v4 with journal preferences, journal entries, tags, entry tags, FTS search, and
      source links that detach when conversations/messages are deleted.
- [x] Keep journal persistence behind Rust repository functions and typed Tauri commands.
- [x] Add stable journal IDs, `draft`, `completed`, and `discarded` statuses.
- [x] Add `trading_session` as a first-class journal kind for future trade-journal linking.
- [x] Add explicit create/update/get/list/search/delete/delete-all/export/diagnostics operations.
- [x] Add bounded development journal fixtures and cleanup.
- [x] Add TypeScript journal domain modules for types, deterministic intent detection, guided
      flows, session reducer, strict local-model JSON parsers, and safety helpers.
- [x] Add desktop-bubble journal access with guided/free-write writing, optional ratings, and
      explicit **Save draft**, **Save entry**, and **Discard** controls.
- [x] Add Companion Home journal access with local search, draft filtering, read/edit/delete,
      delete-all, and local JSON/Markdown export.
- [x] Add development-only Journal Lab for diagnostics, 100/1,000 fixtures, cleanup, and search.
- [x] Add frontend tests for journal intent, sessions, strict parsers, safety, and desktop-bubble
      save behavior.
- [x] Add Rust tests for journal preferences, lifecycle, search, export, source detachment, and
      fixture bounds/cleanup.
- [ ] Complete a fully driven real-desktop journal write/search/export/delete QA session in the
      WebView UI.
- [ ] Add local-model-generated journal summaries/reflections to the live UX.
- [ ] Add conversion from selected conversation content into a user-edited journal entry.
- [ ] Add future trade-episode/session linking after read-only trading data exists.

Task 8 is now a coherent journal foundation and satisfies the Task 9 gate minimum for durable
journal entries, trading-session entries, drafts/completed entries, explicit save, local search,
stable IDs, safe source-linking, desktop bubble access, and Companion Home access. Hyperliquid work
has not begun in this checkpoint.
