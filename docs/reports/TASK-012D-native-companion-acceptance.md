# Task 12D — Native companion acceptance and latency hardening

**Date:** July 2, 2026

**Status:** In progress

## Mission

Prove the project-owned buddy, attached Bubble, Companion Home, shared session, provider recovery,
privacy behavior, latency, and shutdown as one real Windows companion experience. Task 13 and broad
frontend redesign remain out of scope.

## Baseline

Current `main` already contains Task 12C and the secure NVIDIA DeepSeek V4 Pro provider route. The
Hermes fork remains pinned at `28f06366f`. The complete pre-edit automated baseline passed:

- 183 frontend tests;
- 99 non-network Rust tests;
- 315 focused Hermes tests;
- real V4 Pro application-path streaming;
- formatting, lint, strict TypeScript, Clippy;
- frontend, Petdex, Tauri debug installer, and Tauri release builds.

The observed real-provider run reached first visible content in 12.7 seconds and completed in 13.0
seconds. Prompt acceptance was under 1 ms, so immediate lifecycle feedback can be honest while
provider work continues.

## Current completion boundary

Task 12D is not complete. No human-observed 25-step result is recorded yet. Monitor/DPI, pointer,
focus, tray, and shutdown claims remain unverified until the development-only guided runner records
them explicitly.

The first native run found a real drag failure: Tauri rejected native window dragging because the
capability was absent. A Buddy-only capability and regression test now cover the root cause; direct
drag/drop/fall/land/recover retest is still required.

## Completed checkpoint

- Development-only guided native acceptance runner.
- Explicit Pass, Fail, Blocked, and hardware-unavailable results.
- Separate human, automatic, fixture, and untested evidence classifications.
- Safe allowlisted native diagnostics, bounded sanitized notes, unfinished-run resume, reset, and
  Markdown/JSON export.
- Domain, component, boundary, and native redaction regression coverage.
- Content-free timing spans across application preparation, gateway/session, exact provider
  request start, first visible content, persistence, cross-window emission, and frontend paint.
- Four real current-provider samples with a 6.67-second median first-visible time and sub-420-ms
  gateway readiness.
- Safe development gateway-crash control that exercises the real bounded recovery path.
- Aggregate transcript/mapping diagnostics and explicit no-tools/RPC privacy regression coverage.

## Remaining deliverables

- Recorded native acceptance with failures, fixes, and retests.
- Updated Task 12B/12C reports, architecture, decisions, tasks, and progress.

## Recommended next checkpoint

Add privacy-safe latency spans, then begin direct A2 native body and Bubble observation without
substituting fixture evidence for human evidence.
