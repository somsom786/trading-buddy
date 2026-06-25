# Progress Journal

## BETA v0.2

Trading Buddy is currently in active development under the label **BETA v0.2**. This journal
records meaningful product and engineering milestones without pretending the application is
production-ready.

### June 25, 2026 - Desktop trading awareness checkpoint

- Added shared active Hyperliquid account selection between Companion Home and the desktop bubble.
- Added compact read-only desktop bubble cards for account facts, positions, recent fills, funding,
  open orders, and sync progress.
- Added selected-account refresh/cancel controls without adding any order execution, signing,
  wallet, transfer, withdrawal, or generic RPC capability.
- Added deterministic trading intents, model-free execution refusal, exact string-based funding
  totals, and bounded local-Qwen trading context from saved facts only.
- Added Trading Lab context preview controls and frontend domain tests for the new non-native
  trading logic.
- Remaining follow-up: direct manual WebView QA for bubble cards and Trading Lab fixture smoke,
  machine-specific performance timing capture, and optional live public-address QA.
- Detailed handoff report:
  [`docs/reports/TASK-009D-desktop-trading-awareness.md`](reports/TASK-009D-desktop-trading-awareness.md)

### June 25, 2026 - Hyperliquid foundation hardening checkpoint

- Added SQLite schema v6 for fixture scenario identity instead of storing scenario names as display
  names.
- Added deterministic per-scenario fixture addresses, slow/cancel/performance fixture scenarios,
  active sync coalescing, progress state, cancellation, and cancelled/failed sync-run recording.
- Added a development-only Trading Lab for scenario creation, repeat sync, cancellation, and
  diagnostics.
- Tightened frontend trading intent detection and runtime guards for sync progress/diagnostics.
- Remaining follow-up: manual Trading Lab desktop QA, desktop bubble quick actions, bounded
  local-Qwen trading context, performance timing documentation, and optional live public-address QA.
- Detailed handoff report:
  [`docs/reports/TASK-009C-hyperliquid-foundation-hardening.md`](reports/TASK-009C-hyperliquid-foundation-hardening.md)

### June 25, 2026 - Read-only Hyperliquid provider foundation

- Added the first read-only Hyperliquid integration foundation with official allowlisted hosts,
  deterministic public-address validation, exact decimal-string handling, synthetic fixtures,
  SQLite schema v5, idempotent fixture sync, narrow Tauri commands, and a minimal Companion Home
  Trading section.
- Kept the boundary explicitly non-executing: no keys, seed phrases, signing, wallet SDKs, exchange
  secrets, order placement/cancellation, transfers, withdrawals, generic RPC/HTTP proxying, cloud,
  or telemetry.
- Documented remaining Task 9C work: Trading Lab, desktop buddy quick actions, bounded local-Qwen
  trading context, performance fixtures, manual desktop QA, and optional live public-address QA.
- Detailed handoff report:
  [`docs/reports/TASK-009B-hyperliquid-read-only-foundation.md`](reports/TASK-009B-hyperliquid-read-only-foundation.md)

### June 25, 2026 - BETA v0.2 label update

- Updated the current README and user-facing app labels from BETA v0.1 to BETA v0.2.
- Kept historical BETA v0.1 milestone reports and concept-art filenames intact.
- Detailed handoff report:
  [`docs/reports/TASK-009B-beta-v0.2-readme-label.md`](reports/TASK-009B-beta-v0.2-readme-label.md)

### June 25, 2026 - Conversational journaling foundation

- Verified that Task 8 was partially implemented in the worktree and stopped the Task 9
  Hyperliquid scope at the required gate.
- Added durable local journal entries with stable IDs, drafts, completed entries, `trading_session`
  kind, local FTS search, safe source links, tags, privacy flags, diagnostics, fixtures, and export.
- Added desktop-bubble journal sessions with deterministic journal intents and explicit save,
  draft, and discard controls.
- Added Companion Home journal library access and a development-only Journal Lab.
- Added frontend journal domain tests and Rust journal repository tests.
- Hyperliquid API research and trading integration work have not begun yet.
- Detailed handoff report:
  [`docs/reports/TASK-008-conversational-journaling-foundation.md`](reports/TASK-008-conversational-journaling-foundation.md)

### June 24, 2026 - Memory reliability hardening

- Added deterministic memory conflict classification for duplicate, update, conflict, and unrelated
  candidates.
- Added deterministic natural-language forgetting resolution for exact, ambiguous, category, all,
  and not-found requests.
- Added confirmed-update superseding behavior so old memories are replaced only when the update is
  confirmed.
- Added development-only Memory Lab diagnostics, 100/1,000 fixture generation, cleanup, and bounded
  retrieval timing.
- Moved memory listing filters into SQLite instead of loading all memory rows before filtering.
- Added restore/remove-expiry controls for rejected or temporary memories.
- Verified local Qwen availability through Ollama loopback and documented the remaining desktop
  UI automation gap.
- Detailed handoff report:
  [`docs/reports/TASK-007-memory-reliability-hardening.md`](reports/TASK-007-memory-reliability-hardening.md)

### June 24, 2026 - Transparent local companion memory

- Added local SQLite memory schema, typed preferences, FTS table, and usage records.
- Added deterministic explicit memory intents, pre-filtering, fake-secret rejection, and structured
  local-Qwen proposal validation.
- Added confirmed-memory retrieval and labelled memory context below the companion system prompt.
- Added memory proposal cards to the desktop bubble and Companion Home.
- Added **What Buddy Knows About Me** for memory inspection, search/filter/sort, settings,
  confirm/reject/edit/delete/delete-all, and separate memory export.
- Added frontend and Rust tests for memory domain logic, schema/repository behavior, retrieval
  exclusions, usage logging, provenance detachment, and export boundaries.
- Detailed handoff report:
  [`docs/reports/TASK-006-transparent-local-companion-memory.md`](reports/TASK-006-transparent-local-companion-memory.md)

### June 24, 2026 - Temporary buddy pose asset pack

- Moved the provided buddy reference image into `src/assets/buddy/source/`.
- Added a reproducible PNG extraction pipeline for ten transparent 128×128 pose assets.
- Added a typed pose manifest and deterministic visual-state-to-pose selection.
- Swapped the runtime buddy from the normal CSS placeholder to extracted pose PNGs with placeholder
  fallback.
- Added restrained temporary CSS motion over static poses.
- Expanded Companion Lab with pose previews, selected pose ID, scale/motion controls, natural
  dimensions, and fallback testing.
- Added image/manifest/pose-selection/renderer tests.
- Detailed handoff report:
  [`docs/reports/TASK-005B-temporary-buddy-pose-asset-pack.md`](reports/TASK-005B-temporary-buddy-pose-asset-pack.md)

### June 23, 2026 - Companion-first desktop shell

- Corrected the product hierarchy so the desktop buddy is primary and Companion Home is secondary.
- Added a separate attached conversation bubble window for compact desktop chat.
- Changed single-click buddy behavior to toggle the bubble instead of opening the full app.
- Added typed emotion/activity visual state, deterministic ambient life, proactive template gates,
  placement math, and OS idle-duration boundaries.
- Persisted companion preferences in Rust-owned settings.
- Expanded development tooling into Companion Lab previews.
- Documented deferred OS integrations: global shortcut, launch at login, native right-click buddy
  context menu, and user-facing docking controls.
- Detailed handoff report:
  [`docs/reports/TASK-005-companion-first-desktop-experience.md`](reports/TASK-005-companion-first-desktop-experience.md)

### June 23, 2026 - Desktop QA and storage UX hardening

- Added a Task 4 manual QA plan and QA journal for release-readiness work.
- Smoke-launched the real desktop app and verified app-local SQLite database creation.
- Added safe storage diagnostics and development-only Storage Lab controls.
- Hardened temporary chat mode, filename-only export feedback, retryable storage errors, and
  non-completed assistant message status display.
- Added frontend and Rust tests for storage diagnostics, display helpers, temporary chat behavior,
  filename-only export feedback, and interrupted-message recovery fixtures.
- Detailed handoff report:
  [`docs/reports/TASK-004-desktop-qa-storage-ux-hardening.md`](reports/TASK-004-desktop-qa-storage-ux-hardening.md)

### June 23, 2026 - Privacy-first local conversation storage

- Added Rust-owned SQLite persistence for saved conversations, visible messages, selected model,
  last-opened conversation, retention policy, and storage metadata.
- Added temporary chat mode for in-memory-only conversations.
- Added conversation management: new chat, list, switch, rename, archive, restore, delete, and
  delete-all.
- Added local JSON export through a native save-file dialog.
- Documented that the local database is not yet application-level encrypted.
- Automated verification passed, while full real-desktop manual verification remains pending.
- Detailed handoff report:
  [`docs/reports/TASK-003-privacy-first-local-conversation-storage.md`](reports/TASK-003-privacy-first-local-conversation-storage.md)

### June 23, 2026 — Visual direction captured

- Added the first buddy character concept board to the repository.
- Established the visual direction: rounded dark body, expressive face, floating antennae, and a
  warm glowing chest core.
- Added multiple reference moods and poses, including happy, curious, neutral, reading, and
  sleeping.
- Kept the running buddy CSS-based; the concept is not yet a production sprite sheet.
- Added the concept preview to Buddy Lab so visual development remains close to state testing.

![Buddy BETA v0.1 concept board](../public/design/buddy-concept-beta-v0.1.png)

### June 21, 2026 — First living local companion

- Connected the desktop application to local Ollama through a loopback-only Rust provider.
- Added installed-model discovery, selection, streaming responses, and cancellation.
- Verified a real local Qwen response through the complete desktop path.
- Added deterministic listening, thinking, talking, idle, concerned, and error buddy states.
- Added typed cross-window communication and development-only Buddy Lab controls.
- Confirmed that conversations remain session-only with no cloud service or database.

### June 20, 2026 — Desktop foundation

- Created the Tauri 2, React, TypeScript, Vite, and pnpm project foundation.
- Added the transparent always-on-top buddy and normal main application windows.
- Added tray controls, main-window focus behavior, and persisted buddy position.
- Established strict TypeScript, ESLint, Prettier, Vitest, React Testing Library, Rust tests, and
  project conventions.

## Next journal targets

- Refine the companion’s visual identity into original, production-ready sprites.
- Add verified OS global shortcut and launch-at-login integration.
- Add user-facing companion preference controls.
- Continue recording product decisions, verification results, and notable limitations here.
