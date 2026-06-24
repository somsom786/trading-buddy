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

## 016 — Rust-owned SQLite conversation storage

**Status:** Accepted

Conversation data is stored in SQLite through Rust repository code using `rusqlite` with bundled
SQLite. React calls typed Tauri commands and never receives raw SQL access. SQLite is mature,
local-first, easy to test with temporary databases, and sufficient for durable conversations,
settings, retention, and export without running a separate backend server.

## 017 — No raw SQL exposed to React

**Status:** Accepted

The frontend receives specific commands for conversations, messages, settings, retention, export,
and deletion. A generic SQL command would make validation, permissions, migrations, and privacy
guarantees much harder to reason about.

## 018 — Local conversation content by default

**Status:** Accepted

Saved conversations remain on the user's device in Tauri's app-local data directory. This supports
the local-first product boundary and avoids cloud accounts, telemetry, remote databases, and cloud
backups.

## 019 — Application-level encryption deferred

**Status:** Accepted

The SQLite database is not claimed to be encrypted. Correct application-level encryption needs key
management, recovery behavior, migration testing, export implications, and clear UX. Until that is
implemented and verified, documentation states the limitation and points users to operating-system
disk encryption as a separate layer.

## 020 — Hidden thinking is never persisted

**Status:** Accepted

Ollama thinking chunks are treated as non-visible provider metadata. They are not rendered as chat
messages, not checkpointed, and not exported. The same boundary applies to system prompts and future
model-internal reasoning.

## 021 — Deterministic local conversation titles

**Status:** Accepted

Initial titles are derived from the first user message by normalizing whitespace and applying a
bounded length. The LLM is not called for title generation, which keeps startup fast, predictable,
private, and testable.

## 022 — Checkpoint assistant content instead of token-level writes

**Status:** Accepted

Streaming output is buffered and checkpointed after a character threshold or short interval, then
finalized on completion, cancellation, or failure. This avoids excessive disk writes while
preserving most visible generated content if the application exits unexpectedly.

## 023 — Temporary chats are explicit

**Status:** Accepted

Temporary chat is off by default and visibly labeled when enabled. It uses the same local model
pipeline but does not create conversation/message rows. Switching modes starts a new session rather
than silently converting private temporary content into saved history.

## 024 — Retention defaults to keep-until-delete

**Status:** Accepted

The default policy is `Keep until I delete`. Automatic 30-day and 90-day cleanup are available, run
from Rust, and use UTC latest activity timestamps. Archived conversations are also subject to the
selected retention policy.

## 025 — Honest deletion limitations

**Status:** Accepted

Delete-all clears conversation rows, clears last-opened state, checkpoints the WAL, vacuums, and
uses SQLite `secure_delete = ON`. The product still does not promise forensic erasure because SSD
wear leveling, OS caches, backups, filesystem snapshots, and external tools can retain data.

## 026 — Native save dialog for export

**Status:** Accepted

Conversation export uses a native save-file dialog via `rfd` so the frontend never supplies
arbitrary filesystem paths. The extra dependency is limited to user-selected local file export;
alternatives were delaying export or exposing a path-taking command, which would weaken the current
security boundary.

## 027 - Filename-only export feedback

**Status:** Accepted

The native export command still receives the user-selected filesystem path, but the normal React UI
reports the export by filename only. This keeps export confirmation useful while avoiding unnecessary
display of private directory names in the chat workspace.

## 028 - Debug-only storage diagnostics and fixtures

**Status:** Accepted

Storage diagnostics expose counts, schema version, safe database summary, retention metadata, and
availability state without raw SQL or message contents. The interrupted-generation fixture is guarded
to debug builds because it intentionally creates test data and should not be available as a release
feature.

## 029 - Creature-first product hierarchy

**Status:** Accepted

Trading Buddy's primary interface is the desktop creature, not the full application shell. The
normal window is now framed as Companion Home for history, privacy, storage, development labs, and
future deeper tools. This keeps everyday interaction lightweight and close to the desktop while
preserving the existing full workspace for longer sessions.

## 030 - Single click toggles the bubble

**Status:** Accepted

A normal click on the buddy toggles the attached conversation bubble instead of opening Companion
Home. Opening the full application is now explicit through the bubble, tray, or other intentional
actions. This avoids treating the buddy as decoration for a traditional chat app.

## 031 - Separate attached bubble window

**Status:** Accepted

The desktop conversation surface is a separate transparent, taskbar-skipped Tauri window. Keeping
the buddy window compact prevents large invisible hit areas around the creature and lets the bubble
flip beside the buddy near screen edges. The tradeoff is more native window coordination, which is
kept behind `windowService` and Rust window-manager functions.

## 032 - Deterministic ambient life

**Status:** Accepted

Breathing, blinking, looking, sitting, stretching, sleeping, and waking are selected by a testable
domain engine with injected time and randomness. The LLM cannot request arbitrary animations or
change activity priority. This keeps visual behavior predictable, bounded, and replaceable by a
future sprite renderer.

## 033 - Deterministic proactive triggers with template content

**Status:** Accepted

Proactive check-ins are gated by deterministic preference, cooldown, quiet-hours, busy-state, sleep,
dismissal, and bubble-open rules. Content is currently a small local template set. LLM-generated
proactive content is deferred so the product does not create manipulative, noisy, or unreviewed
messages.

## 034 - No screen reading or global input capture

**Status:** Accepted

The idle integration reads elapsed OS idle duration only. It does not capture keys, mouse
coordinates, screen contents, window titles, browser pages, exchange apps, or other application
text. This preserves the local-first privacy boundary and avoids surprising surveillance behavior.

## 035 - Taskbar perch does not modify the taskbar

**Status:** Accepted

Taskbar perch is a visual placement mode above the usable work area. The app does not inject into,
hook, replace, or modify Windows Explorer or the real taskbar.

## 036 - Random walking deferred

**Status:** Accepted

The buddy may shift subtly as part of placeholder animation, but it does not wander across the
screen. Uncontrolled movement could block user work, steal attention, or feel surprising. Any
future walking behavior needs explicit product approval and desktop-interference testing.

## 037 - Final art deferred

**Status:** Accepted

The BETA v0.1 concept board remains a reference only. Runtime visuals use CSS placeholders and
typed state hooks so production sprite sheets can be introduced later with clear ownership and
licensing.

## 038 - Windows idle dependency

**Status:** Accepted

`windows-sys` is included for the narrow Windows last-input timing API. Alternatives were polling
from frontend events, which would miss OS-level idle time, or adding a larger plugin before the
privacy boundary was proven. The dependency is limited to elapsed idle seconds and is isolated in
the native layer.

## 039 - Global shortcut and launch-at-login deferred

**Status:** Accepted

Task 5 persists typed preferences for global shortcut and launch at login, but does not register a
global shortcut or enable OS autostart yet. Those features require official Tauri/native plugin
integration, failure handling, user-facing settings, and manual OS verification.

## 040 - Reference sheet is not rendered directly

**Status:** Accepted

The buddy reference sheet is concept material, not a runtime sprite sheet. It contains an opaque
grey background, grid separators, palette swatches, a silhouette preview, and differently sized
cells. Rendering it directly or using CSS background-position against it would leak source-sheet
artifacts into the transparent desktop buddy. Runtime uses extracted transparent pose PNGs instead.

## 041 - Reproducible pose extraction

**Status:** Accepted

Pose assets are generated by `scripts/extract-buddy-poses.mjs` from an explicit crop configuration.
The script validates source dimensions, removes background-like pixels, trims each pose, aligns
standing baselines, and writes lossless PNGs. This keeps binary asset updates explainable and
repeatable instead of relying on manual image edits.

## 042 - `pngjs` for development-only PNG processing

**Status:** Accepted

`pngjs` is added as a small development dependency for deterministic PNG decoding/encoding in the
extraction script and asset tests. Alternatives were manual PNG parsing/encoding, which would be
fragile and distract from product work, or introducing a heavier image-processing stack. Runtime
code does not depend on `pngjs`.

## 043 - Typed pose names and deterministic selection

**Status:** Accepted

Pose IDs are a closed TypeScript union. Runtime assets are exposed through one manifest, and
`BuddyVisualState` maps to approved pose IDs through deterministic domain logic. The LLM cannot
select arbitrary image files, source-sheet coordinates, or animation names.

## 044 - CSS motion remains temporary

**Status:** Accepted

The extracted assets are static poses, not animation frames. Temporary breathing, looking,
thinking, talking, writing, happy, and sleeping motion uses restrained CSS transforms that respect
reduced motion. Production sprite animation remains deferred until original frame animation and
artist cleanup are deliberately produced.

## 045 - Transparent memory before clever memory

**Status:** Accepted

Task 6 implements visible, editable, user-approved memories before semantic embeddings or hidden
profile-building. Memory is a relationship feature only if the user can inspect and correct it.
The default approval mode is `ask_every_time`; proposed memories are never used as facts until
confirmed.

## 046 - Embeddings and vector databases deferred

**Status:** Accepted

SQLite FTS5 plus deterministic ranking is sufficient for the first local memory milestone and is
easy to inspect, test, export, and delete. Embeddings may be added later behind the retrieval
interface, but adding a vector database now would increase dependency and privacy surface before the
approval UX is proven.

## 047 - Secrets are prohibited memory content

**Status:** Accepted

Passwords, seed phrases, private keys, API keys, authentication tokens, and recovery codes are never
valid companion memories. Deterministic fake-secret-pattern detection rejects obvious cases before
storage. The UI refusal avoids echoing the full secret back.

## 048 - Sensitive memory disabled by default

**Status:** Accepted

Sensitive memories require explicit user enablement and approval. Trading preferences, general risk
rules, and project goals can be personal without being automatically sensitive, but health,
political, religious, sexual, precise-location, and similarly private facts are not auto-saved.

## 049 - Temporary chats do not create durable memory

**Status:** Accepted

Temporary chats remain in-memory-only by default. They do not create memory proposals, and existing
confirmed memories are not retrieved there unless the user explicitly enables
`useMemoriesInTemporaryChat`.

## 050 - Memory is context, not authority

**Status:** Accepted

Confirmed memories are added below the companion system prompt as labelled user-approved context.
They are treated as potentially outdated and cannot override safety rules, privacy boundaries, or
the user's current message.

## 051 - Memory deletion and conversation deletion are separate

**Status:** Accepted

Deleting a source conversation detaches memory provenance with `ON DELETE SET NULL` but does not
silently delete approved memories. Deleting memories does not delete conversations. This keeps the
two user intents distinct and auditable.
