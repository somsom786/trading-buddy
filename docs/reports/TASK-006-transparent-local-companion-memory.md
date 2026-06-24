# Task 006 - Transparent Local Companion Memory

Date: 2026-06-24  
Project label: BETA v0.1  
Prepared for: GPT-5.5 task planner / product journal

## Baseline condition

The repository already had the Tauri 2 desktop app, React/TypeScript frontend, local Ollama/Qwen
streaming, cancellation, Rust-owned SQLite conversation storage, temporary chats, companion-first
buddy/bubble shell, tray actions, companion preferences, temporary pose assets, and automated
frontend/Rust tests.

Baseline validation before implementation was reported as passing:

- `corepack pnpm check`
- `corepack pnpm build`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`

No pre-existing automated failures were recorded.

## Implementation plan used

1. Add schema v3 for memories, memory preferences, FTS, and usage records.
2. Add Rust repository models, validation, commands, retrieval, usage logging, export, and tests.
3. Add frontend memory domain modules for intent detection, secret detection, pre-filtering,
   structured extraction validation, policy, and context construction.
4. Integrate retrieval/proposals into Companion Home and the desktop bubble without adding cloud,
   auth, crypto integrations, embeddings, or autonomous trading.
5. Add visible **What Buddy Knows About Me** controls.
6. Update docs, run validation, document limitations honestly.

## Migration and schema

Schema version advanced to 3.

New durable local data:

- `memories`
- `memory_fts` FTS5 virtual table
- FTS sync triggers for insert/update/delete
- `memory_usage_records`
- typed memory preference columns on `app_settings`

Memory rows include category, content, normalized content, status, source kind, nullable source
conversation/message IDs, confidence, importance, sensitivity, timestamps, confirmation time, last
used time, use count, expiry, and supersession link.

Foreign keys detach source provenance with `ON DELETE SET NULL`, so deleting a conversation does
not silently delete confirmed memory.

## Memory repository and settings

Rust now owns memory persistence through repository functions and typed Tauri commands for:

- preferences;
- create/list/confirm/reject/edit/delete/delete-all;
- expiry cleanup;
- retrieve;
- record/list usage records;
- separate memory export.

Default preferences:

- memory enabled;
- ask every time;
- personal memories allowed;
- sensitive memories disabled;
- memory-used indicator enabled;
- candidate notifications enabled;
- temporary memory expiry default 7 days;
- use memories in temporary chats disabled.

## Candidate pre-filter and explicit intents

Frontend domain logic now supports deterministic intents:

- `remember_explicit`
- `forget_explicit`
- `list_memories`
- `disable_memory_for_message`
- `disable_memory_for_conversation`

The pure pre-filter avoids extraction for temporary chats, memory-off, opt-outs, greetings,
acknowledgements, question-only messages, hypotheticals, quoted external content, assistant
messages, and obvious fake-secret patterns.

## Local Qwen structured extraction

Task 6 adds a focused JSON-only extraction prompt and strict parser/validator. The local model may
propose candidates, but it cannot write directly to SQLite.

Validation rejects:

- malformed JSON;
- unknown categories/sensitivities/actions;
- empty or vague content;
- content over the memory length cap;
- instruction-like content;
- prohibited/fake-secret-shaped content;
- duplicate candidates;
- more than three candidates.

Extraction runs as a background workflow after the visible chat request path; failures are
non-blocking.

## Sensitivity and secret handling

Secrets are prohibited at both frontend validation and Rust storage validation. Tests use fake
values only.

Sensitive memories are disabled by default and excluded from retrieval/export unless explicitly
enabled/requested.

## Proposal experience

The desktop bubble and Companion Home can show a proposal card:

```text
Buddy wants to remember
"..."
[Remember] [Edit] [Not now]
```

Rejecting or deleting a memory sets a neutral buddy state. No guilt or dependency language was
added.

## What Buddy Knows About Me

Companion Home now includes a user-facing memory section with:

- confirmed memories;
- pending proposals;
- expiring memories;
- rejected memories;
- settings;
- search;
- category/sensitivity filters;
- sort by updated/used;
- source/category/sensitivity/usage/expiry metadata;
- edit/confirm/reject/delete;
- delete all;
- separate memory export;
- sensitive export opt-in warning via confirmation.

## Retrieval, ranking, and context construction

Retrieval uses SQLite FTS5 over confirmed memories plus deterministic scoring by keyword matches,
importance, small usage bonus, and ID tie-breaker. Proposed, rejected, expired, superseded, and
default-sensitive memories are excluded.

Relevant confirmed memories are inserted below the companion system prompt as labelled user-approved
context. Memory text is escaped and bounded. Memory is treated as context, not as authority.

## Memory-used transparency

When memories are supplied as context, the UI shows a subtle “Used N confirmed memories” indicator.
Usage records store memory IDs, conversation IDs, optional assistant message IDs, timestamps, and
reason codes only. They do not store hidden reasoning.

## Export and deletion

Memory export is separate from conversation export and uses format `trading-buddy-memories`.
Sensitive memories are excluded unless the user chooses sensitive export.

Deleting memories does not delete conversations. Deleting conversations does not delete memories;
source pointers are detached.

## Tests added

Frontend:

- intent detection;
- candidate pre-filter;
- structured extraction validation;
- secret detection;
- memory context construction;
- storage type boundary updates.

Rust:

- memory preference persistence;
- memory lifecycle;
- confirmed-only retrieval;
- sensitive/expired/superseded exclusions;
- fake-secret rejection;
- usage logging;
- source detachment after conversation deletion;
- separate memory export/delete behavior.

## Commands run during implementation

Successful:

- `cargo test --manifest-path src-tauri/Cargo.toml`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm format`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `corepack pnpm lint`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`

Final validation totals at report-writing time:

- Frontend tests: 28 files, 103 tests passing.
- Rust tests: 41 passing.
- ESLint: passing with zero warnings.
- TypeScript strict check: passing.
- Rust fmt check: passing.
- Clippy with warnings denied: passing.

## Not yet verified

The following were not honestly verified yet:

- full real-desktop local-Qwen manual flow after restart;
- memory-used indicator with a real local Qwen response;
- native memory export file inspection through the save dialog;
- full tray/WebView manual click-through after Task 6;
- 100/1,000 memory performance fixtures;
- exhaustive multi-window race testing between separate bubble and Companion Home webviews.

## Known limitations

- Conflict-resolution UX is basic; contradictory memories do not yet show a dedicated “replace old
  vs keep both” proposal flow.
- Natural-language forgetting is detected but not fully wired to an ambiguous-match selection UX.
- Memory Lab fixture generation is not yet a full development-only lab.
- Extending/restoring/converting expiring memories is currently handled only through basic edit
  paths.
- The database remains local but not application-level encrypted.
- The temporary pose pack remains non-production art.

## Security and privacy boundaries preserved

No embeddings, vector database, cloud sync, account/auth system, crypto integration, wallet/private
key handling, browser extension, voice, screen reading, keylogging, telemetry, journal/trade
analysis, or autonomous trading functionality was added.

## Recommended Task 7

Task 7 should focus on hardening and QA of memory rather than expanding product scope:

1. Full real-desktop local-Qwen manual verification.
2. Dedicated Memory Lab with safe fixtures and 100/1,000 memory performance runs.
3. Conflict/update proposal UX.
4. Natural-language forgetting selection flow.
5. Better shared proposal queue tests across real separate windows.
6. Manual export inspection and privacy copy review.
