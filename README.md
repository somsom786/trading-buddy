# Trading Buddy — BETA v0.1

A local-first desktop companion for crypto traders. The application connects only to a locally
running Ollama service for companion chat. Conversations are stored in a local SQLite database
owned by the Rust/Tauri layer. It has no cloud inference, account, API token, exchange, wallet,
authentication, telemetry, or trading functionality.

This repository is currently labeled **BETA v0.1** while the product direction and companion
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

The browser frontend defaults to the main view. Append `?view=buddy` to preview the buddy view.
Native Ollama requests require the Tauri desktop application.

## Using local chat

1. Start Ollama.
2. Confirm at least one model appears in `ollama list`.
3. Run `pnpm tauri dev`.
4. Select an installed model.
5. Type a message and press Enter. Use Shift+Enter for a newline.
6. Use **Stop generation** to cancel the active local request.

Saved conversations persist across restarts. User messages are saved before generation starts;
assistant responses are checkpointed during streaming and finalized as completed, cancelled, or
failed. Hidden thinking content and system prompts are not stored as conversation messages.

Use **Temporary chat** for an in-memory session. Temporary chat content is not written to SQLite and
is gone after the application closes or the session is reset.

## Local data and privacy controls

The database filename is `trading-buddy.db` and is created in Tauri's application-specific local
data directory. The exact path is displayed in **Privacy and storage** inside the Chat view.

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

To reset development data safely, use **Privacy and storage → Delete all conversation data**. If the
database itself must be removed during development, close the app first, then delete only the
displayed app-local `trading-buddy.db` file and its adjacent SQLite WAL/SHM files.

Automated storage tests use temporary in-memory databases and do not modify real user data.

## Buddy Lab

Buddy Lab is shown at the bottom of the main Chat view in development builds only. Expand it to:

- Preview every buddy state.
- Show, hide, or focus the buddy window.
- Run a mock streamed response without Ollama.
- Simulate cancellation and provider errors.
- Inspect the current provider, model, request, and buddy state.

## Quality checks

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm check
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
  domain/       Deterministic, framework-independent domain logic
  services/     Narrow adapters to native Tauri capabilities
  views/        Window-level React views
src-tauri/
  src/          Native window, tray, local AI, and SQLite persistence behavior
docs/           Product and engineering documentation
```

The `main` and `buddy` windows load the same frontend bundle with different query parameters. The
buddy is transparent, always on top, and excluded from the taskbar. Its physical screen position is
stored locally in the operating system application config directory. Conversations are stored
separately in the app-local SQLite database.

## Known limitations

- Only Ollama's native local API is implemented.
- Exactly one generation may run per conversation.
- Model installation and Ollama startup remain manual.
- Thinking content is never rendered as normal chat output.
- The conversation database is not application-level encrypted yet.
- Journal, Reviews, and Settings remain placeholders.
- The buddy artwork and animations are development placeholders.

## Buddy design direction

The current visual reference is stored at
[`public/design/buddy-concept-beta-v0.1.png`](public/design/buddy-concept-beta-v0.1.png). It is a
development concept board for proportions, poses, expressions, antennae, and the glowing chest
core. The live buddy remains CSS-based until production-ready sprite assets and usage rights are
finalized.
