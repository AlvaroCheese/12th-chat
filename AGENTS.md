# twitch-graderia

## Project summary

An OBS browser overlay that turns Twitch chat into a football stadium crowd. Viewers choose a side, chant, and react; streamers trigger goals; a match ends with an AI crowd report.

## Stack

- TypeScript across npm workspaces: `overlay`, `server`, and `shared`
- Overlay: Vite, PixiJS, Socket.IO client; plain TypeScript
- Server: Node.js 20, Fastify, Socket.IO, Twurple EventSub
- Shared: TypeScript types consumed by both applications

## Commands

- `npm install`
- `npm run dev:server`
- `npm run dev:overlay`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm start` (built production server)

## Folder map

- `overlay/` — OBS browser overlay and PixiJS renderer
- `server/` — HTTP/socket server and future service modules
- `shared/` — types shared by overlay and server
- `server/src/demo/` — deterministic demo script
- `server/src/config/demo.ts` — demo timeline tuning
- `FEATURES.md` — feature definitions and milestone plan

Features and milestones live in `FEATURES.md`. We work on **one milestone at a time**.

## Project rules

a. Aggregate chat events in time windows before sending them to the overlay; never emit one socket message per chat message.
b. Batch database writes; never one INSERT per event.
c. Keep PixiJS rendering separate from state and logic.
d. No secrets in the overlay or in git.
e. All chant text must pass a filter before being displayed.
f. The overlay must be usable with mock data when Twitch is not connected.
g. Keep hand-written overlay mock logic in a single TypeScript source file. TypeScript build output belongs in workspace output directories (for example `overlay/dist-types/` or `server/dist/`), never under `src/`; remove stale compiled `.js` twins beside `.ts` files because Vite may resolve them first.
h. Assign incoming fans to the least-occupied row, then the widest-spaced free seat with a deterministic user ID tie-break. Existing fans keep their seats; optional one-fan-per-second rebalancing is disabled.
