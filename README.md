# twitch-graderia

An OBS browser overlay that turns Twitch chat into a football stadium crowd. Viewers choose a side, chant, and react; the streamer triggers goals, and an AI generates a crowd report.

## Structure and stack

- `overlay/` — Vite, TypeScript, PixiJS, and Socket.IO client for the transparent OBS overlay
- `server/` — Node.js 20, Fastify, Socket.IO, and Twurple EventSub
- `shared/` — TypeScript types shared by the overlay and server

## Install

```sh
npm install
```

## Server environment

Copy `.env.example` to `.env`. The server reads these values:

| Variable | Value |
| --- | --- |
| `TWITCH_CLIENT_ID` | Twitch app client ID; leave empty for mock mode |
| `TWITCH_CLIENT_SECRET` | Twitch app secret; leave empty for mock mode |
| `TWITCH_REDIRECT_URI` | OAuth callback URL; defaults to `http://localhost:3000/auth/twitch/callback` |
| `OPENAI_API_KEY` | Optional; without it the crowd report uses a local template |
| `OPENAI_MODEL` | Optional; defaults to `gpt-4.1-mini` |
| `REPORT_LANGUAGE` | Optional; report language code, defaults to `es` |
| `REPORT_TIMEOUT_MS` | Optional; OpenAI request limit, defaults to `15000` |
| `PORT` | Server port; defaults to `3000` |
| `MOCK_CHAT` | Set to `1` for mock chat, `0` for Twitch mode; mock match auto-ends after its configured duration |
| `MOCK_MATCH_DURATION_MINUTES` | Optional; mock match duration, defaults to `3` |
| `CONTROL_TOKEN` | Optional bearer token for `/control` actions; without it, control actions are localhost-only |

## Connect Twitch

1. Register an application at the [Twitch Developer Console](https://dev.twitch.tv/console/apps). Set the OAuth redirect URL to `http://localhost:3000/auth/twitch/callback` for local development and choose the **Confidential** client type.
2. Copy `.env.example` to `.env` and set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Set `TWITCH_REDIRECT_URI` to the exact redirect URL registered in the console.
3. Start the server with `npm run dev:server`.
4. Open [http://localhost:3000/auth/twitch](http://localhost:3000/auth/twitch) and authorize the app. The server then listens to the authenticated channel's chat. Check `http://localhost:3000/auth/status` for connection status.

Twitch accepts HTTP redirect URLs only for `localhost`; any other host requires HTTPS, for example through Cloudflare Tunnel or ngrok. Register that HTTPS callback URL in the Twitch Developer Console and set the same URL in `TWITCH_REDIRECT_URI`.

OAuth tokens are stored locally under `data/` and refreshed automatically. Keep `.env` and the token file private. `OPENAI_API_KEY` remains optional. With a key, the report uses OpenAI structured output; without one or when the request fails, the server creates a template report. The API receives bounded match aggregates, top chant text, and the MVP display name only; it never receives chat history or user IDs. Report text passes through the text filter before it is saved or displayed.

## Mock mode

Set `MOCK_CHAT=1` in `.env` and run `npm run dev:server`. The mock generates 500 initial joiners, ongoing arrivals, departures, side switches, isolated messages, coordinated chants, and a blocked example without Twitch. Set `MOCK_CHAT=0` to use Twitch.

## Run the overlay

Run `npm run dev:overlay` in a separate terminal and open the Vite URL shown. In the connected overlay, type `!join argentina` or `!join mexico` in chat. The command accepts either side ID or display name, regardless of capitalization; joining the other side switches that user over. Type `!leave` to leave the stand.

Fans leave after 120 seconds without a chat message (30 seconds in server mock mode). Empty seats are reused without moving other fans. Server mock snapshots include stable seats and animate arrivals and departures.

## Chants

Five distinct joined viewers from the same side must send the same chant within 8 seconds in live mode. Chants are normalized before comparison, so `VAMOOOS!!` and `vamos` match. A side/text pair has a 10-second cooldown and singing lasts 6 seconds; ongoing messages can extend it. Mock mode uses 3 users, a 4-second window and cooldown, and a 5-second duration. Thresholds are in [server/src/config/chants.ts](./server/src/config/chants.ts).

Chant text is filtered before delivery: URLs are stripped, text over 60 characters and repeated symbol spam are rejected, and phrases in [server/src/chat/blocklist.json](./server/src/chat/blocklist.json) are blocked. Add normalized phrases to that JSON file to extend the blocklist. AI moderation is a future hook and is not active yet.

The overlay uses procedural crowd noise. Add `?mute=1` to disable it. In OBS, you can also control the browser source audio in the source's audio settings.

## Test chants and stand life

- **Server mock:** set `MOCK_CHAT=1`, run `npm run dev:server`, then `npm run dev:overlay` in another terminal. Open the Vite URL without `?mock=1`. Watch for coordinated chants, filtered text, user churn, reused seats, and changing counters.
- **Overlay-only mock:** open the Vite URL with `?mock=1` to simulate joins, leaves, switches, chants, and banners locally. Add `&mute=1` to silence procedural audio.
- **Twitch:** connect the streamer, type `!join argentina` or `!join mexico`, coordinate the same chant across at least five distinct joined viewers, then use `!leave` or wait 120 seconds without chat activity.

## Goals and control page

The broadcaster or a moderator can type `!goal argentina` or `!goal mexico` to trigger a celebration; side names are case-insensitive and each side has a three-second cooldown. `!start` resets the score and match statistics. `!end` ends the match and creates the crowd report. Visit [http://localhost:3000/control](http://localhost:3000/control) for GOAL buttons, the current score, Reset score / start match, and END MATCH. Set `CONTROL_TOKEN` in `.env` to require a token for control actions; the page prompts once and keeps it in memory. With no token configured, only localhost requests can control the match.

When `MOCK_CHAT=1`, the server periodically triggers a goal. The overlay-only `?mock=1` mode also simulates goals locally. To test a goal immediately, use the `/control` page or send `!goal argentina` as a moderator in Twitch chat; use `!start` or the reset button to clear the score.

## AI crowd report

Start a match with `!start` as the broadcaster/moderator, or use **Reset score / start match** in `/control`. End it with `!end` or **END MATCH**. The overlay shows FULL TIME while the report is generated, then links to `/report`. The shareable report card is available at [http://localhost:3000/report](http://localhost:3000/report), and its JSON is at `/api/report`. It includes the final score, peak crowd per side, average pressure and loudest side, busiest minute, repeated chants, MVP fan, and join/leave/switch totals. Download a PNG or copy the report link from the card.

Set `OPENAI_API_KEY` to enable AI-written text. `OPENAI_MODEL`, `REPORT_LANGUAGE`, and `REPORT_TIMEOUT_MS` tune the model, language, and request timeout; they have safe defaults. If the key is blank or the API is unavailable, a local template report is still saved. In server mock mode, a match starts automatically and ends after `MOCK_MATCH_DURATION_MINUTES` (default 3), so the complete report flow can be demoed without Twitch. Overlay-only `?mock=1` shows a local FULL TIME and report-ready simulation after three minutes.

To test quickly, run with `MOCK_CHAT=1` and `MOCK_MATCH_DURATION_MINUTES=1`, start the overlay without `?mock=1`, then wait for auto-end or click END MATCH in `/control`. Open `/report` after the overlay announces it is ready. Alternatively use `?mock=1` for the overlay-only local simulation.

## Pressure and mood

The server counts non-command messages from joined viewers over a rolling window, normalizes activity by the side's fan count with a floor for small stands, then smooths it into a 0–1 pressure score. Mood uses hysteresis: cold below about 0.2, hot above about 0.72, and calm between them. Chants and goals provide short pressure boosts. Shared tuning values live in [shared/src/pressureConfig.ts](./shared/src/pressureConfig.ts) and are applied by [server/src/chat/pressure.ts](./server/src/chat/pressure.ts): live mode uses a 10-second window and 0.2 smoothing; mock mode reacts faster with a 2.5-second window and 0.55 smoothing. Both sides cycle through about 20 seconds of activity and 15 seconds of quiet with an offset between them.

The pressure bar fills smoothly and changes color with mood. Cold stands slump and show empty seats more clearly; hot stands bob more energetically. Add `?debug=1` to the overlay URL to show each side's current pressure and mood as text.

To test locally, run the server with `MOCK_CHAT=1` and the overlay without `?mock=1`, or open the overlay-only mock with `?mock=1&debug=1`. Watch one side enter its quiet phase while the offset side stays active, then recover on the next activity phase. Mock goals continue alternating between Argentina and Mexico.

## Features and milestones

See [FEATURES.md](./FEATURES.md) for the feature list and milestone plan.

Codex Session ID: **PENDING**

Demo: **PENDING**
