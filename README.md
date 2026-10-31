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

Set `MOCK_CHAT=1` in `.env` and run `npm run dev:server`. Fake messages from several users on two sides, repeated chants, and moderator badges appear in the server console without a Twitch connection. Set `MOCK_CHAT=0` to use Twitch.

## Run the overlay

Run `npm run dev:overlay` in a separate terminal and open the Vite URL shown. In the connected overlay, type `!join argentina` or `!join mexico` in chat. The command accepts either side ID or display name, regardless of capitalization; joining the other side switches that user over.

For a server-driven mock stand, set `MOCK_CHAT=1` and run `npm run dev:server`; 500 fake users join both sides automatically. For an overlay-only mock without the server, append `?mock=1` to the Vite URL.

## Features and milestones

See [FEATURES.md](./FEATURES.md) for the feature list and milestone plan.

Codex Session ID: **PENDING**

Demo: **PENDING**
