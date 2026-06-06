# Dashboard Deployment

Shared Docker targets, Dokploy fields, and build-time vs runtime variable policy live in the root guide: [`docs/deployment.md`](../../../docs/deployment.md).

## Quick Start

```bash
# Using docker-compose (recommended)
docker-compose up dashboard

# Docker build and run
docker build -t dashboard . --target dashboard
docker run -p 4323:4323 --env-file .env dashboard
```

## Prerequisites

- Docker & Docker Compose
- Bun runtime (for local development)
- Node.js 20+ (for the production Node server)

## Port Configuration

The dashboard runs on port **4323** in production.

## Environment Variables

### Required Environment Variables

Set these in your `.env` file or pass as build args/runtime env vars:

- `CONVEX_SELF_HOSTED_URL`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `AUTH_BRIDGE_MODE` (`legacy` for rollback, `native` for Convex-native auth)
- `VITE_AUTH_BRIDGE_MODE` (must match `AUTH_BRIDGE_MODE` for client/server consistency)
- `VITE_LOGTO_ENDPOINT`
- `LOGTO_APP_ID` (required by Convex self-hosted auth config)
- `VITE_LOGTO_APP_ID`
- `VITE_LOGTO_REDIRECT_URI`
- `VITE_LOGTO_SCOPES`
- `VITE_LOGTO_DIRECT_SIGN_IN_TARGET` (optional; defaults to `google`, set to `off` to disable direct social sign-in)
- `REPLY_TO_EMAIL`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `MXROUTE_EMAIL_DOMAIN`
- `MXROUTE_EMAIL_OUTBOUND_LIMIT`
- `MXROUTE_EMAIL_QUOTA`
- `MXROUTE_LOGIN_KEY`
- `MXROUTE_SERVER_LOGIN`
- `MXROUTE_SERVER_URL`
- `OPENROUTER_API_KEY`
- `ANTHROPIC_AUTH_TOKEN` (recommended, falls back to `OPENROUTER_API_KEY` when unset)
- `ANTHROPIC_BASE_URL` (optional, defaults to `https://openrouter.ai/api/anthropic`)
- `ANTHROPIC_API_KEY` (optional, SDK-required placeholder if not set)
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`

### Self-Hosted Convex Auth

The repo now includes `convex/auth.config.ts` for native Convex authentication against self-hosted Logto.

- Set `LOGTO_ENDPOINT` to your Logto issuer URL.
- Set `LOGTO_APP_ID` to the Logto application ID used by the dashboard.
- Set both `AUTH_BRIDGE_MODE=native` and `VITE_AUTH_BRIDGE_MODE=native` in staging to enable native Convex auth.
- Keep `AUTH_BRIDGE_MODE=legacy` as the rollback path while validating staging.
- For self-hosted Convex manual setup, apply environment variables directly in the Convex deployment since the CLI flow is limited.

## Docker Deployment

### Build (Local)

```bash
docker build -t dashboard . --target dashboard
```

### Build with Build Args

```bash
docker build -t dashboard . --target dashboard \
  --build-arg VITE_CONVEX_URL=${VITE_CONVEX_URL} \
  --build-arg VITE_LOGTO_ENDPOINT=${VITE_LOGTO_ENDPOINT} \
  # ... additional build args
```

### Run

```bash
docker run -d \
  -p 4323:4323 \
  --env-file .env \
  --restart always \
  dashboard
```

### Using Docker Compose

```bash
# Start dashboard only
docker-compose up dashboard

# Start in detached mode
docker-compose up -d dashboard

# View logs
docker-compose logs -f dashboard

# Stop
docker-compose stop dashboard

# Rebuild and restart
docker-compose up -d --build dashboard
```

## Local Development

```bash
# Install dependencies
vp install

# Start development server (port 3000)
vp run dev

# Build for production
vp run build

# Start production server locally
vp run start
```

## Production Build

The application builds to `.output/server/index.mjs` and runs with Node.js:

1. **Build**: `vp run build` (Vite+ build)
2. **Output**: `.output/` directory
3. **Start**: `node .output/server/index.mjs`

## Docker Configuration Details

### Dockerfile Target

```dockerfile
# Multi-stage build
FROM base as dashboard_builder
WORKDIR /app/apps/dashboard
RUN vp run build

FROM base as dashboard
COPY --from=dashboard_builder /app/apps/dashboard/.output /app/apps/dashboard/.output
WORKDIR /app/apps/dashboard
EXPOSE 4323
CMD ["bun", "run", "start"]
```

### Docker Compose Service

```yaml
dashboard:
  build:
    context: .
    dockerfile: Dockerfile
    target: dashboard
  ports:
    - "4323:4323"
  restart: always
  environment:
    - PORT=4323
    - HOST=0.0.0.0
    # Convex, Logto, Calendar, Email, AI, MXRoute env vars...
```

## Health Check

```bash
curl http://localhost:4323/
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 4323
lsof -i :4323

# Kill the process
kill -9 <PID>
```

### Environment Variables Not Loading

Ensure all required env vars are set in `.env` or passed to Docker. The build args must match the runtime env vars.

### Convex Connection Issues

Verify `CONVEX_SELF_HOSTED_URL` and `VITE_CONVEX_URL` are correctly set and the Convex deployment is accessible.
