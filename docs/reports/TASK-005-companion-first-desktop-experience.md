# Task 5 Report - Companion-First Desktop Experience

**Date:** June 24, 2026  
**Project label:** Trading Buddy BETA v0.1  
**Audience:** External task author / GPT-5.5 task planner

## Baseline repository condition

The repository entered Task 5 with Task 1-4 infrastructure already present:

- Tauri 2, React, TypeScript, Vite, pnpm.
- Transparent always-on-top buddy window.
- Main application window.
- Tray behavior.
- Local Ollama model listing, streaming, and cancellation.
- Rust-owned SQLite persistence for conversations, messages, settings, retention, export, and
  deletion.
- Buddy Lab and Storage Lab.
- Task 4 QA documents and known manual-verification gaps.

Baseline validation before Task 5 passed:

- `corepack pnpm check`
- `corepack pnpm build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `corepack pnpm tauri build --debug --no-bundle`
- `corepack pnpm tauri build --no-bundle`
- `git diff --check`

No pre-existing automated failures were recorded.

## Implementation plan used

1. Keep the existing architecture and local chat pipeline.
2. Add a hidden taskbar-skipped conversation bubble window while keeping the buddy visible and
   Companion Home hidden at startup.
3. Persist typed companion preferences in Rust-owned settings.
4. Add testable companion domain modules for visual state, ambient life, proactive check-ins, and
   placement.
5. Change buddy click behavior to toggle the bubble, not open the full app.
6. Keep Companion Home as the secondary full workspace.
7. Update tray actions, docs, tests, and final report.

## Startup behavior changes

- Buddy starts visible.
- Companion Home is configured hidden by default.
- Bubble is configured hidden by default.
- A persisted `openCompanionHomeAtStartup` preference was added and defaults to disabled.
- Storage/settings initialization happens in the native setup path and startup preferences are
  applied when available.
- Initialization failures do not intentionally open Companion Home.

## Buddy-window changes

- Single click now toggles the attached conversation bubble.
- Drag behavior remains separated from click behavior through the existing drag threshold.
- Buddy hover can switch the temporary renderer toward a curious/looking state.
- Buddy position persistence remains local JSON in the app config directory.
- Native window titles were made distinct to make future smoke tests easier:
  - `Companion Home — Trading Buddy BETA v0.1`
  - `Trading Buddy Buddy - BETA v0.1`
  - `Trading Buddy Bubble`

## Conversation-bubble architecture

- Added a third Tauri window: `bubble`.
- The bubble loads `index.html?view=bubble`.
- It is transparent, undecorated, always-on-top, taskbar-skipped, and hidden when inactive.
- Native code positions it beside the buddy and flips/clamps based on available monitor space.
- The bubble contains:
  - recent messages/current exchange;
  - multiline input;
  - Enter-to-send and Shift+Enter newline behavior;
  - send button;
  - stop-generation button;
  - local AI status;
  - selected model label;
  - collapse button;
  - explicit Open Home button;
  - saved/temporary mode indicator.

The bubble uses the existing conversation reducer, local AI service, storage service, model
selection, and system prompt. It does not introduce a second provider backend.

## Shared conversation architecture

The bubble uses the same domain reducer and persistence commands as Companion Home. It prepares
persistent generation through Rust storage before streaming and finalizes completed, cancelled, or
failed assistant messages.

Important limitation: the active React state is not yet a single shared cross-window store. The
bubble and Companion Home share the same SQLite persistence and local AI command boundaries, but a
complete real-time active-generation handoff between windows still needs a dedicated shared session
coordinator or native broadcast channel. This should be a Task 6 focus.

## Emotion/activity state architecture

Added typed visual state concepts:

- `BuddyEmotion`
- `BuddyActivity`
- `BuddyVisualState`

The temporary renderer accepts `emotion + activity` and maps it to CSS state. The model cannot
invent animation names or sprite paths.

## Ambient-life engine

Added deterministic ambient logic in `src/domain/companion/ambientLife.ts`:

- breathing;
- blinking;
- looking;
- stretching;
- sitting;
- sleeping after configured inactivity;
- waking helper state;
- priority pauses during active conversation/alerts;
- disabled and reduced-motion handling;
- injected time and random source for tests.

The engine is framework-independent and tested.

## OS idle integration

Added a narrow native command:

- `get_os_idle_seconds`

On Windows it uses `GetLastInputInfo` and `GetTickCount` through `windows-sys`. Unsupported
platforms return `0`.

Privacy boundary:

- no key capture;
- no mouse coordinate capture;
- no screen reading;
- no other-app text reading;
- no activity history persistence.

## Proactive check-in engine

Added deterministic proactive logic in `src/domain/companion/proactive.ts`.

It gates template check-ins by:

- enabled preference;
- Do Not Disturb;
- quiet hours;
- cooldown;
- recent dismissal;
- active generation;
- sleeping state;
- bubble-open state.

Content is a small local template library only. No proactive LLM generation was added.

## Docking and placement behavior

Added pure placement logic in `src/domain/companion/placement.ts` for:

- free floating;
- dock left;
- dock right;
- taskbar perch;
- negative-coordinate monitors;
- disconnected-monitor recovery;
- work-area clamping;
- small monitor fallback;
- bubble-side flipping.

Native runtime currently persists/restores free-floating buddy position and positions the bubble
beside the buddy. User-facing docking controls and native snapping by persisted placement mode are
not complete.

## Focus and click-through behavior

- Buddy click toggles bubble.
- Bubble Escape collapses the bubble.
- Bubble input intentionally receives normal keyboard interaction when open.
- Bubble close hides the bubble and does not close the buddy.
- No hidden full-screen overlay was added.
- No global cursor tracking was added.

Click-through transparent-region behavior was not implemented and remains a platform-specific
future investigation.

## Global shortcut

Persistent preference fields were added:

- `globalShortcutEnabled`

Actual global shortcut registration was not implemented. This remains deferred until an official
Tauri/native shortcut integration is added with registration-failure handling and manual OS
verification.

## Autostart behavior

Persistent preference fields were added:

- `launchAtLogin`

Actual launch-at-login integration was not implemented. The default remains disabled during
development.

## Tray changes

Tray actions now reflect the companion-first model:

- Talk
- Open Companion Home
- Show Buddy
- Hide Buddy
- Sleep
- Wake
- Do Not Disturb
- Reset Position
- Quit

The requested `Launch at Login` tray item is not implemented because OS autostart is still
deferred.

## Companion Home changes

- Main window is labeled as `Companion Home`.
- The header explains that the buddy lives on the desktop and the full window is for history,
  privacy, settings, and deeper conversations.
- Added a Return to desktop buddy action.
- Existing conversations, storage tools, Buddy/Companion Lab, and Storage Lab remain available.

## Preferences added

Rust-owned persisted companion settings now include:

- buddy visible;
- always on top;
- placement mode;
- optional free-floating position;
- ambient animations enabled;
- reduced movement enabled;
- sleep-after-inactivity seconds;
- proactive check-ins enabled;
- proactive check-in cooldown minutes;
- quiet hours enabled;
- quiet hours start/end;
- Do Not Disturb;
- global shortcut enabled;
- launch at login;
- open Companion Home at startup;
- bubble width.

Settings are validated in Rust and TypeScript.

## Accessibility changes

- Bubble has an accessible region label.
- Collapse and Open Home actions are keyboard reachable.
- Escape collapses the bubble.
- The renderer uses labels and non-color data attributes for state.
- Reduced-motion handling remains supported.
- No rapid flashing or large random motion was added.

## Tests added or updated

Frontend/domain:

- visual-state guards and labels;
- ambient-life decisions;
- proactive check-in gates;
- placement and bubble flipping;
- bubble send/collapse behavior;
- view routing for `?view=bubble`;
- buddy click toggles bubble;
- Companion Home labeling;
- storage boundary validation for companion preferences.

Rust:

- companion preference persistence;
- native clamp helper behavior;
- existing storage/local AI/window tests still pass.

## Commands run

Baseline:

- `corepack pnpm check` - passed
- `corepack pnpm build` - passed
- `cargo test --manifest-path src-tauri/Cargo.toml` - passed
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` -
  passed
- `corepack pnpm tauri build --debug --no-bundle` - passed
- `corepack pnpm tauri build --no-bundle` - passed
- `git diff --check` - passed

During implementation:

- `cargo fmt --manifest-path src-tauri/Cargo.toml` - passed
- `corepack pnpm format` - passed
- `corepack pnpm typecheck` - initially failed on exact typing/import issues, then passed
- `corepack pnpm lint` - initially failed on dev-lab unsafe unresolved type usage, then passed
- `corepack pnpm test` - initially failed after a dev-lab runtime import issue, then passed
- `cargo test --manifest-path src-tauri/Cargo.toml` - initially failed because Tauri event payloads
  needed `Clone`, then passed
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` -
  passed
- `corepack pnpm build` - passed
- `corepack pnpm tauri build --debug --no-bundle` - passed
- `corepack pnpm tauri build --no-bundle` - passed

Final verification after all file changes:

- `corepack pnpm check` - passed, including:
  - `corepack pnpm format:check`
  - `corepack pnpm lint`
  - `corepack pnpm typecheck`
  - `corepack pnpm test` - passed, 19 files / 70 tests
- `corepack pnpm build` - passed
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` - passed
- `cargo test --manifest-path src-tauri/Cargo.toml` - passed, 35 tests
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` -
  passed
- `git diff --check` - passed, with Windows LF-to-CRLF warnings only
- `corepack pnpm tauri build --debug --no-bundle` - passed
- `corepack pnpm tauri build --no-bundle` - passed

## Manual scenarios performed

- Verified the attached design image matches the checked-in BETA v0.1 concept image by SHA-256.
- Built the debug and optimized desktop executables.
- Smoke-launched the debug executable and stopped only the launched process.
- Enumerated top-level windows after smoke launch. After making native titles distinct, the final
  smoke check showed:
  - `Companion Home — Trading Buddy BETA v0.1` hidden;
  - `Trading Buddy Bubble` hidden;
  - `Trading Buddy Buddy — BETA v0.1` visible.

## Scenarios not fully verified

Do not claim these as passed yet:

- real click on buddy toggles bubble;
- real local Qwen conversation inside the bubble;
- stop-generation from the real bubble;
- bubble follows during manual buddy drag;
- restart persistence after Task 5 changes;
- each docking mode in the native runtime;
- native right-click context menu;
- global shortcut;
- launch at login;
- proactive check-in display/dismiss/snooze in the real desktop;
- full shared active-generation handoff between bubble and Companion Home;
- tray menu click-through;
- full Task 5 manual desktop checklist.

## Known limitations

- No final pixel art.
- No long-term semantic memory.
- No journals or trading reviews.
- No crypto integrations.
- No browser extension.
- No cloud models/accounts/sync.
- No voice.
- No autonomous trading.
- No screen scraping or keylogging.
- No global cursor tracking.
- No production docking UI.
- No global shortcut registration.
- No launch-at-login integration.
- No native buddy right-click context menu yet.

## Security and privacy boundaries

- Local-first remains intact.
- No private keys, seed phrases, exchange credentials, or wallet data are requested or stored.
- Local Ollama remains loopback-only.
- SQLite remains app-local and Rust-owned.
- The OS idle command exposes elapsed idle seconds only.
- Proactive check-ins are deterministic templates, not autonomous model behavior.
- The actual Windows taskbar is not modified.

## Recommended Task 6

Task 6 should be a focused completion/verification pass, not a new product subsystem:

1. Add official global-shortcut integration with safe registration failure handling.
2. Add launch-at-login integration and settings UI.
3. Add user-facing companion preferences for docking, DND, quiet hours, ambient motion, and startup.
4. Implement native buddy context menu or a safe equivalent.
5. Add a shared cross-window session coordinator so bubble and Companion Home can observe the same
   active generation in real time.
6. Run the full Task 5 manual desktop checklist with a human-visible session and update QA docs.
