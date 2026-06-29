# Task 12 Repository Audit

**Date:** June 29, 2026  
**Branch:** `codex/task-12-reformation`  
**Baseline:** `b72c97a9c7713dd1ca91cee59c4fdb8e545b1daf`  
**Safety tag:** `pre-task-12-tauri-b72c97a`

## Existing Trading Buddy

The pre-reformation application is a Tauri 2, React, TypeScript, Vite, pnpm, Vitest, React Testing
Library, ESLint, Prettier, Rust, SQLite, and Ollama desktop companion.

It already contains:

- a transparent always-on-top buddy window;
- a normal Companion Home window;
- a transparent attached conversation bubble;
- local Ollama streaming;
- local SQLite conversation, memory, journal, and read-only Hyperliquid data;
- deterministic domain modules for companion behavior, storage, memory, journal, and read-only
  trading support;
- a progress journal and task handoff report convention.

The Tauri line remains preserved. Task 12 does not delete it.

## Hermes Agent and Hermes Desktop

Hermes was audited at upstream commit `dc5ef20d89f0fc787a97ebd05bb8c41fbce10ab7` and forked to
`https://github.com/somsom786/hermes-agent`.

Relevant findings:

- Hermes is MIT licensed.
- Hermes Desktop already has a transparent always-on-top Petdex overlay.
- The overlay shares the main renderer session/composer instead of creating a second pet runtime.
- The current code no longer contains several older requested files such as
  `agent/session_search.py`, `agent/bg_jobs.py`, or `agent/model_context.py`; the equivalent
  behavior has moved into current modules such as `tools/session_search_tool.py`,
  `hermes_state.py`, `tui_gateway/server.py`, and `agent/model_metadata.py`.
- Pet support lives in `agent/pet/*`, `skills/productivity/petdex/SKILL.md`,
  `apps/desktop/src/app/pet-overlay`, `apps/desktop/src/components/pet`, and
  `apps/desktop/src/store/pet-overlay.ts`.
- Hermes pets are profile-aware under `HERMES_HOME/pets/<slug>`.

## Petdex

Petdex was audited at upstream commit `e0a75c49f85d613ac7039d5e82dbc108e60806f5`.

Relevant findings:

- Current sprites use 192 by 208 cells.
- The current atlas size is 1536 by 1872, arranged as 8 columns by 9 rows.
- Current rows used by Codex-style pets are idle, running-right, running-left, waving, jumping,
  failed, waiting, running, and review.
- Petdex CLI telemetry was not adopted.

## Pet Clawd

Pet Clawd was audited at upstream commit `a2c436651c8e61e048584660ce96611776d7e5f5`.

Useful concepts:

- compact popover interaction;
- streaming callbacks;
- explicit pet state transitions;
- an agent-session abstraction around the pet.

Rejected concepts:

- screen capture or proactive screen behavior;
- affection/dependency mechanics;
- “never mention AI” identity patterns.

## Reference-only repositories

- DyberPet was audited at `20be816f5de6ae1f960132c8c9a664d318611665` and is GPL, so it is
  reference-only.
- Odysseus was audited at `893e490cdccf8a2a16a5fd3241ca9facfe2a3968` and is AGPL, so it remains
  reference-only.
- Agentic Desktop Pet was audited at `1b1340b17f8dce86aa7b0cb1395e2c275eaaba2d`; no clear license
  was identified during this checkpoint, so it remains reference-only.

## External media/X demo

The supplied X demo link was opened during research but was not accessible in a way that produced
usable implementation material. No code, assets, or behavior were copied from it.
