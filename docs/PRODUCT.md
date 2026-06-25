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

## User-controlled companion memory

Task 6 adds the first durable long-term companion memory system. Memory is separate from
conversation history:

- conversation history is the visible saved chat transcript;
- confirmed memory is a small user-approved set of facts, preferences, goals, rules, and temporary
  context that Buddy may use later when relevant.

The product promise is that Buddy remembers because the user allowed it, not because it silently
profiles everything. Temporary chats do not create durable memories. Sensitive memory is disabled
by default. Secrets such as seed phrases, private keys, passwords, API keys, and recovery codes are
rejected instead of saved.

Companion Home now includes **What Buddy Knows About Me**, where users can inspect, search, filter,
confirm, edit, reject, delete, delete all, and separately export memory records. The desktop bubble
can show a polite one-at-a-time memory proposal without opening Companion Home.

## Conversational journaling foundation

Task 8 adds the first durable journal foundation. Journal entries are separate from saved chat and
separate from memory by default. The user has to explicitly save a draft or completed entry; the
model cannot silently turn a conversation into journal history.

The desktop bubble can start a local guided or free-write journal session from phrases such as
`let's journal`, `daily check-in`, or `review my trading`. Companion Home includes a local journal
library for search, draft filtering, reading, editing, deletion, and export. The journal schema
supports IDs, drafts, completed entries, local FTS search, optional mood/energy/stress/confidence
ratings, private-by-default entries, and `trading_session` reflections for future trade linking.

Journal content remains local in Rust-owned SQLite. Safe source links can reference a saved
conversation/message and detach automatically if that source conversation is deleted. Journal text
does not become companion memory unless a future explicit opt-in workflow proposes it through the
same validated memory boundary.

## Buddy visual direction

![Buddy BETA v0.1 design reference](../public/design/buddy-concept-beta-v0.1.png)

The BETA v0.1 concept establishes the intended character language: a small rounded dark body,
expressive pale face, floating purple antennae, warm chest core, and readable emotional poses.
This board is a design reference only. The current CSS placeholder remains the runtime renderer
fallback, while the normal runtime buddy uses temporary transparent pose PNGs extracted from the
reference sheet until production sprites are deliberately created and licensed.
