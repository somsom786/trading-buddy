# Decisions

## 001 — One frontend bundle, two native windows

**Status:** Accepted

Both windows load the same Vite output and select a view using `?view=main` or `?view=buddy`. This
avoids duplicate build pipelines while preserving native window behavior.

## 002 — Native ownership of window lifecycle

**Status:** Accepted

Rust owns window opening, focusing, tray actions, and buddy position persistence. React calls a
narrow command rather than depending directly on Tauri window APIs throughout the component tree.

## 003 — JSON position persistence without a plugin

**Status:** Accepted

The buddy position is a two-integer JSON document in the application config directory. A storage
plugin would add dependency and permission surface without meaningful value for this small datum.

## 004 — No client-side router in the foundation

**Status:** Accepted

The main workspace currently contains placeholder navigation only. Query-based view selection is
enough for two windows, and avoiding a router keeps the initial dependency surface small.

## 005 — CSS pixel-art placeholder

**Status:** Accepted

The buddy graphic is composed with CSS so the foundation has no external art license or asset
pipeline. It can be replaced by a designed local asset later.

## 006 — Strict tooling from the first commit

**Status:** Accepted

TypeScript strictness, type-aware ESLint, Prettier, Vitest, React Testing Library, and Rust tests are
configured before domain features are introduced.

## 007 — Desktop-first local inference

**Status:** Accepted

Local inference is a core privacy requirement, so the desktop application is the primary product
surface rather than a browser-only client.

## 008 — Ollama native API

**Status:** Accepted

The application uses Ollama's native `/api/tags` and `/api/chat` endpoints rather than a paid cloud
provider or the OpenAI compatibility API. This preserves Ollama-specific streaming fields and
requires no account or token.

## 009 — Rust-side, loopback-only networking

**Status:** Accepted

Ollama networking lives in Rust. The frontend has no unrestricted HTTP capability. Endpoints must
be unauthenticated HTTP loopback URLs with explicit ports, and production is fixed to
`127.0.0.1:11434`.

## 010 — Streaming conversation

**Status:** Accepted

Responses stream through a per-request Tauri channel. Incremental output makes small local models
feel responsive and provides a natural cancellation boundary.

## 011 — Session-only conversation storage

**Status:** Accepted

Messages remain in memory for this milestone. Persistent storage is deferred until retention,
deletion, and migration behavior can be designed explicitly.

## 012 — Deterministic buddy states

**Status:** Accepted

Application lifecycle events select buddy states from a closed union. The model cannot invent or
direct animation names.

## 013 — Manual Ollama and model installation

**Status:** Accepted

Trading Buddy does not start Ollama, execute setup commands, or download models. The interface
provides instructions and a copyable example only.

## 014 — No tool calling

**Status:** Accepted

The local model receives conversation messages only. It cannot invoke application commands,
execute shell actions, trade, browse, or access integrations.

## 015 — Narrow official-site opener capability

**Status:** Accepted

The opener plugin is included solely to open the exact official Ollama website in the default
browser. Arbitrary URL and filesystem opening are not permitted.
