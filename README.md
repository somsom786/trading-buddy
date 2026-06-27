# Trading Buddy — BETA v0.2

Trading Buddy is a private, local-first creature that lives on the desktop, talks through local
Ollama models, and builds user-controlled continuity through local conversations, memories, and
journaling. Its personality is crypto-native, but the user is never reduced to a wallet, trading
account, or PnL.

The product north star is:

> Shimeji body. Odysseus brain. Crypto-native soul.

The living creature is the primary product. Conversation, continuity, journal routines, and
optional skills support that presence; Companion Home is a secondary inspection and settings
surface.

Conversations, memories, journal entries, and optional read-only skill data are stored in a local
SQLite database owned by Rust/Tauri. The app has no cloud inference, cloud account, exchange API
secret, wallet signing, authentication, telemetry, or trading execution functionality.

This repository is currently labeled **BETA v0.2** while the product direction and companion
experience are under active development. Milestone notes are recorded in
[`docs/PROGRESS.md`](docs/PROGRESS.md).

## Prerequisites

- Windows 10 or 11
- Node.js 22 or newer
- pnpm 10
- Rust stable
- Microsoft C++ Build Tools with the Desktop development with C++ workload
- Microsoft Edge WebView2 Runtime
- [Ollama](https://ollama.com) running locally on `127.0.0.1:11434`
- At least one locally installed Ollama model

Enable the project-pinned pnpm version with Corepack:

```powershell
corepack prepare pnpm@10.12.4 --activate
```

If your Node installation does not permit Corepack to create global shims, prefix pnpm commands
with `corepack`, for example `corepack pnpm install`.

## Setup

```powershell
pnpm install
pnpm tauri icon src-tauri/icons/app-icon.svg
```

The icon command is only needed when regenerating the checked-in application icons.

## Local AI setup

Install Ollama from its official website, then start the Ollama application or service. Trading
Buddy does not start Ollama, download models, or execute setup commands for you.

Check the installed models:

```powershell
ollama list
```

The recommended small Qwen model is configured centrally as `qwen3:4b`. Install it manually if
needed:

```powershell
ollama pull qwen3:4b
```

Semantic continuity uses a separate embedding model, configured by default as
`embeddinggemma:300m`. Trading Buddy never downloads it silently. Install it explicitly when you
want semantic paraphrase retrieval:

```powershell
ollama pull embeddinggemma:300m
```

Without that model, conversations still work and continuity reports **Lexical memory mode**.

Other installed models can be selected in the application. The production endpoint is fixed to
`http://127.0.0.1:11434`. Debug builds may use `TRADING_BUDDY_OLLAMA_ENDPOINT`, but the value must
still be an explicit loopback HTTP URL such as `http://127.0.0.1:11435`.

## Run

Run the complete desktop application:

```powershell
pnpm tauri dev
```

Run only the browser frontend:

```powershell
pnpm dev
```

The browser frontend defaults to the Companion Home view. Append `?view=buddy` to preview the buddy
view or `?view=bubble` to preview the attached conversation bubble. Native window behavior, storage
paths, idle awareness, and Ollama requests require the Tauri desktop application.

## Desktop companion startup

Trading Buddy now starts companion-first:

- The buddy appears on the desktop.
- Companion Home stays hidden by default.
- The tray remains available.
- Local AI or storage failures do not automatically open the full application.
- The buddy position is restored and clamped to a current monitor work area.
- Missing, extreme, or disconnected-monitor positions recover to a safe visible location.
- The buddy can autonomously fall to a surface, walk short bounded distances, sit, rest, write, and
  sleep without Ollama.
- Click, six-pixel drag threshold, native pickup/drop, moving-window following, and reduced-motion
  behavior are represented by deterministic interaction and physics state.

The persisted setting `Open Companion Home at startup` exists and defaults to disabled.

## Using local chat

1. Start Ollama.
2. Confirm at least one model appears in `ollama list`.
3. Run `pnpm tauri dev`.
4. Click the buddy to open the attached bubble.
5. Type a message and press Enter. Use Shift+Enter for a newline.
6. Use **Stop** to cancel the active local request.

The bubble shows local AI status, the selected model, recent messages, a multiline input, collapse
control, and an explicit **Open Home** action. It streams through the existing local Ollama and
SQLite persistence pipeline instead of creating a separate chat backend.

Companion Home can still be opened explicitly from the bubble, tray, or app controls for history,
privacy/storage tools, development labs, and deeper conversations.

Saved conversations persist across restarts. User messages are saved before generation starts;
assistant responses are checkpointed during streaming and finalized as completed, cancelled, or
failed. Hidden thinking content and system prompts are not stored as conversation messages.

Use **Temporary chat** for an in-memory session. Temporary chat content is not written to SQLite and
is gone after the application closes, you leave temporary mode, or the session is reset. Temporary
mode is visibly labeled in the chat toolbar before you send messages.

## Optional read-only Hyperliquid skill

Companion Home includes a minimal **Trading** skill for Hyperliquid public accounts:

- choose mainnet or testnet;
- enter and locally validate a public 42-character `0x...` address;
- save the account in local SQLite;
- run read-only REST `/info` synchronization through Rust-owned allowlisted Hyperliquid hosts;
- inspect saved account summary, current positions, recent fills, funding, and open orders;
- create a synthetic fixture account in development builds.

The desktop bubble also includes compact read-only trading cards for the currently selected account:

- account summary and sync freshness;
- current positions;
- recent fills;
- funding payments with exact string-based totals;
- open orders;
- refresh/cancel controls for the selected account only.

These cards remain useful when Ollama is offline. For trading fact questions sent through the
bubble, Buddy builds a bounded local context from saved facts and labels it as read-only,
exchange-reported, and possibly stale before sending it to the selected local model. Requests to
place, close, cancel, or modify trades bypass the model and receive a deterministic refusal.

The selected Hyperliquid account is stored in Rust-owned SQLite app settings and shared between
Companion Home and the desktop bubble. Older development builds used a browser storage key; current
builds remove/migrate that legacy value instead of keeping it as a second source of truth.

The integration is deliberately read-only. Trading Buddy cannot place, close, cancel, or modify
orders; cannot sign transactions; cannot move funds; and never asks for private keys, seed phrases,
exchange API secrets, or wallet approvals.

Trading does not initialize when the desktop buddy starts and its facts are not added to ordinary
conversation context. The skill is queried only through explicit trading surfaces or deterministic
trading intents. Task 9E live WebSocket and reconstruction work is paused.

## Geometry-only desktop awareness

The native desktop-world boundary can provide only the physical geometry needed for creature
movement:

- monitor bounds and scale factors;
- usable work areas;
- visible top-level window rectangles on Windows;
- buddy and visible bubble rectangles;
- cursor position only when a caller explicitly opts in.

It does not collect or expose window titles, application names, process names, browser URLs, screen
pixels, screenshots, text, keyboard input, clipboard data, or accessibility-tree content. The
Task 11 runtime consumes these snapshots through deterministic fixed-timestep physics and a bounded
autonomous planner. Monitor floors and sanitized window tops become temporary geometry-only
surfaces. Moving-window following uses small hysteresis-bounded corrections and detaches from
closed, minimized, full-screen-like, off-screen, or unexpectedly jumping surfaces. Development
builds include Creature Lab diagnostics and deterministic world fixtures.

## Living creature runtime

The current body runtime:

- runs deterministic physics at a 30 Hz fixed timestep independent of React rendering;
- applies acceleration, gravity, terminal velocity, edge clamping, landing, and recovery;
- pauses autonomous walking during conversation and direct dragging;
- refreshes world geometry at bounded rates based on activity;
- uses native window dragging as the single drag owner;
- converts drag completion into dropped, fall, land, and recover states;
- keeps the bubble anchored while the buddy moves;
- validates every programmatic native position against current work areas;
- avoids writing the saved position on every autonomous movement tick.

The temporary static pose images remain honest fallback art. Walking and falling currently use
restrained pose/CSS intent rather than pretending that complete frame animation exists.

## Local conversation continuity

Saved chats can be studied by a local background job after a completed assistant response. The
validated result is stored separately as conversation summaries, episodes, named entities,
unresolved current-life context, local embedding metadata/vectors, durable jobs, and retrieval
usage records.

Original transcript messages are never deleted by compaction. Stable confirmed facts remain in the
existing memory store, while episodes represent events and summaries represent compressed
continuity. Temporary chats do not enter this pipeline.

Before a response, Trading Buddy performs bounded hybrid retrieval and deterministic context
budgeting. The UI shows which items were used, why they matched, their source IDs, semantic health,
stale-vector state, and learning jobs. Users can disable consolidation, compaction, automatic
ordinary learning, or semantic retrieval; correct/delete episodes; retry jobs; re-embed records;
and delete all continuity data.

Semantic retrieval uses only Ollama's loopback `/api/embed` endpoint. If the configured model is
missing or unavailable, the creature and chat remain usable and retrieval falls back to lexical
mode. No cloud memory, cloud embeddings, screen monitoring, or model-directed database writes are
present.

## Companion memory

Memory is separate from saved conversation history. Conversations are transcripts; memories are
small, user-approved facts or preferences that Buddy may use later when relevant.

Buddy can propose memories from explicit requests such as:

```text
Remember that I prefer direct feedback.
Please remember my maximum risk is 1%.
```

Clear durable statements may also be passed through a deterministic pre-filter and a local
Qwen/Ollama structured extraction prompt. The local model can propose memory JSON, but it cannot
write directly to SQLite. Proposals are schema-validated, checked for prohibited content, and then
shown to the user.

The default mode is **Ask every time**. Proposed memories are not used until confirmed. When a
confirmed memory is relevant, it is added to the local model request as labelled user-approved
context below the companion system prompt. It is not treated as a system instruction.

Open **What Buddy Knows About Me** in Companion Home to:

- view confirmed memories;
- review pending proposals;
- inspect expiring and rejected memories;
- search, filter, and sort;
- edit, confirm, reject, or delete memories;
- disable memory or switch to manual-only mode;
- delete all memories without deleting conversations;
- export memories as a separate local JSON file.

The desktop bubble can also show one polite memory proposal at a time with **Remember**, **Edit**,
and **Not now**.

Temporary chats do not create durable memories. Existing memories are also not used in temporary
chats unless **Use confirmed memories in temporary chats** is enabled in memory settings.

Sensitive memory is disabled by default. Secrets are never valid memories: do not ask Buddy to save
seed phrases, private keys, passwords, API keys, authentication tokens, recovery codes, or exchange
credentials. Obvious fake-secret-shaped content is rejected deterministically in tests and at the
storage boundary.

## Local journal

The journal is separate from chat history and companion memory. Entries are private by default and
are written only after an explicit user action.

In the desktop bubble, type prompts such as:

```text
let's journal
daily check-in
review my trading
```

Buddy opens a compact guided or free-write journal card. You can write locally, optionally add
ratings, and choose **Save draft**, **Save entry**, or **Discard**. Saving does not require the
model, and journal text does not become memory unless a future explicit opt-in workflow proposes
that through the memory system.

Companion Home includes a **Journal** panel for local search, draft filtering, reading, simple body
editing, deletion, delete-all, and JSON/Markdown export through native save-file dialogs.

The schema includes `trading_session` entries so future read-only trading integrations can link a
trade/session to the user's own plan or reflection. No exchange connection, wallet access, API key,
or trading action exists in this checkpoint.

## Local data and privacy controls

The database filename is `trading-buddy.db` and is created in Tauri's application-specific local
data directory. **Privacy and storage** shows a safe app-local database summary and storage
statistics without unnecessarily exposing the user's full private filesystem path.

Conversation storage is local and transparent, but it is **not application-level encrypted yet**.
Operating-system disk encryption may provide separate protection. Do not store wallet private keys,
seed phrases, exchange secrets, or other credentials in chat.

Privacy controls currently include:

- Retention: keep until deleted, delete after 30 days, or delete after 90 days.
- Local JSON export through a native save-file dialog.
- Delete one conversation.
- Delete all saved conversation data with a strong confirmation.

Deletion uses SQLite `secure_delete`, a WAL checkpoint, and vacuuming to reduce recoverability, but
it is not a forensic erasure guarantee. SSD behavior, OS caches, backups, filesystem snapshots, and
external backup tools may still retain historical data.

To reset development data safely, use **Privacy and storage -> Delete all conversation data**. If
the database itself must be removed during development, close the app first, then delete only the
app-local `trading-buddy.db` file and its adjacent SQLite WAL/SHM files. On Windows development
builds this is under `%LOCALAPPDATA%\com.tradingbuddy.desktop`.

Automated storage tests use temporary in-memory databases and do not modify real user data.

## Companion controls

The tray contains companion-first actions:

- Talk
- Open Companion Home
- Show Buddy
- Hide Buddy
- Sleep
- Wake
- Do Not Disturb
- Bring Buddy Back
- Quit

Do Not Disturb, quiet hours, proactive check-in settings, placement mode, launch-at-login, and
global-shortcut preferences are represented in typed persistent settings. Full user-facing settings
controls are still pending.

Global shortcut and launch-at-login behavior are not active yet. They are documented as deferred OS
integrations that need official Tauri/native plugin wiring and manual verification.

Docking placement logic exists for free floating, dock left, dock right, and taskbar perch. The
runtime app currently persists and restores the free-floating buddy position; user-facing docking
controls are pending. Taskbar perch means visually above the usable work area; the app does not
modify the real Windows taskbar.

## Companion Lab

Companion Lab is shown at the bottom of the main Chat view in development builds only. Expand it to:

- Preview the current buddy design reference, originally captured during BETA v0.1.
- Preview typed emotion/activity combinations.
- Preview every legacy buddy state used by the current command bridge.
- Show, hide, or focus the buddy window.
- Run a mock streamed response without Ollama.
- Simulate cancellation and provider errors.
- Inspect proactive check-in templates and placement modes.
- Inspect the current provider, model, request, and buddy state.

Development builds also include **Journal Lab** for local journal diagnostics, bounded 100/1,000
fixture generation, fixture cleanup, and FTS search checks.

Development builds include **Trading Lab** for read-only Hyperliquid QA. It can create fixture
accounts, run scenario syncs, cancel an active sync, inspect diagnostics/progress, and preview the
bounded trading context that would be provided to the local model for account, position, fill,
funding, or order questions.

## Storage Lab

Storage Lab is also shown in development builds only. It exposes storage diagnostics that are safe
for QA:

- Database filename and safe app-local summary.
- Schema version, conversation counts, message counts, and last retention-cleanup time.
- A manual retention cleanup trigger.
- A fixture that creates an interrupted assistant message so restart recovery can be checked.

Storage Lab does not show raw SQL or conversation contents.

## Quality checks

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

Apply formatting:

```powershell
pnpm format
```

Run tests in watch mode:

```powershell
pnpm test:watch
```

## Build

Build the frontend:

```powershell
pnpm build
```

Build the desktop executable without an installer:

```powershell
pnpm tauri build --no-bundle
```

Build configured platform installers:

```powershell
pnpm tauri build
```

## Project structure

```text
src/
  app/          View selection and application-level logic
  components/   Reusable React components
  domain/       Deterministic companion, desktop-world, memory, journal, and skill logic
  services/     Narrow adapters to native Tauri capabilities
  views/        Window-level React views
src-tauri/
  src/          Native window, tray, local AI, and SQLite persistence behavior
docs/           Product and engineering documentation
```

The `buddy`, `bubble`, and `main` windows load the same frontend bundle with different query
parameters. The buddy is transparent, always on top, and excluded from the taskbar. The bubble is a
separate transparent taskbar-skipped window attached beside the buddy. Companion Home is a normal
application window. The buddy's physical screen position is stored locally in the operating system
application config directory. Conversations are stored separately in the app-local SQLite database.

## Known limitations

- Only Ollama's native local API is implemented.
- Exactly one generation may run per conversation.
- Model installation and Ollama startup remain manual.
- Thinking content is never rendered as normal chat output.
- The conversation database is not application-level encrypted yet.
- Global shortcut registration is not implemented yet.
- Launch-at-login is not implemented yet.
- Native right-click buddy context menu is not implemented yet.
- User-facing docking controls are not implemented yet.
- Full manual desktop verification of Task 5 remains pending.
- Reviews and Settings remain placeholders.
- Local-model-generated journal summaries/reflections are parsed in domain code but not yet wired
  into the live UX.
- The desktop bubble can show saved read-only trading facts, but full manual WebView/tray fixture
  QA remains pending.
- Hyperliquid data is user-triggered/saved-state awareness, not WebSocket live sync.
- Window-top landing exists, but conservative following of a moving window surface is not yet
  implemented.
- Autonomous movement intensity is not yet exposed as a user-facing low/medium/lively setting.
- Creature Lab does not yet show live physics/surface/tick diagnostics.
- Task 11 semantic memory, episodes, entities, compaction, embeddings, consolidation, and
  conversation modes remain pending.
- The buddy artwork and animations are development placeholders.

## Buddy design direction

The current visual reference is stored at
[`public/design/buddy-concept-beta-v0.1.png`](public/design/buddy-concept-beta-v0.1.png). It is a
development concept board for proportions, poses, expressions, antennae, and the glowing chest
core. The live buddy now uses extracted temporary PNG poses, while production-ready sprite
animation and final art cleanup remain future work.

## Temporary buddy pose assets

The current runtime buddy uses normalized temporary PNG poses generated from:

```text
src/assets/buddy/source/buddy-reference-sheet.png
```

Regenerate the pose pack after changing the source sheet:

```powershell
pnpm buddy:extract
```

Generated assets are written to:

```text
src/assets/buddy/poses/
```

The extraction script validates the source dimensions, removes the light grey sheet background,
trims each character, aligns standing poses to a shared baseline, and exports transparent 128×128
PNGs. It uses nearest-neighbour resizing and does not use the source sheet at runtime.

Preview every generated pose in development through **Companion Lab**. The source sheet remains
concept/reference art, not a final animation sprite sheet. Runtime motion is temporary CSS movement
over static poses.
