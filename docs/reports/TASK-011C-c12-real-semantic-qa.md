# Task 11C — C12 real semantic QA handoff

Date: June 29, 2026

## Outcome

C12 made substantial real-desktop progress, but Task 11 remains open. The required full completion
claim is not supported because the final durable run did not create a valid FarmTown episode or
FarmTown entity, live correction/deletion were not completed, and direct human pointer/display QA
and the full performance matrix remain unverified.

## What changed

- Excluded embedding-only Ollama models from chat model discovery.
- Added native JSON-Schema-constrained consolidation plus one strictly validated repair pass.
- Delayed/coalesced background consolidation instead of immediately competing after every turn.
- Prevented dropped local-AI worker clones from cancelling visible chat.
- Closed the final-stream-event/native-command race for rapid consecutive messages.
- Fixed new-chat reload, completed-message status, equal-timestamp message ordering, optional
  continuity serialization, and transient startup IPC handling.
- Added a relevance-evidence gate and calibrated semantic threshold so paraphrases can retrieve an
  important concern while an unrelated movie query returns no continuity.
- Updated the desktop document title to BETA v0.2.

## Real model and desktop evidence

- Ollama remained loopback-only and `embeddinggemma:300m` was already installed; the app did not
  download it.
- `/api/embed` returned 768 finite normalized values for one input and three 768-value vectors for a
  bounded batch. Warm observations were about 175–181 ms; the first cold observation was about
  9.9 seconds. A missing model returned HTTP 404. Complete vectors were never logged.
- A real Tauri WebView completed 20 meaningful user turns and 20 Qwen assistant turns. The durable
  transcript survived a genuine process shutdown and restart.
- Qwen structured consolidation exposed real model-compatibility failures: `qwen3.5:9b` frequently
  ignored the shape, while `qwen3:8b` timed out on the full transcript. Bounded retry stopped after
  three attempts.
- A final local `llama3.1:8b` consolidation completed in one attempt and persisted one summary, one
  entity, six current-life records, and seven embeddings. Semantic state was `ready`.
- After all Trading Buddy/dev processes and ports reached zero, the restarted app restored 20 user
  and 20 assistant messages plus the persisted continuity records.
- After restart, “What was I nervous about with that farming game?” retrieved only the relevant
  high-importance current-life concern through `semantic_similarity`.
- “What movie should I watch?” initially reproduced irrelevant injection. After the retrieval fix it
  returned zero continuity records.

## Architecture decisions

- Ollama JSON Schema constrains consolidation generation, but Rust Serde and repository validation
  remain authoritative.
- Transport wrappers may be stripped around one JSON object; wrong fields/types/enums still fail.
- Retrieval requires lexical, entity/project, or calibrated semantic evidence. Importance and
  recency alone cannot inject continuity.
- Visible conversation generation remains higher priority than background work.

## Verification

- Prettier write/check: passed.
- ESLint: passed with zero warnings.
- Strict TypeScript: passed.
- Vitest: 44 files / 168 tests passed.
- Frontend production build: passed.
- Rust formatting: passed.
- Rust tests: 88 passed.
- Clippy with all targets/features and warnings denied: passed.
- Tauri debug no-bundle build: passed.
- Tauri release no-bundle build: passed after removing the observed release-only warning.
- `git diff --check`: passed.

## Still unverified or incomplete

- A valid FarmTown episode and FarmTown project entity were not present in the final real run.
- Live correction/re-embedding and episode deletion/exclusion were not completed because no valid
  episode existed; disk-backed automated correction/deletion coverage still passes.
- Direct human click/drag/drop, moving-window following, and reduced-motion interaction were not
  certified by a human.
- The machine had two monitors (secondary at negative X), but mixed DPI, display rotation,
  disconnect/reconnect, taskbar relocation, and all requested scaling values were not exercised.
- The complete 100/1,000/10,000-record and 1,000-turn performance matrix was not run.
- Missing merge/pin/relationship/source-navigation/expiry controls remain.

## Recommended next task

Keep Task 11 at C12. Add a small model-compatibility policy for structured consolidation, then rerun
the FarmTown extraction until a valid project episode/entity exists. Complete live
correction/deletion and a user-driven pointer/display checklist, followed by the bounded performance
matrix. Do not begin the frontend redesign or make the full completion claim before those gates pass.
