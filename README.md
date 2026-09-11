# NOVA APP TRANSPORT

Real-time European transport intelligence dashboard: multi-source live telemetry,
GTFS-RT protobuf ingestion (ÖBB, VOR, MÁV, BKK), regional station timetables,
passenger and freight wagon compositions, and live cross-border rail
infrastructure — rendered on a MapLibre GL map.

The app is a single Node process: an Express server (`server.ts`) that exposes the
`/api/*` data endpoints and, in production, serves the built React (Vite) frontend
from `dist/`.

## Run locally

**Prerequisites:** Node.js 22.x

```bash
npm install
npm run dev        # tsx server.ts + Vite dev middleware, http://localhost:3000
```

## Production build

```bash
npm run build      # vite build  +  esbuild bundle of the server -> dist/server.cjs
NODE_ENV=production npm start
```

`npm start` runs `node dist/server.cjs`. The server listens on `process.env.PORT`
(falling back to `3000`) and, when `NODE_ENV=production`, serves the static build
instead of starting the Vite dev server.

## Deploy on Railway

This repo includes `railway.json` (Nixpacks builder, `/api/health` health check,
restart-on-failure). Deploying:

1. Create a Railway project and point a service at this GitHub repo.
2. Set the service variable `NODE_ENV=production`.
3. Railway injects `PORT` automatically; the server binds to it.

Railway runs `npm run build` then the `npm run start` command from `railway.json`,
and every push to the connected branch triggers a new deploy.

## Environment variables

| Variable   | Required | Notes                                                        |
| ---------- | -------- | ------------------------------------------------------------ |
| `PORT`     | no       | Injected by Railway. Defaults to `3000` locally.             |
| `NODE_ENV` | prod     | Set to `production` on Railway so the built frontend is served. |

See `.env.example`. The app fetches from public open-data APIs and requires no
secret keys to run.
