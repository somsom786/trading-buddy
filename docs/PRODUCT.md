# Product

**Current development label:** BETA v0.1

Trading Buddy is a private desktop companion that helps active crypto traders think more clearly,
record decisions, and review their behavior without handing sensitive context to a cloud-first
platform.

## Product principles

- Local-first and useful without an account.
- Advisory, not autonomous.
- Calm and legible during high-pressure market activity.
- Transparent about data sources and uncertainty.
- Safe around financial and wallet data.

## Foundation experience

The desktop application has two surfaces:

- **Buddy:** a compact, transparent, always-on-top presence that can quickly open the main app.
- **Main:** the full workspace with placeholders for Chat, Journal, Reviews, and Settings.

The first companion milestone adds optional conversation through a locally running Ollama instance.
Conversation history can be stored in a local SQLite database so users can close and restart the
app without sending data to a cloud service. Temporary chat remains available for in-memory-only
sessions. Exchange connections, wallets, authentication, cloud sync, and order execution remain out
of scope.

## Buddy visual direction

![Buddy BETA v0.1 design reference](../public/design/buddy-concept-beta-v0.1.png)

The BETA v0.1 concept establishes the intended character language: a small rounded dark body,
expressive pale face, floating purple antennae, warm chest core, and readable emotional poses.
This board is a design reference only. The current CSS placeholder remains the runtime renderer
until production sprites are deliberately created and licensed.
