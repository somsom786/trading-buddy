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

## 052 - Memory update proposals supersede only after confirmation

**Status:** Accepted

When a new memory appears to update an existing confirmed memory, the replacement can reference the
old memory through `supersedesMemoryId`, but the old memory is not marked `superseded` until the
replacement is confirmed. This keeps reviewable proposals from silently changing Buddy's active
understanding.

## 053 - Memory Lab is debug tooling, not product surface

**Status:** Accepted

The development Memory Lab exposes bounded diagnostics, fixture generation, fixture cleanup, and
retrieval timing only in development builds. It exists to prove memory reliability at 100 and 1,000
local memories without turning the user-facing memory panel into a dashboard.

## 054 - Journal is separate from chat and memory

**Status:** Accepted

Journal entries are their own local records rather than renamed conversations or memories. A chat
transcript preserves dialogue, a memory preserves small user-approved facts, and a journal entry
preserves user-authored reflection. Keeping the stores separate makes deletion, export, search,
privacy, and future trade-linking easier to audit.

## 055 - Journal save is explicit

**Status:** Accepted

The desktop bubble can start a guided or free-write journal session, but the user must choose
**Save draft**, **Save entry**, or **Discard**. The app does not silently convert emotional or
trading conversations into durable journal records.

## 056 - `trading_session` journal kind now, trade links later

**Status:** Accepted

The journal schema includes a `trading_session` kind before exchange integrations exist. This gives
future read-only trading intelligence a stable target for pre-trade plans, post-trade reviews, and
session reflections without requiring a journal migration during the Hyperliquid milestone.

## 057 - SQLite FTS for local journal search

**Status:** Accepted

SQLite FTS5 is used for bounded local journal search. It stays inside the Rust-owned database,
requires no cloud service, and avoids adding a search dependency before journal usage patterns are
proven.

## 058 - Model journal output must be strictly parsed

**Status:** Accepted

Local model suggestions for journal summaries, reflections, or daily reviews are treated as
untrusted. Only bounded strict JSON that passes TypeScript domain validation can be surfaced as a
suggestion, and the user still edits/saves before durable state changes.

## 059 - Journal Lab is development-only

**Status:** Accepted

Journal diagnostics and 100/1,000 fixture generation are exposed only in development builds. They
exist to test search, storage, and cleanup behavior without turning the user-facing journal into a
database dashboard.

## 060 - Hyperliquid starts read-only

**Status:** Accepted

Hyperliquid is the first trading integration, but Task 9B exposes only official read-only `info`
requests. The application has no private-key fields, seed phrase fields, wallet signing, exchange
API secrets, order placement, order cancellation, withdrawals, transfers, agent approval, generic
RPC, or generic HTTP proxying. Future execution would require a separate explicit product decision.

## 061 - Official host allowlist for Hyperliquid

**Status:** Accepted

The frontend passes only typed `mainnet` or `testnet` values. Rust maps those values internally to
`https://api.hyperliquid.xyz/info` and `https://api.hyperliquid-testnet.xyz/info`. React cannot
override the URL or provide arbitrary request bodies.

## 062 - Decimal strings for authoritative trading values

**Status:** Accepted

Provider prices, sizes, account values, PnL, fees, funding, leverage, and margin values are
validated as decimal strings in Rust, stored as text in SQLite, and sent to React as strings.
JavaScript performs display formatting only. This avoids accidental binary floating-point rounding
for financial truth.

## 063 - Fixture sync before live QA

**Status:** Accepted

Task 9B includes synthetic provider-shaped Hyperliquid fixtures and fixture-backed sync so
development and CI can prove parsing, persistence, and idempotency without using a real account.
Optional live QA requires an explicit public address and never uses credentials.

## 064 - Hyperliquid active sync coordination is local process state

**Status:** Accepted

Task 9C adds an in-memory sync coordinator for one active Hyperliquid refresh per account,
cooperative cancellation, and progress. Active progress is transient because it is only meaningful
while the desktop app process is running. Durable outcomes are still stored as sync runs in SQLite.

The coordinator does not introduce background autonomous syncing, order placement, signing, wallet
SDKs, private-key handling, arbitrary URLs, or cloud services.

## 065 - Fixture scenarios have durable identity

**Status:** Accepted

Fixture accounts store `fixture_scenario` separately from `display_name` in SQLite schema v6.
Synthetic fixture addresses are deterministic per scenario so multiple QA scenarios can exist side
by side without duplicate-account collisions. This keeps display names user-facing and keeps fixture
behavior explicit.

## 066 - Desktop trading awareness uses saved facts only

**Status:** Accepted

The desktop bubble can show Hyperliquid account, position, fill, funding, order, and sync cards,
but it reads from the same local saved data exposed by narrow Tauri commands. It does not add
WebSocket live sync, background monitoring, arbitrary URLs, screen reading, exchange app
inspection, trading recommendations, or execution. This keeps the companion useful during desktop
work without turning it into an autonomous market agent.

## 067 - Trading context for local models is bounded and labelled

**Status:** Accepted

When a trading fact intent is detected, React may provide the selected local model with a bounded
context block built from saved read-only facts. The builder excludes full public addresses,
internal row IDs, raw provider JSON, and unbounded lists; labels fixture data, freshness, partial
sync state, and exchange-reported values; and repeats that execution capability is none. Execution
requests are refused deterministically without a model call.

## 068 - Active trading account selection is Rust-owned

**Status:** Accepted

Task 9D used browser storage for the selected Hyperliquid account because desktop trading cards
were frontend-only. Task 9E moves that selection into the Rust-owned SQLite `app_settings` row as a
nullable foreign key to `integration_accounts`. This creates one durable source of truth shared by
Companion Home and the desktop bubble, lets account deletion clear the selection automatically, and
keeps future live-sync/reconstruction coordinators from depending on WebView-local state.

The frontend may migrate and remove the old browser key once, but it no longer treats
`localStorage` as authoritative. Active-account changes are sent to windows as sanitized account-ID
events, not raw account records or provider payloads.

## 069 - Pause Task 9E after E1

**Status:** Accepted

Live Hyperliquid WebSockets, reconstruction, risk dashboards, and advanced exchange infrastructure
are paused after the completed Rust-owned active-account checkpoint. The existing read-only
provider remains functional as an optional skill. Continuing exchange depth now would optimize a
dashboard while the core creature, continuity, and presence experience remains immature.

## 070 - The living creature is the product

**Status:** Accepted

The product hierarchy starts with physical desktop presence, then companion identity,
conversation, continuity, routines, optional skills, and finally Companion Home. The large window
is an inspection and settings surface, not the default product. Creature behavior must remain
useful when Ollama is unavailable.

## 071 - Shimeji is behavioral inspiration only

**Status:** Accepted

Shimeji demonstrates independent movement, direct pickup/dragging, and screen-surface presence.
Trading Buddy will implement those principles independently with its original character and
architecture. No Shimeji art, character packs, action data, or extension code may be used.

## 072 - Odysseus is architectural inspiration only

**Status:** Accepted

Odysseus informed concepts such as explicit memory commands, provider fallback, bounded context,
compaction, semantic/lexical degradation, and restart-safe background jobs. It is licensed
AGPL-3.0-or-later. No Odysseus code, prompts, tests, schemas, docs, or assets were copied or adapted.
Any future source-level reuse requires explicit owner approval and a separate licensing review.

## 073 - Desktop awareness is geometry-only

**Status:** Accepted

Creature movement may use monitor bounds, work areas, sanitized top-level window rectangles,
buddy/bubble geometry, and an explicitly requested cursor coordinate. Window titles, process or
application names, URLs, pixels, screenshots, text, keystrokes, clipboard content, and
accessibility trees are prohibited. Unsupported platforms expose monitor-only fallback geometry
until their native behavior is verified.

## 074 - Companion state without attachment metrics

**Status:** Accepted direction; implementation continues in Task 10 M5

Buddy may have deterministic, inspectable internal state for energy, focus, mood, and activity.
It will not have affection, attachment, jealousy, dependency, streak-pressure, or guilt metrics.
State exists to make behavior coherent, not to manipulate the user.

## 075 - Skills remain secondary

**Status:** Accepted

Journal, reminders, read-only trading, and future tools are skills beneath the companion and memory
layers. Skills are loaded or queried through explicit surfaces and intents; they do not define
Buddy's identity or enter every conversation.

## 076 - Local models remain the default intelligence boundary

**Status:** Accepted

Local Ollama remains the default model provider and production endpoints stay loopback-only.
Physical creature behavior, local data inspection, journal writing, and lexical continuity must
degrade gracefully when the model is unavailable. Cloud model routing is not introduced by Task 10.

## 077 - Run creature physics outside React at a fixed timestep

**Status:** Accepted

Creature physics is framework-independent domain code advanced by a bounded 30 Hz fixed-step
accumulator. React receives state for rendering but does not own time, collision, or movement.
This keeps movement deterministic in tests and prevents WebView render frequency from changing the
simulation.

## 078 - Clamp native movement and persist only meaningful placement

**Status:** Accepted

Every programmatic buddy move is clamped against current native work areas before the window is
moved. Startup restoration uses the same boundary, and Bring Buddy Back selects a safe visible
location. Autonomous ticks are not written to storage; placement is persisted after direct native
drag completion and explicit bring-back actions to avoid continuous filesystem writes.

## 079 - Keep native Tauri dragging as the sole drag owner

**Status:** Accepted

The renderer distinguishes click from drag with a six-pixel threshold, then delegates movement to
Tauri's native window drag. The simulation observes drag start and completion but does not run a
second pointer-following implementation. This avoids ghost movement, competing offsets, and
duplicate native calls.

## 080 - Treat current character poses as honest state fallbacks

**Status:** Accepted

The temporary project artwork may represent locomotion states while the behavior engine matures,
but static images are not described as frame animation. The animation-intent layer allows future
sprite clips to replace pose fallbacks without changing physics or planning rules.

## 081 - Keep stable facts authoritative in the existing memory store

**Status:** Accepted

Conversation summaries compress continuity, episodes represent events, entities identify named
things, and current-life context is temporary. None becomes a second authoritative store for
stable user facts. Existing confirmed memories remain intact and primary.

## 082 - Persist local vectors as validated SQLite float32 BLOBs

**Status:** Accepted

Embedding metadata stays relational while normalized vectors use little-endian float32 BLOBs.
Dimension, byte length, finite values, provider/model, and SHA-256 content hash are validated.
External vector services, ChromaDB, Docker, and cloud embeddings add unnecessary dependency and
privacy surface.

## 083 - Make consolidation durable but subordinate to visible chat

**Status:** Accepted

Consolidation jobs persist in SQLite, coalesce by conversation source version, recover after
restart, retry at most three times, and run only through the local Ollama boundary. Visible
conversation generation rejects competing background model work. Model output is a proposal bundle
validated before one transactional storage write.

## 084 - Add SHA-256 through the small `sha2` crate

**Status:** Accepted

`sha2` is used only for deterministic local embedding content hashes and stale-vector detection.
Writing cryptographic hashing code in-project would be riskier and less auditable; a process-random
standard-library hasher would not provide durable identity across launches.

## 085 - Constrain consolidation with native JSON Schema

**Status:** Accepted

Prompt-only JSON mode was not reliable across installed local models on a long real transcript.
Continuity consolidation now supplies an exact Ollama JSON Schema and still treats Rust Serde plus
repository validation as authoritative. One bounded repair pass may normalize a candidate, but
model output never writes directly to SQLite.

## 086 - Require query evidence before continuity injection

**Status:** Accepted

Importance, recency, and record type are ranking signals, not relevance evidence. A continuity item
must have lexical, entity/project, or calibrated semantic evidence before entering context. A
slightly lower semantic threshold is allowed only for explicitly high-importance records; this
preserves paraphrase recall while excluding an observed unrelated movie query.

## 087 - Non-destructive Hermes/Petdex reformation track

**Status:** Accepted for experimental preview

Task 12 adds Hermes Agent as a submodule under `next/agent` instead of replacing the existing Tauri
application. This keeps the current app recoverable, lets the team evaluate Hermes Desktop and
Petdex with real runtime evidence, and preserves the local-first product boundary while migration
is still undefined.

The large dependency surface is documented here because Hermes is intentionally a full upstream
agent/desktop system, not a small library. Alternatives considered were continuing only on the
Tauri shell or copying selected code into this repository. A submodule is more auditable and keeps
upstream provenance explicit.

## 088 - Default Hermes companion mode has no tools

**Status:** Accepted

The Hermes preview adds `trading-buddy-companion` as an empty toolset. Pet conversation can stream
through the local model and persist a session, but cannot call file, shell, browser, exchange,
wallet, network, or trading tools. Future tools require separate product approval, narrow typed
interfaces, validation, tests, and documentation.

## 089 - Petdex adapter validates local bundled pets

**Status:** Accepted

The reformation preview uses Petdex's current 192 by 208 cell and 1536 by 1872 atlas convention.
The local adapter rejects path traversal, absolute paths, executable/script metadata, and wrong
atlas dimensions before a pet pack is treated as valid.
