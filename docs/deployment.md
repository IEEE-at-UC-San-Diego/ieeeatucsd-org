# Deployment

Production deploys two applications from this repository: the public website and the internal dashboard. Both images are built from the repository root using multi-stage targets in [`Dockerfile`](../Dockerfile).

## Architecture

| Application | Docker target | Port | Health path |
| --- | --- | --- | --- |
| Website | `website` | `4321` | `/api/health` |
| Dashboard | `dashboard` | `4323` | `/api/health` |

Build context: `.` (repository root)

## Build-time vs runtime variables

### Website build arguments (browser-visible)

Configure these in Dokploy **Build Time Arguments** or Docker Compose `build.args`:

- `PUBLIC_DASHBOARD_URL`
- `PUBLIC_GOOGLE_CALENDAR_ID`

### Dashboard build arguments (browser-visible `VITE_*`)

- `VITE_APP_TITLE`
- `VITE_CONVEX_URL`
- `VITE_LOGTO_ENDPOINT`
- `VITE_LOGTO_APP_ID`
- `VITE_LOGTO_REDIRECT_URI`
- `VITE_LOGTO_SCOPES`
- `VITE_LOGTO_DIRECT_SIGN_IN_TARGET`
- `VITE_GOOGLE_MAPS_API_KEY`

### Dashboard Convex deploy (Dokploy production only)

Set these on the **dashboard** application **Environment Variables** (runtime), not as build arguments, and not on the website app.

| Variable | Where in Dokploy | Required when |
| --- | --- | --- |
| `DEPLOY_CONVEX=1` | Dashboard **Environment Variables** | Production Dokploy deploys |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Dashboard **Environment Variables** (secret) | `DEPLOY_CONVEX=1` |
| `CONVEX_SELF_HOSTED_URL` | Dashboard **Environment Variables** | Optional if it is already set and matches the Convex HTTP URL |
| `LOGTO_ENDPOINT` + `LOGTO_APP_ID` | Dashboard **Environment Variables** | `DEPLOY_CONVEX=1` (`convex/auth.config.ts` reads them at push time) |

The dashboard container entrypoint (`scripts/start-dashboard.mjs`) pushes Convex, then starts the Node server:

- `DEPLOY_CONVEX` unset / `0` (CI image builds, local compose): skip Convex and start the server.
- `DEPLOY_CONVEX=1` without URL or admin key: exit non-zero and the container does not start.
- `DEPLOY_CONVEX=1` with credentials: `pnpm exec convex deploy -y`. A failed push fails container start, so the Dokploy deploy is unhealthy.

The push runs at **container start**, not during `docker build`. Dokploy's default Dockerfile builder reuses cached `RUN` layers when source and build args are unchanged (`--no-cache` only if Clean Cache is enabled). Registry and Swarm rollbacks restart a previous image and do not rebuild, so a build-time `convex deploy` would stay on the newer schema. Start-time push uses the `convex/` tree baked into that image, so a rollback to release A also pushes A's functions.

Do not set `DEPLOY_CONVEX` on the website app. This backend is **self-hosted Convex**, not Convex Cloud. There is no `CONVEX_DEPLOY_KEY`.

### Runtime-only secrets

Never pass these as Docker `ARG` values. Configure them as Dokploy runtime **Environment Variables** or Compose `environment` / `env_file`:

- `RESEND_API_KEY`
- `LOGTO_M2M_APP_SECRET`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `CONVEX_SESSION_SECRET`
- `OPENROUTER_API_KEY`
- MXRoute credentials
- Google service account private keys

Public API keys are still restricted in their provider consoles. "Public" means browser-visible, not unrestricted.

## Docker Compose

Local production-parity builds:

```bash
docker compose build website dashboard
docker compose up website
docker compose up dashboard
```

Compose passes only browser-visible values through `build.args`. Private configuration is runtime-only.

## Dokploy configuration

### Website application

| Dokploy field | Value |
| --- | --- |
| Build type | Dockerfile |
| Dockerfile path | `Dockerfile` |
| Docker context path | `.` |
| Docker build stage | `website` |
| Application port | `4321` |
| Health path | `/api/health` |

### Dashboard application

| Dokploy field | Value |
| --- | --- |
| Build type | Dockerfile |
| Dockerfile path | `Dockerfile` |
| Docker context path | `.` |
| Docker build stage | `dashboard` |
| Application port | `4323` |
| Health path | `/api/health` |

On the dashboard app only, add runtime environment variables `DEPLOY_CONVEX=1` and `CONVEX_SELF_HOSTED_ADMIN_KEY`. If the Convex HTTP URL is not already present as `CONVEX_SELF_HOSTED_URL`, set that too. Leave all three unset on the website app so functions deploy exactly once.

## Rollout checklist

1. Export current Dokploy variable configuration for both apps.
2. Classify every variable as build-time public, dashboard Convex-deploy secret, or runtime secret.
3. Merge this repository change after CI passes.
4. Update Dokploy website build arguments to public values only.
5. On the dashboard app, set public `VITE_*` build arguments and runtime `DEPLOY_CONVEX=1` plus `CONVEX_SELF_HOSTED_ADMIN_KEY` (secret).
6. Confirm remaining runtime secrets are present, including `LOGTO_ENDPOINT` and `LOGTO_APP_ID`.
7. Redeploy website, verify health, public pages, sponsor form, and server APIs.
8. Redeploy dashboard, confirm the **container** log contains `Deploying Convex functions and schema to …`, then verify health, sign-in, Convex, onboarding, email actions, and file workflows.
9. Confirm image history does not contain the admin key (it is runtime-only).
10. Remove obsolete private build-argument entries from Dokploy.

## Rollback

Dokploy rollbacks do **not** rebuild:

- Registry rollback starts the image saved for that deployment.
- Swarm health-check rollback restarts the previous task.

A build-time `convex deploy` would therefore stay on the newer schema when the dashboard image rolls back. The dashboard entrypoint pushes the `convex/` tree that shipped in **that** image, then starts the server. Rolling back to release A pushes A's functions before A listens.

1. Roll back the dashboard application to the previous successful deployment (or redeploy that commit).
2. Confirm the container log for the rolled-back image contains `Deploying Convex functions and schema to …` and that the push finished before `/api/health` became ready.
3. Restore the previous build-argument configuration only if the old Dockerfile required different public `VITE_*` / `PUBLIC_*` values.
4. Keep runtime variables in place, including `DEPLOY_CONVEX=1` and `CONVEX_SELF_HOSTED_ADMIN_KEY`. Do not unset `DEPLOY_CONVEX` during a rollback.
5. Website-only rollback does not change Convex. Always roll the dashboard back when the functions must match an older UI.

## Health checks

Both services expose `GET /api/health` returning JSON:

```json
{ "service": "website", "status": "ok" }
```

Checks are independent of Convex, Logto, Resend, and Google availability.
