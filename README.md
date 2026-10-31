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
| `OPENAI_API_KEY` | Optional; not used by F2 |
| `PORT` | Server port; defaults to `3000` |
| `MOCK_CHAT` | Set to `1` for mock chat, `0` for Twitch mode |

## Connect Twitch

1. Register an application at the [Twitch Developer Console](https://dev.twitch.tv/console/apps). Set the OAuth redirect URL to `http://localhost:3000/auth/twitch/callback` for local development and choose the **Confidential** client type.
2. Copy `.env.example` to `.env` and set `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Set `TWITCH_REDIRECT_URI` to the exact redirect URL registered in the console.
3. Start the server with `npm run dev:server`.
4. Open [http://localhost:3000/auth/twitch](http://localhost:3000/auth/twitch) and authorize the app. The server then listens to the authenticated channel's chat. Check `http://localhost:3000/auth/status` for connection status.

Twitch accepts HTTP redirect URLs only for `localhost`; any other host requires HTTPS, for example through Cloudflare Tunnel or ngrok. Register that HTTPS callback URL in the Twitch Developer Console and set the same URL in `TWITCH_REDIRECT_URI`.

OAuth tokens are stored locally under `data/` and refreshed automatically. Keep `.env` and the token file private. `OPENAI_API_KEY` remains optional.

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

## Features and milestones

See [FEATURES.md](./FEATURES.md) for the feature list and milestone plan.

Codex Session ID: **PENDING**

Demo: **PENDING**
