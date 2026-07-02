# MVP

## Task 12C shared-session evidence

The MVP target remains a local-first desktop creature with local transcripts, memory, journal,
and optional read-only skills. Task 12 adds evidence that a Hermes/Petdex shell can support that
direction:

- visible desktop buddy at launch;
- main window hidden by default;
- pet click opens the composer;
- existing Petdex skin selection is reachable from the buddy bubble, pet menu, and tray;
- the project-owned Bubble and Companion Home share one Rust-owned session and local transcript;
- NVIDIA-hosted DeepSeek V4 Pro output is routed through the private backend/session gateway;
- stop, retry without duplicate user messages, explicit copy, five support modes, transcript
  restoration, temporary sessions, and bounded reconnect are implemented;
- default companion mode uses zero tools;
- bundled Petdex buddy art builds from project-owned temporary pose assets.

This does not close the MVP. The exact native 25-step Windows interaction walkthrough,
mixed-DPI/secondary-monitor QA, production art, signing, and broader product validation remain
open.

Task 12D now provides the guided recorder and timing evidence needed to close the native portion.
It has also found and fixed one real Tauri drag-capability defect. That fix still requires direct
drag/drop/fall/land/recover retesting, and the full walkthrough remains open.

## Goal

Validate that a local-first creature can physically live on the desktop, continue functioning
without inference, hold natural conversations, and remember a meaningful project or event
across restart under transparent user control.

## Candidate MVP scope

- Desktop buddy visible at launch without opening Companion Home.
- User-choosable pet skin through one canonical Petdex skin system.
- Attached conversation bubble for everyday chat, using cloud streaming with explicit disclosure
  and privacy-first local conversation persistence.
- Deterministic creature movement with safe spawn, walking, falling, landing, drag/drop, recovery,
  edge handling, reduced motion, and a guaranteed bring-back path.
- Geometry-only desktop surfaces: monitors, work areas, and sanitized window rectangles without
  window identity or content.
- Replaceable animation manifest with honest fallback to temporary pose assets.
- Persistent companion identity and deterministic inspectable internal state without affection or
  dependency scores.
- Respectful proactive check-in engine based on templates, cooldowns, quiet hours, Do Not Disturb,
  and idle/session timing.
- Placement behavior for free floating, left dock, right dock, and taskbar-perch positioning,
  without modifying the real operating-system taskbar.
- Companion Home for history, privacy/storage controls, development labs, and longer
  conversations.
- Local trading journal with structured entries.
- Local semantic and lexical memory with restart continuity, provenance, correction, and deletion.
- Context budgeting and compaction that preserve recent turns and original history.
- Review workflow for decisions and outcomes.
- Optional read-only market or exchange skills after a separate security review.
- Export and deletion controls for all local user data.
- Settings for privacy, data retention, and optional integrations.

## Current Task 11B evidence

- The body/runtime, settings, animation-intent, diagnostics, continuity schema, deterministic
  context budget, loopback embedding adapter, vector validation, hybrid retrieval, persistent
  consolidation jobs, conversation modes, and focused transparency controls are implemented.
- Automated FarmTown storage/retrieval testing closes and reopens a real SQLite file, recalls a
  paraphrase through a vector, applies a correction, and excludes a deleted episode.
- A real Tauri development launch confirmed that the buddy starts while Companion Home remains
  hidden.
- A real 20-turn local-Qwen transcript survived a full process restart. The already-installed
  `embeddinggemma:300m` produced persisted 768-dimensional embeddings, and a paraphrase retrieved
  the unresolved concern without injecting it into an unrelated movie query.
- The full MVP exit claim remains open until a valid real FarmTown episode/project entity,
  live correction/deletion, direct native drag/surface QA, and the bounded performance/display
  matrix pass.

## Explicit non-goals

- Custody of funds.
- Private key or seed phrase handling.
- Autonomous order execution.
- Copy trading.
- Cloud accounts or synchronization by default.
- Screen reading, screenshots, OCR, window titles, process names, keylogging, or clipboard
  monitoring.
- Affection scores, jealousy, guilt, dependency mechanics, or fake consciousness claims.
- Guaranteed predictions, returns, or financial advice.

## Foundation exit criteria

- Both desktop windows launch and behave as documented.
- Tray actions open each window and quit the application.
- Buddy position survives a relaunch.
- Frontend, Rust, and native packaging checks pass.
- Architectural and safety constraints are documented.

## Local companion milestone

- Detect local Ollama and list installed models.
- Stream a selected local model response through a typed native channel.
- Cancel active generation safely.
- Persist saved conversations locally while supporting explicit temporary chats.
- Drive buddy visuals from deterministic application lifecycle events.

## Local conversation storage milestone

- Store conversations, messages, model preference, and privacy settings in Rust-owned SQLite.
- Keep hidden thinking, system prompts, raw Ollama responses, secrets, and technical traces out of
  saved conversation content.
- Provide rename, archive, restore, delete, delete-all, retention, and export controls.
- Document that the database is local but not application-level encrypted yet.

## Companion-first desktop milestone

- Start with the buddy visible and Companion Home hidden by default.
- Single-clicking the buddy toggles the attached conversation bubble instead of opening the full
  application.
- The bubble streams local model output beside the buddy and can cancel active generation.
- The buddy uses typed `emotion + activity` visual state instead of arbitrary animation names.
- OS idle awareness exposes elapsed idle seconds only; it does not capture input, coordinates,
  screen contents, or other app text.
- Companion preferences are stored in Rust-owned settings rather than browser local storage.
- Global shortcut and launch-at-login preferences exist in the typed settings model, but the actual
  OS integrations are deferred until the official Tauri plugin surface is added and verified.

## Transparent local memory milestone

- Add Rust-owned SQLite memory tables, memory preferences, FTS index, and usage records.
- Default memory mode is enabled but `ask_every_time`; proposed memories are not used until
  confirmed.
- Add deterministic explicit commands and candidate pre-filtering before any local model
  extraction.
- Use local Qwen/Ollama only for structured memory proposals; model output is schema-validated and
  never writes directly to SQLite.
- Retrieve only relevant confirmed memories and pass them below the companion system prompt as
  labelled user-approved context.
- Show memory proposals in the desktop bubble and Companion Home without guilt or pressure.
- Provide **What Buddy Knows About Me** for search, filters, settings, confirm/reject/edit/delete,
  delete all, and separate memory export.
- Keep temporary chats isolated by default: no durable memory creation, and existing memories are
  used only if the user enables that setting.
- Keep secrets prohibited and sensitive memories disabled by default.

## Conversational journal milestone

- Add Rust-owned SQLite journal entries with stable IDs, `draft`, `completed`, and `discarded`
  statuses, private-by-default storage, and safe source links to conversations/messages.
- Include a `trading_session` journal kind so future read-only trading intelligence can link trade
  episodes to user-written plans and reflections.
- Provide desktop-bubble journaling that starts from deterministic intents, keeps writing local,
  and requires explicit **Save draft**, **Save entry**, or **Discard**.
- Provide Companion Home journal access with local search, draft filtering, entry reading/editing,
  deletion, delete-all, and local JSON/Markdown export.
- Keep journal, memory, and chat separate unless a future explicit opt-in workflow bridges them.
- Validate model-generated journal summaries/reviews as untrusted structured JSON before they can
  affect state.

## Read-only Hyperliquid milestone

- Add typed mainnet/testnet environments mapped only to official allowlisted Hyperliquid hosts.
- Validate public account addresses locally without network access.
- Store read-only integration accounts in Rust-owned SQLite with no credentials or secrets.
- Synchronize official read-only `/info` data for metadata, all mids, clearinghouse/account state,
  fills, funding, and open orders.
- Persist exact decimal strings across Rust, SQLite, and React; display formatting is separate from
  stored values.
- Provide fixture-backed sync with synthetic data for development and tests.
- Show a minimal Companion Home Trading section with account summary, positions, fills, funding,
  open orders, freshness, stale/partial/error states, pause/resume/disconnect/delete controls, and
  explicit read-only language.
- Share the selected account between Companion Home and the desktop bubble.
- Show bounded read-only trading fact cards directly in the desktop bubble.
- Build bounded local-model context from saved facts only, with read-only/staleness labels and no
  full public address or internal row IDs.
- Keep execution requests deterministic and model-free: refuse place/close/cancel/modify trade
  requests.
- Keep WebSocket live sync, charts, risk engines, trading recommendations, and execution out of
  scope.

Task 9E is paused after Rust-owned active account persistence. Hyperliquid remains an optional skill
rather than the current product direction.

## Creature-first continuity milestone

- Buddy appears without opening Companion Home and remains draggable/useful when Ollama is offline.
- Windows desktop geometry is collected through a narrow geometry-only native boundary.
- Fixed-timestep walk, gravity, landing, drag/drop recovery, safe spawn, and work-area clamping are
  implemented.
- Buddy cannot become permanently unreachable and offers a tray-level Bring Buddy Back action.
- Geometry-only monitor floors and sanitized window tops are available as creature surfaces.
- Seeded autonomy uses cooldowns and pauses during conversation or direct interaction.
- A named project or meaningful event can be recalled after restart from different wording.
- Retrieval is bounded and explains its reason without exposing hidden reasoning.
- The user can inspect, correct, forget, export, or disable continuity features.
