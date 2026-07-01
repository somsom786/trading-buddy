# Shared session ownership

Date: 2026-07-01

## Canonical runtime

```text
buddy ───────┐
bubble ──────┼─ Tauri commands/events ─ Rust AgentSessionRuntime
Home ────────┘                                │
                                             ├─ trading-buddy.db
                                             │  authoritative visible transcript
                                             │
                                             └─ JSON-RPC 2.0 over stdio
                                                   │
                                                   └─ Trading Buddy Hermes gateway
```

## Tauri/React owns

- all visible UI and Trading Buddy branding;
- buddy, bubble, and Companion Home rendering;
- user interaction and support-mode selection;
- compact transcript presentation and explicit Copy;
- Petdex skin presentation;
- strict validation of the closed Rust event contract.

React does not parse raw Hermes payloads and does not launch provider processes.

## Rust owns

- one process-wide `AgentSessionRuntime`;
- the Hermes child-process lifecycle and closed RPC allowlist;
- local conversation ↔ Hermes runtime mapping;
- active request/turn identity;
- monotonic stream sequencing, duplicate/stale rejection, and terminal idempotency;
- authoritative visible transcript persistence in `trading-buddy.db`;
- deterministic intents, safety refusal, hidden context budgeting, and post-turn scheduling;
- cross-window snapshot/event broadcasts;
- bounded reconnect and explicit retry semantics.

## Hermes owns

- provider/model execution;
- the agent conversation loop;
- streamed visible response generation;
- support-mode behavior supplied by the Trading Buddy fork;
- isolated backend runtime state required to resume its execution session.

Hermes Desktop is not launched and is not a Trading Buddy frontend.

## Sources of truth

`trading-buddy.db` is authoritative for:

- visible conversations and messages;
- message status;
- selected active conversation;
- memory, continuity, journal, and trading data;
- privacy deletion state.

A Hermes transcript is isolated backend runtime state. It is never listed directly in Trading Buddy
and cannot restore deleted local content into the visible transcript. Existing conversations are
linked lazily; Task 12C does not bulk-migrate old conversations.

## Closed protocol

Rust may call only:

- `session.create`
- `session.resume`
- `session.list`
- `session.history`
- `session.status`
- `prompt.submit`
- `session.interrupt`
- `session.close`
- narrowly scoped `trading_buddy.*` methods added for idempotency, ephemeral sessions, and cleanup

The adapter never forwards arbitrary method names. Shell, filesystem, clipboard-read, image,
approval, secret, sudo, delegation, subagent, MCP, command-dispatch, and CLI execution methods are
not exposed to React or normal companion chat.

## Temporary chat

Temporary chat has no SQLite transcript, durable session link, memory extraction, continuity
consolidation, or implicit trading context. Its Hermes execution session must be explicitly
ephemeral and destroyed when reset or closed. If the gateway cannot prove this behavior, temporary
chat remains unavailable through Hermes until the fork supplies the guarantee.

## Deletion

Deleting a local conversation removes its session link and requests backend runtime cleanup where
supported. Delete-all repeats that for all linked sessions. Memory, journal, continuity, and trading
data remain governed by their existing separate controls.

Backend cleanup is best effort because filesystem snapshots, backups, provider caches, and abrupt
process loss cannot be presented as forensic erasure.
