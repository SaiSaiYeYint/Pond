# Vision

Grimm is the strange friend living under the pond, not a productivity bot or generic assistant. The long-term goal is to build a relationship-first pond app where conversation comes first, proof and logging emerge naturally, the pond feels alive, and Grimm slowly becomes a memorable character the player returns to over months or years.

# Current Architecture

- 3-layer UI: `pondLayer` is the fixed animated pond background, `pageLayer` holds app pages such as Done List, and `chatLayer` owns Grimm chat, the orb, composer, minimized/maximized states, and keyboard mode.
- GrimmService: the single backend AI entry point. The UI never calls Gemini directly. Gemini receives `grimm/constitution.md` as system instruction before every request.
- MemoryService: wraps local player memory and memory updates. Storage remains local for now.
- ImprovementService: silently captures owner improvement ideas during normal conversation, groups them, reviews them in Work Time, and supports approval/rejection.
- Builder Protocol: approved ideas can become provider-agnostic markdown work orders in `builder/work_orders/`. Any AI builder can continue from these files.

# Current Status

Complete:

- Core pond prototype with fish, feeding, Done List, week tracker, coins, trophies, and Grimm chat layer.
- 3-layer UI architecture and keyboard mode guardrails.
- Gemini backend through GrimmService.
- Constitution-driven Grimm identity.
- Local MemoryService.
- Local ImprovementService.
- Work Time entry through `simon says work time`.
- YES/NO approval flow for improvement ideas.
- Work Order folder, template, README, and provider-agnostic work order generation on approved ideas.

In progress:

- Work Time is becoming Grimm's project workshop.
- Improvement review and Work Order management are still early.
- Grimm's relationship-first behavior depends on the constitution and prompt files, but needs more testing.

Blocked:

- Persistent cloud database is not implemented.
- Production memory and improvement storage on Vercel is temporary until a real database is added.
- Full deployed testing depends on Vercel environment variables being set correctly.

# Stable Systems

Do not refactor these unless necessary:

- 3-layer UI separation: `pondLayer`, `pageLayer`, `chatLayer`.
- Keyboard mode and VisualViewport handling.
- Grimm orb + composer as one chat dock.
- Pond feeding rule: only in Pond view while chat is minimized.
- GrimmService as the only AI entry point.
- Constitution as Grimm's identity source.
- Builder Work Order protocol.

# Current Priority

Stabilize Work Time so Grimm can review improvements and unfinished Work Orders clearly without generating or executing code automatically.

# Next Planned Features

1. Make Work Time review unfinished Work Orders in a useful one-at-a-time flow.
2. Improve relationship-first Gemini behavior through prompt tuning and testing.
3. Add persistent storage for memory, improvements, and Work Orders.
4. Improve Done List detection so logging feels natural inside conversation.
5. Continue pond visual polish and fish behavior improvements.

# Technical Debt

- `app.js` still contains legacy local Grimm logic and older admin/task helpers that should be cleaned carefully later.
- Some local fallback replies still sound too productivity-focused compared with the new Constitution.
- Vercel serverless storage uses temporary filesystem behavior and should be replaced with a database.
- Work Order creation currently uses deterministic service logic, not a full editable workshop review.
- Need better duplicate detection for similar but not identical improvement ideas.
- Need a production-safe way to inspect saved improvements and work orders.

# AI Builder Rules

Every builder must:

- Read `builder/PROJECT_STATE.md` first.
- Read `BUILD.md`.
- Read Grimm Constitution at `grimm/constitution.md`.
- Read unfinished Work Orders in `builder/work_orders/`.
- Continue existing architecture.
- Avoid unnecessary refactoring.
- Update `builder/PROJECT_STATE.md` after completing meaningful work.

# Last Updated

Version: 0.1.0-workshop-foundation

Date: 2026-07-04

Summary of latest changes: Added Builder Protocol, Work Order template, Work Time improvement review, approval/rejection flow, and provider-agnostic Work Order generation.

