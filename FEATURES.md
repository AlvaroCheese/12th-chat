# Features and Work Plan

Reference document for building **twitch-graderia** in order. Each milestone = one prompt to Codex, in the same thread, with its own commit.

## Vision

A browser overlay for OBS where **Twitch chat becomes the crowd of a football stadium** during a watch-along stream. Everything is driven by what chat already does (typing, chanting, spamming emotes). Zero setup for viewers.

## Decisions made

| Topic | Decision |
|---|---|
| Where it lives | Web overlay loaded as an OBS Browser Source (shows on mobile, TV and in clips) |
| Data input | Twitch chat via EventSub (Twurple) |
| Output | Socket.IO to the overlay |
| Rendering | PixiJS, 2D with pseudo-depth |
| AI | OpenAI API: crowd report and chant filter |
| Twitch Extension | Out of the MVP, kept on the roadmap |

## Chat commands

| Command | Who | What it does |
|---|---|---|
| `!join <side>` | Viewer | Picks a side (country or club) and appears in the stand |
| `!goal <side>` | Mod / streamer | Triggers that side's celebration |
| `!start` | Mod / streamer | Starts the match (resets counters) |
| `!end` | Mod / streamer | Ends the match and generates the AI report |

Mod permissions are read from the badges included in the chat event. Command names are a proposal and can be changed before implementation.

---

## MVP (required for the demo)

### F1. Twitch connection
- The streamer authorizes the app (OAuth) and the server subscribes to their channel's chat messages.
- **Done when:** a message typed in the real chat appears in the server console.
- A **mock mode** must exist to simulate chat so development works without Twitch.

### F2. Stand with sides
- Each viewer who uses `!join` appears as a fan in the stand of their side.
- The stand is visually split in two halves with different colors.
- At most ~300 individual fans are drawn; the rest is shown as an aggregated crowd with a counter.
- **Done when:** 500 simulated users fill the stand at 60 fps.

### F3. Chants
- If N distinct users from one side type the same chant within a time window, that side "sings": the stand bounces, the text appears as a banner and crowd noise rises.
- **Done when:** with simulated chat, a coordinated chant triggers the animation and an isolated message does not.
- Every chant passes through a filter (blocklist and, if time allows, AI moderation) before being displayed.

### F4. GOAL button
- `!goal <side>` launches confetti in that side's colors and a celebration animation.
- A `/control` page with buttons also exists for the streamer.
- **Done when:** a mod types the command and the overlay reacts in under 1 second.

### F5. Pressure meter
- Measures messages per second for each side. If chat cools down, the stand looks sad and empties; if it heats up, the stand comes alive.
- **Done when:** the difference between an active chat and a silent one is clearly visible.

### F6. AI crowd report
- With `!end`, the server summarizes match stats (most repeated chant, peak activity minute, loudest side, MVP fan) and sends them to the OpenAI API to write the text.
- It is shown as a shareable card (`/report` page).
- **Done when:** at the end of a test match the card appears with real data from the session.
- Privacy: send only aggregated data or minimal fragments to the API, never the full chat history.

---

## If time allows

| ID | Feature | Note |
|---|---|---|
| F7 | VAR vote (goal or no goal) | The stand splits by opinion |
| F8 | Away fans on raid | Chat arriving via raid enters as visiting fans |
| F9 | SQLite persistence | Match history, batched writes |

## Roadmap only (for the pitch)

Collaborative tifo, penalty shootout mode, capos (top supporters in the front row), predictions, derbies between channels, Extension with Bits, support for other sports.

---

## Work milestones (one prompt per milestone)

| Milestone | Content | Verifiable result |
|---|---|---|
| **M0** | Repo structure and AGENTS.md | `npm run build` passes and `/health` responds |
| **M1** | F1 with mock mode | Real and fake messages reach the server |
| **M2** | F2 | Stand with sides and aggregated crowd |
| **M3** | F3 | Animated and filtered chants |
| **M4** | F4 | Confetti by command and `/control` panel |
| **M5** | F5 | Visible pressure meter |
| **M6** | F6 | AI report card |
| **M7** | Polish | README, demo script, deployment and video |

Work order: M0 → M1 → M2 are the base; from M3 on, each milestone adds a visible feature and a fragment of the demo can be recorded.

## Prompt template for each milestone

```
Read AGENTS.md and FEATURES.md. Implement milestone [Mx] ([name]).
Scope: only what is described in [Fx]. Do not touch other features.
Acceptance criterion: [copy the "Done when" line].
When finished: typecheck, lint and build; update the README if commands change;
reply with a summary of modified files and how to test it.
```

## Demo script (3 minutes)

1. **0:00** The problem: Twitch lost the World Cup to other platforms, and streamers cannot show the match itself.
2. **0:20** Simulated Argentina vs Mexico chat: viewers pick sides and fill the stand.
3. **0:50** The two sides face off with chants.
4. **1:20** Chat goes quiet: the stand empties. It starts chanting again and recovers.
5. **1:45** Goal: confetti and celebration.
6. **2:05** `!end`: the AI crowd report appears.
7. **2:30** How it was built with Codex, and the roadmap.

## Definition of done (for submission)

- [ ] Repo with all source code and instructions to run it
- [ ] Demo of max 3 min on YouTube, public, showing the project on Twitch and the use of Codex
- [ ] Project description
- [ ] Session ID of the main Codex thread
- [ ] If the repo is private, shared with `testing@devpost.com`
