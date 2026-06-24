# MVP

## Goal

Validate that a local desktop creature can help a trader capture context and review decisions with
minimal interruption, while the full application remains a secondary Companion Home for deeper
work.

## Candidate MVP scope

- Desktop buddy visible at launch without opening Companion Home.
- Attached conversation bubble for the user's everyday local chat, using existing Ollama streaming
  and privacy-first local conversation persistence.
- Deterministic ambient life: breathing, blinking, looking, sitting, stretching, sleeping, waking,
  and explicit listening/thinking/talking states.
- Respectful proactive check-in engine based on templates, cooldowns, quiet hours, Do Not Disturb,
  and idle/session timing.
- Placement behavior for free floating, left dock, right dock, and taskbar-perch positioning,
  without modifying the real operating-system taskbar.
- Companion Home for history, privacy/storage controls, development labs, and longer
  conversations.
- Local trading journal with structured entries.
- Review workflow for decisions and outcomes.
- Read-only market or exchange context after a separate security review.
- Export and deletion controls for all local user data.
- Settings for privacy, data retention, and optional integrations.

## Explicit non-goals

- Custody of funds.
- Private key or seed phrase handling.
- Autonomous order execution.
- Copy trading.
- Cloud accounts or synchronization by default.
- Guaranteed predictions, returns, or financial advice.

## Foundation exit criteria

- Both desktop windows launch and behave as documented.
- Tray actions open each window and quit the application.
- Buddy position survives a relaunch.
- Frontend, Rust, and native packaging checks pass.
- Architectural and safety constraints are documented.

## Local companion milestone

- Detect local Ollama and list installed models.
- Stream a selected local model response through a typed native channel.
- Cancel active generation safely.
- Persist saved conversations locally while supporting explicit temporary chats.
- Drive buddy visuals from deterministic application lifecycle events.

## Local conversation storage milestone

- Store conversations, messages, model preference, and privacy settings in Rust-owned SQLite.
- Keep hidden thinking, system prompts, raw Ollama responses, secrets, and technical traces out of
  saved conversation content.
- Provide rename, archive, restore, delete, delete-all, retention, and export controls.
- Document that the database is local but not application-level encrypted yet.

## Companion-first desktop milestone

- Start with the buddy visible and Companion Home hidden by default.
- Single-clicking the buddy toggles the attached conversation bubble instead of opening the full
  application.
- The bubble streams local model output beside the buddy and can cancel active generation.
- The buddy uses typed `emotion + activity` visual state instead of arbitrary animation names.
- OS idle awareness exposes elapsed idle seconds only; it does not capture input, coordinates,
  screen contents, or other app text.
- Companion preferences are stored in Rust-owned settings rather than browser local storage.
- Global shortcut and launch-at-login preferences exist in the typed settings model, but the actual
  OS integrations are deferred until the official Tauri plugin surface is added and verified.

## Transparent local memory milestone

- Add Rust-owned SQLite memory tables, memory preferences, FTS index, and usage records.
- Default memory mode is enabled but `ask_every_time`; proposed memories are not used until
  confirmed.
- Add deterministic explicit commands and candidate pre-filtering before any local model
  extraction.
- Use local Qwen/Ollama only for structured memory proposals; model output is schema-validated and
  never writes directly to SQLite.
- Retrieve only relevant confirmed memories and pass them below the companion system prompt as
  labelled user-approved context.
- Show memory proposals in the desktop bubble and Companion Home without guilt or pressure.
- Provide **What Buddy Knows About Me** for search, filters, settings, confirm/reject/edit/delete,
  delete all, and separate memory export.
- Keep temporary chats isolated by default: no durable memory creation, and existing memories are
  used only if the user enables that setting.
- Keep secrets prohibited and sensitive memories disabled by default.
