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

## Companion-first hierarchy

The desktop creature is the primary product surface:

```text
Desktop creature first
        |
Attached conversation bubble second
        |
Companion Home third
```

- **Desktop creature:** a compact, transparent, always-on-top buddy that lives beside the user and
  can breathe, blink, look around, rest, sleep, wake, listen, think, and talk using deterministic
  visual states.
- **Attached conversation bubble:** a lightweight desktop bubble for everyday local conversation
  without opening the full application.
- **Companion Home:** the normal application window for history, privacy, storage, deeper
  conversations, development labs, and future journal/review/settings work.

The companion milestone keeps local conversation through a locally running Ollama instance and
Rust-owned SQLite persistence. Temporary chat remains available for in-memory-only sessions.
Exchange connections, wallets, authentication, cloud sync, long-term semantic memory, screen
reading, global cursor tracking, telemetry, and order execution remain out of scope.

## Buddy visual direction

![Buddy BETA v0.1 design reference](../public/design/buddy-concept-beta-v0.1.png)

The BETA v0.1 concept establishes the intended character language: a small rounded dark body,
expressive pale face, floating purple antennae, warm chest core, and readable emotional poses.
This board is a design reference only. The current CSS placeholder remains the runtime renderer
until production sprites are deliberately created and licensed.
