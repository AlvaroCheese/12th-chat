# twitch-graderia

An OBS browser overlay that turns Twitch chat into a football stadium crowd. Viewers choose a side, chant, and react; the streamer triggers goals, and an AI generates a crowd report.

## Structure and stack

- `overlay/` — Vite, TypeScript, PixiJS, and Socket.IO client for the transparent OBS overlay
- `server/` — Node.js 20, Fastify, Socket.IO, and Twurple packages
- `shared/` — TypeScript types shared by the overlay and server

## Install and run

```sh
npm install
npm run dev:server
npm run dev:overlay
```

Open the Vite URL shown in the terminal. Add `?mock=1` to enable local mock chat events.

## Environment

Copy `.env.example` to `.env`. The server uses `PORT` (defaults to `3000`). Twitch and OpenAI credentials are optional in the M0 skeleton: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, and `OPENAI_API_KEY`.

## Features and milestones

See [FEATURES.md](./FEATURES.md) for the feature list and milestone plan.

Codex Session ID: **PENDING**

Demo: **PENDING**
