# MVP

## Goal

Validate that a local desktop companion can help a trader capture context and review decisions with
minimal interruption.

## Candidate MVP scope

- Local chat-style workspace with clearly bounded assistant behavior, local Ollama streaming, and
  privacy-first local conversation persistence.
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
