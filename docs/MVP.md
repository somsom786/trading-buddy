# MVP

## Goal

Validate that a local desktop companion can help a trader capture context and review decisions with
minimal interruption.

## Candidate MVP scope

- Local chat-style workspace with clearly bounded assistant behavior. The first streaming Ollama
  implementation is complete, while conversation persistence remains deferred.
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
- Keep the conversation in memory only.
- Drive buddy visuals from deterministic application lifecycle events.
