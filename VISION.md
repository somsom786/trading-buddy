# Trading Buddy Vision

> A small desktop creature that is easy to live with, emotionally steady, and genuinely useful
> before, during, and after a trading day.

![Trading Buddy character concept board](public/design/buddy-concept-beta-v0.1.png)

## The experience we are building

Trading Buddy is not an agent dashboard wearing a pet costume. The creature is the product:

1. Buddy sleeps on the taskbar or rests at a quiet screen edge.
2. A hover wakes it; a click opens a compact bubble attached to its body.
3. The user talks naturally and chooses the kind of support they want: listen, reflect, plan, hang
   out, or simply be present.
4. Buddy visibly listens, thinks, and streams a concise reply beside itself.
5. The same conversation is available later in Companion Home, alongside user-controlled journal,
   memory, and review tools.

The default interaction should feel lighter than opening a full chat application. Companion Home is
for inspection and deliberate work; the detached creature is for everyday presence.

## Visual direction

| Calm presence                                              | Thinking                                               | Journaling                                           | Sleeping                                               |
| ---------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------ |
| ![Neutral Buddy](src/assets/buddy/poses/neutral-front.png) | ![Thinking Buddy](src/assets/buddy/poses/thinking.png) | ![Writing Buddy](src/assets/buddy/poses/writing.png) | ![Sleeping Buddy](src/assets/buddy/poses/sleeping.png) |

The original dark rounded body, expressive face, floating antennae, and warm chest core define the
project-owned character direction. Petdex-compatible skins can offer user choice, but the canonical
Trading Buddy skin must always work offline.

DyberPet is a reference for the physical desktop-pet experience: perching, edge-aware movement,
sleeping, dragging, and unobtrusive presence. Trading Buddy owns its frontend, visual language, and
interaction design.

## Product boundaries

- Local-first storage: transcripts, journal entries, preferences, memories, and trading snapshots
  stay in Rust-owned SQLite on the device.
- Cloud inference is explicit: messages and selected bounded context are sent to NVIDIA's hosted
  API for DeepSeek V4 Pro. The credential is supplied locally and never committed.
- No private keys, seed phrases, wallet signing, trade execution, or autonomous trading.
- Read-only crypto integrations come first.
- Model output is untrusted. Deterministic validation and native boundaries remain authoritative.
- The Hermes-derived fork contributes backend/session logic only. Its desktop frontend, product
  branding, and navigation are not part of Trading Buddy.

## Concrete north-star example

```text
Buddy is asleep above the taskbar.
→ The trader hovers; Buddy wakes.
→ Click: a small attached bubble appears.
→ “I broke my plan and chased twice today.”
→ Choose Reflect.
→ Buddy listens, thinks, and streams a calm response.
→ “Journal this” opens a short review using the same context.
→ Close the bubble.
→ Tomorrow, the transcript and user-approved journal remain available locally.
```

## Current BETA v0.3 reality

The Tauri companion, project-owned bubble, shared transcript, support modes, streaming controls,
local persistence, deterministic pet movement, taskbar/edge placement, five-second development
sleep, and Petdex skin picker exist. DeepSeek V4 Pro is wired through NVIDIA's hosted
OpenAI-compatible endpoint.

This is still a development build. Original production animation, polished onboarding, secure
operating-system credential storage, endpoint reliability evidence, and the complete physical
Windows QA walkthrough remain open.
