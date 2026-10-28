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

### Dashboard Convex deploy arguments (Dokploy production only)

Set these on the **dashboard** application only. The website image never deploys Convex.

| Argument | Where in Dokploy | Required when |
| --- | --- | --- |
| `DEPLOY_CONVEX=1` | Dashboard **Build Time Arguments** | Production Dokploy deploys |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | Dashboard **Build Time Arguments** (secret) | `DEPLOY_CONVEX=1` |
| `CONVEX_SELF_HOSTED_URL` | Dashboard **Build Time Arguments** | Optional if `VITE_CONVEX_URL` is already the self-hosted Convex URL |

`apps/dashboard/scripts/deploy-convex.mjs` runs during the `dashboard` image build:

- `DEPLOY_CONVEX` unset / `0` (CI, local `docker compose build`): skip Convex and succeed.
- `DEPLOY_CONVEX=1` without URL or admin key: fail the build.
- `DEPLOY_CONVEX=1` with credentials: `pnpm exec convex deploy -y` against the self-hosted backend. A failed push fails the Dokploy deploy.

The admin key is an `ARG` on the `dashboard_builder` stage only. It is not `ENV`'d into the runtime `dashboard` image. Do not set `DEPLOY_CONVEX` on the website app.

This backend is **self-hosted Convex**, not Convex Cloud. There is no `CONVEX_DEPLOY_KEY`. Production already uses `CONVEX_SELF_HOSTED_URL` + `CONVEX_SELF_HOSTED_ADMIN_KEY` (see `AGENTS.md` and local `pnpm exec convex deploy -y`). `convex/auth.config.ts` also needs `VITE_LOGTO_ENDPOINT` / `VITE_LOGTO_APP_ID` (already dashboard build args) or `LOGTO_ENDPOINT` / `LOGTO_APP_ID` at deploy time.

### Runtime-only secrets

Never pass these as Docker `ARG` values. Configure them as Dokploy runtime **Environment Variables** or Compose `environment` / `env_file`:

- `RESEND_API_KEY`
- `LOGTO_M2M_APP_SECRET`
- `CONVEX_SESSION_SECRET`
- `OPENROUTER_API_KEY`
- MXRoute credentials
- Google service account private keys

`CONVEX_SELF_HOSTED_ADMIN_KEY` is the exception: Dokploy production must pass it as a **dashboard build-time** argument so `convex deploy` can run. Keep it marked secret in Dokploy. It is still fine to leave it as a runtime variable, but the runtime image does not need it.

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

On the dashboard app only, add build-time arguments `DEPLOY_CONVEX=1` and `CONVEX_SELF_HOSTED_ADMIN_KEY`. If the Convex HTTP URL is not already `VITE_CONVEX_URL`, also set `CONVEX_SELF_HOSTED_URL`. Leave all three unset on the website app so functions deploy exactly once.

## Rollout checklist

1. Export current Dokploy variable configuration for both apps.
2. Classify every variable as build-time public, dashboard Convex-deploy secret, or runtime secret.
3. Merge this repository change after CI passes.
4. Update Dokploy website build arguments to public values only.
5. On the dashboard app, set public `VITE_*` build arguments plus `DEPLOY_CONVEX=1` and `CONVEX_SELF_HOSTED_ADMIN_KEY` (secret).
6. Confirm remaining runtime secrets are present.
7. Redeploy website, verify health, public pages, sponsor form, and server APIs.
8. Redeploy dashboard, confirm the build log contains `Deploying Convex functions and schema to …`, then verify health, sign-in, Convex, onboarding, email actions, and file workflows.
9. Confirm build logs and image history do not print the admin key.
10. Remove obsolete private build-argument entries from Dokploy (except the dashboard Convex deploy key).

## Rollback

1. Redeploy the previously successful image or commit in Dokploy.
2. Restore the previous build-argument configuration if the old Dockerfile required private build args.
3. Keep runtime variables in place; they are compatible with both configurations.

## Health checks

Both services expose `GET /api/health` returning JSON:

```json
{ "service": "website", "status": "ok" }
```

Checks are independent of Convex, Logto, Resend, and Google availability.
