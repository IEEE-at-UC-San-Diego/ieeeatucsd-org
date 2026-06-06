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
- `VITE_AUTH_BRIDGE_MODE`
- `VITE_CONVEX_URL`
- `VITE_LOGTO_ENDPOINT`
- `VITE_LOGTO_APP_ID`
- `VITE_LOGTO_REDIRECT_URI`
- `VITE_LOGTO_SCOPES`
- `VITE_LOGTO_DIRECT_SIGN_IN_TARGET`
- `VITE_GOOGLE_MAPS_API_KEY`

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

## Rollout checklist

1. Export current Dokploy variable configuration for both apps.
2. Classify every variable as build-time public or runtime secret.
3. Merge this repository change after CI passes.
4. Update Dokploy build arguments to public values only.
5. Confirm runtime secrets are present.
6. Redeploy website, verify health, public pages, sponsor form, and server APIs.
7. Redeploy dashboard, verify health, sign-in, Convex, onboarding, email actions, and file workflows.
8. Confirm build logs and image history do not contain private values.
9. Remove obsolete private build-argument entries from Dokploy.

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
