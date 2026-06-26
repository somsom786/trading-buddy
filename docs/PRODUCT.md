# Product

**Current development label:** BETA v0.2

Trading Buddy is a private local AI creature that lives on the user's desktop, develops continuity
through inspectable local memory, understands ordinary life and emotion, and speaks crypto
natively without reducing the user to a wallet or PnL.

The north star is:

> Shimeji body. Odysseus brain. Crypto-native soul.

## Product principles

- The creature is the product; the large application is secondary.
- Local-first and useful without an account or a running model.
- Conversation should feel like talking to the creature, not operating a chat page.
- Long-term continuity matters more than feature count.
- Memory is inspectable, editable, correctable, exportable, and deletable.
- Advisory, not autonomous.
- Calm and legible during high-pressure market activity.
- Transparent about data sources and uncertainty.
- Safe around financial and wallet data.
- Supportive without pretending to be a therapist or encouraging emotional dependency.
- Crypto-native without becoming a signal bot.

## Companion-first hierarchy

The desktop creature is the primary product surface:

```text
1. Living desktop creature
2. Companion identity and emotional presence
3. Natural local conversation
4. Long-term personal continuity
5. Journal, reminders, and shared routines
6. Optional crypto and trading skills
7. Companion Home for inspection and settings
```

- **Desktop creature:** a compact, transparent, always-on-top buddy that lives beside the user and
  can breathe, blink, look around, rest, sleep, wake, listen, think, and talk using deterministic
  visual states.
- **Attached conversation bubble:** a lightweight desktop bubble for everyday local conversation
  without opening the full application.
- **Companion Home:** the normal application window for history, privacy, storage, deeper
  conversations, development labs, and future journal/review/settings work.

The buddy's physical presence, drag behavior, and deterministic ambient state do not depend on
Ollama. Local conversation uses a loopback-only Ollama instance and Rust-owned SQLite persistence.
Temporary chat remains available for in-memory-only sessions.

Task 11 adds the first real body runtime: fixed-timestep movement, gravity, safe landing,
out-of-bounds recovery, bounded autonomous actions, and a guaranteed Bring Buddy Back path. The
body continues operating when Ollama is stopped. Temporary poses remain visual fallbacks while the
animation-intent layer is still under development.

Desktop geometry is allowed only to support physical presence. Monitor/work-area bounds, sanitized
window rectangles, buddy/bubble geometry, and optional cursor position may be used. Window titles,
application/process identity, URLs, screen content, text, keystrokes, clipboard data, and
accessibility trees are prohibited.

## Skills architecture

Skills are optional capabilities beneath the companion, local intelligence, and local memory
layers. They do not define Buddy's identity and do not enter unrelated conversation context.
Journal is a local user-owned routine. Trading is an optional read-only integration skill.

## Read-only trading skill

Task 9B adds the first real trading integration boundary: read-only Hyperliquid public account
awareness. Users can save a public Hyperliquid address for mainnet or testnet, refresh official
read-only `/info` data, and view saved account summary, current positions, recent fills, funding,
and open orders in Companion Home.

Task 9D extends that awareness to the desktop companion surface. The bubble can show compact
account, position, recent-fill, funding, open-order, and sync cards for the selected local account
without requiring the model. When the user asks local-Qwen about saved trading facts, Buddy supplies
a bounded context block that excludes full addresses and internal row IDs, labels fixture/staleness
state, and repeats that execution capability is none.

This does not make Buddy a trading bot. The app has no private-key fields, seed phrase fields,
exchange API secrets, wallet signing, order placement, order cancellation, withdrawals, transfers,
cloud relay, telemetry, WebSocket live sync, risk engine, recommendations, or autonomous trading.
Trading values are stored locally as exact strings and labelled as saved exchange-reported data
rather than live truth.

Task 9E is paused after the active-account persistence checkpoint. Live WebSocket synchronization,
trade reconstruction, risk dashboards, and advanced exchange infrastructure are not current
product priorities.

## Relationship boundaries

- Buddy may be warm, emotionally aware, direct, playful, and supportive.
- Buddy does not claim consciousness, human feelings, or therapeutic authority.
- There is no affection score, attachment score, jealousy, streak pressure, or guilt mechanic.
- Ignoring or dismissing Buddy produces no punishment or dependency language.
- The user owns decisions, relationships, and next steps.

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
