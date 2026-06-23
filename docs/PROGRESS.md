# Progress Journal

## BETA v0.1

Trading Buddy is currently in active development under the label **BETA v0.1**. This journal
records meaningful product and engineering milestones without pretending the application is
production-ready.

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
- Design the local persistence milestone before storing conversations or journal entries.
- Continue recording product decisions, verification results, and notable limitations here.
