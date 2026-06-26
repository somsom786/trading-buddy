# Companion Inspiration and Licensing Boundary

**Reviewed:** 2026-06-26

Trading Buddy's mission is summarized as:

> Shimeji body. Odysseus brain. Crypto-native soul.

This phrase describes product influences, not a code or asset lineage.

## Shimeji: behavioral inspiration

Reference: [shimejis.xyz](https://shimejis.xyz/)

The Shimeji experience demonstrates that a companion can feel alive before a conversation begins.
Its useful interaction principles are:

- the character occupies visible screen space as a persistent presence;
- it acts independently rather than waiting behind a chat input;
- walking, crawling, climbing, falling, resting, and surface interaction create physical
  continuity;
- direct pickup and dragging make the character feel tangible;
- small behaviors can carry personality without opening a large application.

Trading Buddy applies those principles to an original local desktop implementation with its own
character, state model, geometry service, physics, rendering, and privacy constraints.

### Intentionally not copied

- character art or fan character packs;
- sprite sheets or animation frames;
- extension source code;
- action definitions or proprietary behavior data;
- branding, names, or copyrighted characters.

The current Trading Buddy pose sheet remains temporary project concept art and is not a Shimeji
asset.

## Odysseus: architectural inspiration

Reference: [pewdiepie-archdaemon/odysseus](https://github.com/pewdiepie-archdaemon/odysseus)

Repository state inspected:

- commit `a9b208f4704da8ff36c8cf8700c0310bfd06065e`;
- commit date 2026-06-26;
- `README.md`, `ROADMAP.md`, `SECURITY.md`, `THREAT_MODEL.md`;
- `src/memory.py`, `src/memory_provider.py`, `src/memory_vector.py`, `src/embeddings.py`;
- `src/context_compactor.py`, `src/context_budget.py`, `src/model_context.py`;
- `src/model_discovery.py`, `src/session_search.py`, `src/event_bus.py`;
- `src/bg_jobs.py`, `src/bg_monitor.py`.

Architectural lessons considered useful:

- keep durable transcripts distinct from extracted memory;
- provide explicit remember/forget operations alongside automatic proposals;
- place native memory behind a provider-neutral boundary and preserve a local fallback;
- let semantic retrieval degrade to lexical retrieval when embedding infrastructure is unavailable;
- track embedding provider/model/version so stale vectors can be identified;
- budget context from known model capacity and reserve response headroom;
- compact older conversation while preserving recent turns and the durable original transcript;
- discover and health-check local models without making basic product behavior depend on them;
- persist background-job outcomes, make retries idempotent, bound polling, and report failures;
- treat retrieved memory and external content as untrusted context rather than authority;
- keep privileged capabilities narrow and explicit.

These are concepts that will be re-designed for Trading Buddy's Tauri/Rust/SQLite/TypeScript
architecture and stricter local-only desktop threat model.

### Intentionally not copied

- source code, data structures, algorithms expressed as code, or comments;
- prompts, including compaction or memory prompts;
- tests, fixtures, schemas, UI, documentation text, or assets;
- ChromaDB/FastEmbed implementation choices;
- network discovery behavior or broad self-hosted server capabilities;
- shell, filesystem, email, browser, or other privileged agent tooling.

Trading Buddy will use original domain models, original prompts, original tests, SQLite-owned local
storage, narrow Tauri commands, and loopback-only Ollama access.

## Licensing considerations

Odysseus declares `AGPL-3.0-or-later`. Studying its public architecture is allowed, but copying,
adapting, translating, or deriving implementation material could create AGPL obligations for
Trading Buddy. No such reuse is approved for this mission.

Before any future source-level reuse:

1. the project owner must explicitly review and approve the licensing consequence;
2. attribution and corresponding-source obligations must be designed and documented;
3. the repository's intended license and distribution model must be reconciled with AGPL terms.

Until then, Odysseus remains a conceptual reference only.

Shimeji art and character packs may carry separate copyright and fan-asset restrictions. They are
not dependencies or source material for Trading Buddy's character.

## Independent implementation record

Task 10 begins from Trading Buddy's existing independent codebase:

- a Tauri 2 native shell;
- original React companion UI;
- original temporary buddy concept art and pose extraction;
- Rust-owned SQLite conversations, memory, journal, and read-only skill data;
- original deterministic companion state and placement modules;
- a loopback-only Ollama adapter;
- original read-only Hyperliquid boundaries.

All Task 10 world geometry, motion, identity, continuity, retrieval, compaction, consolidation, and
privacy work must be written specifically for this codebase and tested against its own product
requirements.

## Task 11 reference revalidation

On 2026-06-26, Task 11 re-fetched `https://shimejis.xyz/` and the current Odysseus default `dev`
branch. The reviewed Odysseus commit remained
`a9b208f4704da8ff36c8cf8700c0310bfd06065e`.

The Task 11 body checkpoint was implemented independently as TypeScript domain physics, a narrow
Tauri movement boundary, and original tests written for Trading Buddy. No Shimeji or Odysseus
source, prompts, tests, schemas, action data, documentation text, or assets were copied or adapted.
