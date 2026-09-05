# Deploying Marg (hosted demo)

Marg ships as **one service**: the Express backend serves both the `/api` routes
and the built React front-end, so there's a single URL and no CORS setup.

> This is a **portfolio / demo** deployment. It is **not** hardened for real
> students yet — the dataset is provisional (see the in-app disclaimer), the
> crisis check is keyword-based, and parental consent is not truly verified. Do
> not point real minors at it until that work is done.

## What you need
- A container host (Render, Fly.io, Railway, or any Docker host) — free tiers work.
- A **Groq API key** (free) from https://console.groq.com — or another provider.
- 5 minutes.

## Environment variables (set these on the host)
| Var | Required | Notes |
|---|---|---|
| `GROQ_API_KEY` | yes | Your LLM key. `LLM_PROVIDER=groq` is the default. |
| `ADMIN_USER` / `ADMIN_PASS` | yes | **Change from `admin`/`admin`.** Gates the metrics dashboard. |
| `NODE_ENV` | recommended | `production` |
| `PORT` | auto | Most hosts set this; the app reads it. |
| `POSTHOG_KEY` | optional | PostHog project key → enables product analytics (sessions, funnels, time-to-value). No rebuild needed; served at runtime via `/api/config`. |

The Docker image sets `WEB_DIST` and serves the SPA automatically.

## Option A — Docker (any host)
```bash
docker build -t marg .
docker run -p 5175:5175 \
  -e GROQ_API_KEY=xxx -e ADMIN_USER=you -e ADMIN_PASS=strongpass -e NODE_ENV=production \
  marg
# open http://localhost:5175
```
On Render/Fly/Railway: point the service at this repo, it auto-detects the
`Dockerfile`, add the env vars above, deploy.

## Option B — run without Docker
```bash
cd web && npm ci && npm run build        # builds web/dist
cd ../api && npm ci
NODE_ENV=production WEB_DIST=../web/dist GROQ_API_KEY=xxx ADMIN_PASS=strongpass npm start
# open http://localhost:5175
```

## Seed the demo dashboard (optional)
The database starts empty, so the admin North-Star dashboard reads 0 until there's
activity. To populate a realistic demo cohort (~68% North Star):
```bash
cd api && SEED_BASE=https://your-deployed-url npm run seed
```
Data is clearly synthetic (`sim_*` accounts). Skip this for a clean baseline.

## Known limits (fine for a demo, fix before real launch)
- **Rate limits:** Groq's free tier is ~8k tokens/min (~1 chat/min). Upgrade the
  Groq tier or switch `LLM_PROVIDER` for real traffic.
- **Database:** uses Node's built-in SQLite (a single file). On hosts with an
  **ephemeral filesystem the data resets on redeploy** — attach a persistent disk,
  or migrate to Postgres (the schema is written to port cleanly).
- **Admin auth:** in-memory tokens (reset on restart); replace with real auth
  before anything sensitive.
