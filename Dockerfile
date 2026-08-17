# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo prune @ieeeatucsd/website --docker

FROM base AS website_deps
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM website_deps AS website_builder
ARG PUBLIC_DASHBOARD_URL
ARG PUBLIC_GOOGLE_CALENDAR_ID

ENV PUBLIC_DASHBOARD_URL=$PUBLIC_DASHBOARD_URL \
    PUBLIC_GOOGLE_CALENDAR_ID=$PUBLIC_GOOGLE_CALENDAR_ID

COPY --from=pruner /app/out/full/ .
RUN --mount=type=cache,target=/app/.turbo,id=turbo-website \
    pnpm exec turbo run build --filter=@ieeeatucsd/website

FROM base AS website_system
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_OPTIONS=--max-old-space-size=6144

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      chromium \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libgbm1 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libx11-xcb1 \
      libxcomposite1 \
      libxdamage1 \
      libxrandr2 \
      xdg-utils

FROM website_deps AS website_prod_deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm prune --prod

FROM website_system AS website
WORKDIR /app
USER node

COPY --chown=node:node --from=website_prod_deps /app/node_modules ./node_modules
COPY --chown=node:node --from=website_prod_deps /app/apps/website/node_modules ./apps/website/node_modules
COPY --chown=node:node --from=website_builder /app/apps/website/dist ./apps/website/dist
COPY --chown=node:node --from=website_builder /app/apps/website/package.json ./apps/website/package.json
COPY --chown=node:node --from=website_builder /app/packages ./packages

WORKDIR /app/apps/website
ENV PORT=4321 \
    HOST=0.0.0.0

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4321/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "./dist/server/entry.mjs"]

FROM base AS dashboard_pruner
COPY . .
RUN pnpm dlx turbo prune @ieeeatucsd/dashboard --docker

FROM base AS dashboard_deps
COPY --from=dashboard_pruner /app/out/json/ .
COPY --from=dashboard_pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dashboard_deps AS dashboard_builder
ARG VITE_APP_TITLE
ARG VITE_AUTH_BRIDGE_MODE
ARG VITE_CONVEX_URL
ARG VITE_LOGTO_ENDPOINT
ARG VITE_LOGTO_APP_ID
ARG VITE_LOGTO_REDIRECT_URI
ARG VITE_LOGTO_SCOPES
ARG VITE_LOGTO_DIRECT_SIGN_IN_TARGET
ARG VITE_GOOGLE_MAPS_API_KEY

ENV VITE_APP_TITLE=$VITE_APP_TITLE \
    VITE_AUTH_BRIDGE_MODE=$VITE_AUTH_BRIDGE_MODE \
    VITE_CONVEX_URL=$VITE_CONVEX_URL \
    VITE_LOGTO_ENDPOINT=$VITE_LOGTO_ENDPOINT \
    VITE_LOGTO_APP_ID=$VITE_LOGTO_APP_ID \
    VITE_LOGTO_REDIRECT_URI=$VITE_LOGTO_REDIRECT_URI \
    VITE_LOGTO_SCOPES=$VITE_LOGTO_SCOPES \
    VITE_LOGTO_DIRECT_SIGN_IN_TARGET=$VITE_LOGTO_DIRECT_SIGN_IN_TARGET \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

COPY --from=dashboard_pruner /app/out/full/ .
RUN --mount=type=cache,target=/app/.turbo,id=turbo-dashboard \
    pnpm exec turbo run build --filter=@ieeeatucsd/dashboard

FROM dashboard_deps AS dashboard_prod_deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm prune --prod

FROM base AS dashboard
WORKDIR /app
USER node

COPY --chown=node:node --from=dashboard_prod_deps /app/node_modules ./node_modules
COPY --chown=node:node --from=dashboard_prod_deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --chown=node:node --from=dashboard_builder /app/apps/dashboard/.output ./apps/dashboard/.output
COPY --chown=node:node --from=dashboard_builder /app/apps/dashboard/package.json ./apps/dashboard/package.json

WORKDIR /app/apps/dashboard
ENV PORT=4323 \
    HOST=0.0.0.0

EXPOSE 4323

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4323/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", ".output/server/index.mjs"]
