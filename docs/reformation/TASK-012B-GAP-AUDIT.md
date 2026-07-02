# TASK 012B Gap Audit — Actual Companion Experience

Date: 2026-06-29  
Branch: `codex/task-12b-pet-skins-ui`

## July 1 Task 12C update

The former shared-session implementation gaps are now closed in code and automated coverage:

| Area                              | Task 12C status                                                                |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Tauri-to-Hermes shared session    | Implemented; one process-wide Rust runtime over typed private stdio            |
| Bubble/Home shared live stream    | Implemented and covered by shared-session UI tests                             |
| Support modes                     | Implemented as separate metadata and verified by the real gateway suite        |
| Stop/retry/copy                   | Implemented; retry persistence proves one user message and multiple attempts   |
| Transcript reopen/restart         | Implemented from Rust-owned SQLite and lazy mapped-session resume              |
| Temporary chat                    | Implemented with no SQLite mapping and explicit Hermes ephemeral mode          |
| Backend reconnect                 | Implemented with bounded restart and no blind resubmission                     |
| Privacy cleanup                   | Implemented with backend purge attempts plus authoritative local deletion      |
| Real gateway/Ollama stream        | Passed with the pinned gateway and installed local `qwen3:8b`                  |
| Exact 25-step Windows walkthrough | Still incomplete; native interaction and mixed-DPI steps remain directly unrun |

The historical audit below remains useful evidence of why Task 12C was required, but its
“not implemented” rows no longer describe the current branch. Task 12B/12C must still remain open
until the exact native walkthrough is completed without silently converting automated evidence
into interaction evidence.

## July 2 Task 12D update

Task 12D now supplies the development-only recorder and safe diagnostics needed for that exact
walkthrough. A live run exposed and fixed a missing Buddy drag capability. The retest and remaining
human-observed steps are still open, so the gap audit remains unresolved at the acceptance layer.

## June 30 architecture correction

The matrix below records the state of the former Hermes Desktop preview and is retained as
historical evidence. It no longer describes the canonical product shell.

The project-owned Tauri/React application is now the only Trading Buddy frontend. Hermes is a
backend/session logic donor only, DyberPet is a behavior reference without copied implementation,
and Petdex is consumed through a validated read-only manifest boundary.

| Corrected area                                                 | Current status                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Project-owned frontend and branding                            | Implemented and live-verified                                            |
| Hermes Desktop removed from canonical launch                   | Implemented and verified through launcher configuration and live smoke   |
| Compact attached bubble                                        | Implemented and live-verified at `300 × 220` with a four-pixel buddy gap |
| Taskbar/right-edge placement                                   | Implemented and live-verified                                            |
| Five-second development sleep and hover wake                   | Implemented, tested, and live-verified                                   |
| Petdex skin picker and persistence                             | Implemented, tested, and live-verified with local fallback               |
| Backend support-mode request context                           | Implemented and covered by focused backend tests                         |
| Tauri-to-Hermes shared session and stream                      | Not implemented                                                          |
| Stop/retry/copy/reconnect and duplicate safety in canonical UI | Not implemented end to end                                               |
| Exact 25-step Windows acceptance walkthrough                   | Not run against the corrected architecture                               |

Task 12B therefore remains **open**. The next correction is the narrow Tauri-to-backend session
bridge; no further frontend replacement or architecture pivot is recommended.

## Evidence standard

This audit intentionally does not treat an existing interface, file, or test name as proof that the
companion experience works. A criterion is only marked as verified when there is either a focused
automated test proving the behavior or a completed Windows runtime walkthrough proving the user-facing
behavior.

The current state is not a finalized Task 12B companion. Previous work established packaging,
launcher, Petdex menu, warm visual direction, and the detached overlay shell, but several actual
companion behaviors remain missing or unproved.

## Status legend

- `implemented and verified`: implemented with direct automated or manual evidence.
- `implemented but unverified`: code appears to exist, but current verification has not proven the
  behavior end-to-end.
- `partially implemented`: part of the behavior exists, but important acceptance details are missing.
- `not implemented`: no meaningful implementation found.
- `broken`: implementation exists but is known to fail.

## Required acceptance criteria audit

| Criterion                           | Status                     | Evidence / gap                                                                                                                                                                                                                                   |
| ----------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One canonical launcher              | implemented but unverified | `next:dev` exists as the intended route, and prior packaging used the desktop app path. This still needs a fresh process audit proving there is one user-facing launcher and no competing preview route.                                         |
| One Hermes backend                  | implemented but unverified | Prior runtime work targeted one Hermes desktop backend. This correction requires a fresh Windows process check before claiming it.                                                                                                               |
| Legacy pet disabled                 | implemented but unverified | The legacy Tauri foundation remains in the repo but is not the current desktop runtime. Need a launcher walkthrough proving the old pet/bubble does not appear.                                                                                  |
| Main app hidden on companion launch | implemented but unverified | Companion mode has code paths for starting with the overlay first, but current manual runtime proof is missing.                                                                                                                                  |
| Pet movement                        | partially implemented      | A tested, reduced-motion-aware short-walk scheduler now drives left/right state and persisted overlay bounds. A real desktop observation is still required.                                                                                      |
| Drag                                | partially implemented      | Pointer drag moves the overlay, applies the canonical `dragged` state, and routes all bounds through native display clamping. Runtime pointer/DPI verification remains open.                                                                     |
| Release                             | partially implemented      | Release now applies bounded horizontal inertia, gravity, and a deterministic prefall/fall/land/recover sequence. The real Windows feel and timing remain unverified.                                                                             |
| Fall                                | partially implemented      | Pure fall-motion tests prove acceleration and floor clamping, and the overlay applies the resulting bounds. Runtime animation/coordinate proof is still open.                                                                                    |
| Landing                             | partially implemented      | Landing and recovery states now follow a detected work-area-floor collision. This has automated logic coverage but no manual desktop proof.                                                                                                      |
| Screen boundaries                   | partially implemented      | Electron clamps open, drag, walk, zoom, and release bounds to the nearest display work area; tests include a negative-coordinate monitor. Mixed-DPI hardware remains unverified.                                                                 |
| Bring Buddy Back                    | implemented but unverified | Tray/menu controls exist. Needs fresh Windows verification that it recovers an offscreen buddy.                                                                                                                                                  |
| Attached bubble                     | partially implemented      | The bubble is rendered inside the overlay shell, visually attached to the pet. It is not yet a full streamed companion conversation surface.                                                                                                     |
| Bubble following                    | partially implemented      | Because the bubble lives in the same overlay window, it moves with the pet during overlay moves. This is not a complete edge-aware attached-bubble system.                                                                                       |
| Streamed responses                  | not implemented            | The detached overlay bubble does not show live streamed assistant responses. Main app streaming is separate.                                                                                                                                     |
| Shared sessions                     | partially implemented      | Overlay submit forwards to the main desktop session handler, but shared session state and duplicate prevention have not been proved.                                                                                                             |
| Stop/retry                          | not implemented            | No detached bubble stop/retry controls or transcript-level recovery were found.                                                                                                                                                                  |
| Support modes                       | not implemented            | Quick action labels exist, but there is no proven mode-aware runtime behavior for hangout, trading facts, or sit-with-me support.                                                                                                                |
| Companion-state animation           | partially implemented      | The canonical physical and conversation taxonomy is deterministically derived and tested, with lifecycle wiring for listening/thinking/talking/calm/offline. Current Petdex packs may use alias rows, and runtime transitions remain unverified. |
| Provider outage                     | partially implemented      | Provider connection errors are now classified into an honest persistent offline pet/bubble status with focused tests; recovery clears on the next stream start. Stopping/restarting real Ollama is not yet verified.                             |
| Backend reconnect                   | not implemented            | No proven companion reconnect flow for a restarted or dropped backend was found.                                                                                                                                                                 |
| Vibrant UI                          | partially implemented      | The previous Petdex and warm overlay styling improved the visual direction, but the complete companion UI layer is not finished.                                                                                                                 |
| Shutdown leaves no orphan processes | implemented but unverified | Quit paths exist, but no current Windows process audit has been run for orphan Hermes/desktop processes.                                                                                                                                         |

## Companion state taxonomy audit

| Required state | Status                     | Notes                                                                                                                      |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `idle`         | implemented but unverified | Existing state exists and maps to the idle sprite row.                                                                     |
| `walk_left`    | partially implemented      | Canonical state, tested derivation, scheduler, and row fallback exist; desktop observation is pending.                     |
| `walk_right`   | partially implemented      | Canonical state, tested derivation, scheduler, and row fallback exist; desktop observation is pending.                     |
| `sit`          | partially implemented      | Canonical state and row fallback exist; quiet mode currently selects it only in the overlay.                               |
| `sleep`        | partially implemented      | Canonical state and row fallback exist; sleep is currently overlay-local.                                                  |
| `dragged`      | partially implemented      | Pointer-down drives the canonical state with tested priority over conversation state; runtime observation is pending.      |
| `prefall`      | partially implemented      | Release drives the canonical prefall state before physical fall motion; runtime observation is pending.                    |
| `fall_left`    | partially implemented      | Tested state selection and deterministic release physics exist; a dedicated production sprite row may still fall back.     |
| `fall_right`   | partially implemented      | Tested state selection and deterministic release physics exist; a dedicated production sprite row may still fall back.     |
| `land`         | partially implemented      | Floor collision drives the canonical state; runtime observation is pending.                                                |
| `recover`      | partially implemented      | Landing settles through the canonical recovery state; runtime observation is pending.                                      |
| `listening`    | partially implemented      | Typing, submit acceptance, and blocked input drive listening; end-to-end bubble observation is pending.                    |
| `thinking`     | partially implemented      | Model preparation, reasoning, and tools drive thinking; end-to-end observation is pending.                                 |
| `talking`      | partially implemented      | Assistant deltas drive talking in the mirrored overlay state, but the bubble does not yet render streamed transcript text. |
| `writing`      | partially implemented      | Canonical deterministic state and row fallback exist, but journal/memory sync is not yet wired.                            |
| `concerned`    | partially implemented      | Temporary turn errors use a bounded concerned beat; real provider failure QA is pending.                                   |
| `offline`      | partially implemented      | Tested provider-error classification drives a persistent offline state; real Ollama/backend recovery QA is pending.        |

## Windows walkthrough audit

No fresh 25-step Windows walkthrough has been completed after the correction prompt. The expected
current outcome is:

| Walkthrough area                  | Status                | Expected result if run now                                                                                             |
| --------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Launch canonical app              | unverified            | Likely launches, but process uniqueness needs proof.                                                                   |
| Main app hidden and buddy visible | unverified            | Likely works in companion mode, but must be observed.                                                                  |
| Drag buddy                        | partially implemented | Likely moves the overlay; drag animation/state is incomplete.                                                          |
| Release/fall/landing              | unverified            | Deterministic motion and state sequencing are implemented, but have not been observed in the real desktop build.       |
| Screen-boundary recovery          | partially implemented | Native bounds clamping and Bring Buddy Back have automated coverage; mixed-DPI/multi-monitor observation remains open. |
| Open compact attached bubble      | partially implemented | Opens a local overlay bubble/composer, not a full companion transcript.                                                |
| Bubble follows pet                | partially implemented | Follows as part of the same overlay window, not as robust edge-aware behavior.                                         |
| Submit prompt and stream response | not implemented       | Main session may respond, but overlay streaming is not implemented.                                                    |
| Shared main-app session           | partially implemented | Needs proof that the same session is used and no duplicate backend is created.                                         |
| Stop/retry response               | not implemented       | Expected to fail in the detached bubble.                                                                               |
| Support modes                     | not implemented       | Expected to fail as real modes.                                                                                        |
| Provider outage/offline UI        | partially implemented | Offline classification and visible status exist; real stop/restart QA remains open.                                    |
| Backend reconnect                 | not implemented       | Expected to fail.                                                                                                      |
| Quit and process cleanup          | unverified            | Needs process audit.                                                                                                   |

## Recommended correction sequence

1. Bridge the real shared-session transcript and streamed responses into a distinct attached bubble.
2. Add stop/retry/copy/history controls and support-mode request context.
3. Add bounded Hermes-backend reconnect state and duplicate-resistant session restoration.
4. Run physical movement, Ollama outage/recovery, mixed-DPI, and process-cleanup QA on Windows.
5. Run the full Windows 25-step walkthrough and record the results before claiming completion.

## Automated evidence added during correction

- Strict Hermes Desktop TypeScript passes.
- Full Hermes Desktop ESLint passes.
- Focused pet state, motion, overlay routing, and provider-offline tests pass: 24 tests.
- Focused Electron companion startup, close, Bring Buddy Back, and display-clamping tests pass:
  5 tests.
- Hermes Desktop production renderer build passes.

These checks prove deterministic logic and build integrity. They do not replace the required
25-step Windows product walkthrough.
