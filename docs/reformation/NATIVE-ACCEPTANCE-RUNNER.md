# Native acceptance runner

Task 12D adds a guided acceptance recorder to development builds of Trading Buddy. It is a QA aid,
not a replacement for direct observation and not a production analytics feature.

## Opening the runner

1. Start the native app with `corepack pnpm desktop:dev`.
2. Open Companion Home from the tray or Buddy.
3. Expand **Task 12D - Guided Native Acceptance (development only)** in the development lab.

The runner presents the required 25 steps in order. An unfinished run is saved locally and resumes
after the development app reloads.

## Recording evidence

Each step must receive one status:

- Passed
- Failed
- Blocked
- Not available on this hardware

Each result also identifies its evidence:

- Human-observed
- Automatically measured
- Fixture-only

Automatic diagnostics supplement human observation; they do not turn a visual or pointer claim
into human-observed evidence. Use the note field for a short, non-sensitive observation. Never
paste conversation content, credentials, tokens, unrelated process information, or private window
titles.

## Safe diagnostics

The development-only Tauri command returns an allowlisted snapshot:

- Trading Buddy process count and owned gateway state;
- Buddy, Bubble, and Companion Home visibility, focus, and bounds;
- monitor/work-area geometry and scale;
- redacted shared-session/request/turn identifiers and stream counters;
- provider status and pinned model identifier.

It does not return prompts, responses, API keys, token values, clipboard data, screen contents,
unrelated process details, or unrelated window titles. Session identifiers are reduced to a
six-character suffix. The command rejects production builds.

An orphan-process result cannot be measured from inside the process after Quit. Record that check
from a separate terminal after using the tray Quit command.

## Export and reset

Use **Export Markdown** or **Export JSON** to save the run. Both formats preserve the evidence
classification and safe diagnostics. Notes are bounded and common credential formats are redacted
before persistence or export.

Use **Reset walkthrough** only when intentionally starting a fresh run. The browser storage record
is local to the development webview.

## Evidence limitations

Automated tests establish deterministic behavior and boundary validation. They cannot prove visual
attachment, pointer feel, keyboard focus, taskbar placement, hardware-specific DPI behavior, or
clean shutdown after the application has exited. Those claims remain not tested until a person
records them or not available until the hardware limitation is recorded.
