# twitch-graderia

## Make the crowd the show

Twitch lost the World Cup co-watching wave, and streamers cannot show the match itself. twitch-graderia turns that limitation into the spectacle: viewers pick a side, chant and react, while a transparent OBS overlay turns chat into a football stadium. The streamer triggers goals, and the final whistle produces a crowd report.

## Features

- Live Twitch chat through OAuth and EventSub, plus credential-free mock chat.
- Argentina and Mexico stands with up to 300 individual fans, crowd overflow, chants, goals and a live pressure meter.
- A shareable post-match report at /report, generated from match statistics with OpenAI or a local template.
- A deterministic 2.5-minute demo script and an optional simulated crowd alongside real Twitch chat.

## Architecture

    Twitch EventSub ─┐
                     ├─> Fastify + Socket.IO ──> Shared types ──> PixiJS OBS overlay
    Demo / mock ─────┘          │
                                ├─ in-memory stand and match statistics
                                └─ OpenAI (aggregates only) ──> /report card

## Stack

- npm workspaces and TypeScript: overlay, server, shared
- Overlay: Vite, PixiJS, Socket.IO client; plain TypeScript
- Server: Node.js 20, Fastify, Socket.IO, Twurple EventSub, OpenAI SDK
- Tests: Vitest

## Quick start for judges

1. Install Node.js 20 and clone this repository.
2. Install dependencies:

       npm install

3. Copy .env.example to .env and set MOCK_CHAT=1. No Twitch or OpenAI credentials are needed for the demo.
4. In terminal one, run:

       npm run dev:server

5. In terminal two, run npm run dev:overlay, then open the Vite URL printed in that terminal. The server fills the stand with simulated chat and ends the mock match after three minutes.

To run the overlay-only mock instead, open the Vite URL with ?mock=1. To run the scripted story, open http://localhost:3000/control and choose **Run demo script**; it fills the stand, stages chants and a quiet phase, scores once for each side, then generates a report.

## Chat commands

| Command | Who can use it | Result |
| --- | --- | --- |
| !join argentina / !join mexico | Anyone | Join or switch sides |
| !leave | Anyone | Leave the stand |
| !goal <side> | Broadcaster or moderator | Trigger a goal |
| !start | Broadcaster or moderator | Start a new match and reset its score |
| !end | Broadcaster or moderator | Freeze the stand and generate the report |

## Control page

Open http://localhost:3000/control for goal buttons, score, **Restart match / mock crowd**, **END MATCH**, and **Run demo script**. Set CONTROL_TOKEN to protect control actions. In development, control requests without a token are accepted from localhost; production requires the token.

## Connect Twitch

Create a **Confidential** app in the [Twitch Developer Console](https://dev.twitch.tv/console/apps), register the callback URL, set TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, and TWITCH_REDIRECT_URI, then restart the server and open /auth/twitch. Twitch accepts HTTP redirect URLs only for localhost; other hosts require HTTPS, such as a Cloudflare Tunnel or ngrok URL registered in the console.

For a real Twitch demo with a fuller stand, set DEMO_CROWD=1 and leave MOCK_CHAT=0. The server runs the simulated crowd, chants and churn alongside the restored Twitch EventSub connection. Real Twitch commands operate on the same stand. Simulated events carry an explicit mock source and demo-sim- IDs; their display names are excluded from the report MVP field.

## OBS Browser Source

Add a **Browser Source** and set its URL to the overlay URL, for example http://localhost:5173/ during development. Set width to **1920** and height to **1080**. The overlay canvas and page background are transparent. Add ?mute=1 to silence procedural sound; add ?debug=1 to show pressure and mood.

## Environment variables

Copy .env.example to .env. Empty credentials are safe for mock mode.

| Variable | Purpose |
| --- | --- |
| PORT | HTTP and Socket.IO port; default 3000 |
| NODE_ENV | Use production for the single-service deployment |
| TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET | Twitch confidential app credentials |
| TWITCH_REDIRECT_URI | OAuth callback; defaults to localhost |
| OPENAI_API_KEY | Optional; template reports work without it |
| OPENAI_MODEL | Optional report model; defaults to gpt-4.1-mini |
| REPORT_LANGUAGE | Optional report language; defaults to es |
| REPORT_TIMEOUT_MS | Optional API timeout; defaults to 15000 |
| CONTROL_TOKEN | Optional locally, required in production |
| MOCK_CHAT | 1 runs an offline server mock match; default 0 |
| DEMO_CROWD | 1 adds simulated viewers while Twitch is connected; default 0 |
| MOCK_MATCH_DURATION_MINUTES | Offline mock match length; default 3 |

## AI report privacy

The report API receives bounded match aggregates, repeated chant fragments, and at most one MVP display name. It does not receive user IDs or full chat history. Simulated display names are omitted from the MVP field. Generated report text is filtered before saving and display. OPENAI_API_KEY is optional; with no key, the server writes a local template report.

## Tests and checks

    npm test
    npm run typecheck
    npm run lint
    npm run build

## Deployment

Deploy the repository as one Node 20 service on Railway or Render. The Dockerfile builds the workspaces and serves the Vite overlay from Fastify when NODE_ENV=production. Configure CONTROL_TOKEN, PORT (provided by the host), and Twitch credentials in the host's secret-variable settings; do not bake secrets into the image. Register the deployment's HTTPS /auth/twitch/callback URL in the Twitch console and set the same value as TWITCH_REDIRECT_URI. Most hosts do not persist data/, so a redeploy can remove local OAuth tokens and reports; the streamer may need to reconnect at /auth/twitch.

## Roadmap

- Twitch Extension for individual viewer actions and Bits
- VAR vote
- Away fans on raids
- Collaborative tifo
- Penalty mode

## How Codex was used

Codex helped build the project milestone by milestone: repository skeleton, Twitch chat, stand and chants, goals, pressure, the AI crowd report, and demo/deployment readiness. Project instructions and feature boundaries are documented in [AGENTS.md](./AGENTS.md) and [FEATURES.md](./FEATURES.md).

## Project links

Codex Session ID: PENDING

Demo video: PENDING
