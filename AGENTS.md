# AGENTS.md

## Cursor Cloud specific instructions

This is a pnpm + Turborepo monorepo with two runnable apps: the public **website** (`apps/website`, Astro SSR) and the internal **dashboard** (`apps/dashboard`, TanStack Start). Standard commands live in the root `README.md`, `apps/dashboard/README.md`, and root `package.json` scripts — use those; the notes below only cover non-obvious cloud gotchas.

### Toolchain

- Package manager is **pnpm 11.21.0** (pinned in `package.json` `packageManager`) on **Node.js 24**. The Nix flake (`nix develop` / direnv) provides both. The startup update script (`pnpm install`) already refreshes dependencies.

### Local `.env` is required (and where it must live)

- Env files are gitignored, so they are NOT recreated by the update script. If missing, copy the root `.env.example` to `.env` and fill values.
- **Vite loads env from each app's own directory, not the repo root.** The dashboard therefore needs its own env file at `apps/dashboard/.env` (a symlink to the root `.env` works: `ln -sf ../../.env apps/dashboard/.env`).
- **`VITE_CONVEX_URL` must be a non-empty absolute URL** (e.g. `http://127.0.0.1:3210`). An empty value makes `ConvexReactClient` throw "Provided address was not an absolute URL", which both crashes dashboard boot and fails `apps/dashboard/src/reimbursement.ai.test.ts`. All other integration env vars are optional in code, so the apps boot without them.

### Running the apps

- Website: `pnpm dev:website` → http://localhost:4321 (health: `/api/health`).
- Dashboard: `pnpm dev:dashboard` → http://localhost:3000 (health: `/api/health`). The root path 307-redirects to `/signin`.

### External services (needed only for full end-to-end flows)

- **Logto** (auth) and **Convex** (database/backend) are external. Logto credentials are supplied as Cursor secrets (`VITE_LOGTO_ENDPOINT`, `VITE_LOGTO_APP_ID`, `LOGTO_ENDPOINT`, `LOGTO_APP_ID`, `LOGTO_M2M_APP_ID`, `LOGTO_M2M_APP_SECRET`) and must be copied into the local `.env` (they are injected as env vars but Vite reads client `VITE_*` values from the env file). With them set, "Continue with Google" correctly redirects through Logto (`auth.ieeeatucsd.org`) to Google OAuth; completing an actual login still needs valid Google account credentials.
- A local self-hosted **Convex** backend runs in Docker. On a fresh VM: start the daemon with `sudo dockerd` (systemd is unavailable; run it in a background/tmux session), then `pnpm dev:convex` (needs `tools/convex-local/.env`, which can just set `PORT=3210`/`SITE_PROXY_PORT=3211`/`DASHBOARD_PORT=6791`). Backend: `http://127.0.0.1:3210`; Convex dashboard UI: `http://127.0.0.1:6791`.
  - Generate an admin key with `sudo docker exec ieee-convex-dev-backend-1 ./generate_admin_key.sh`, put it in `.env` as `CONVEX_SELF_HOSTED_ADMIN_KEY`, then push functions from `apps/dashboard` with `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3210 CONVEX_SELF_HOSTED_ADMIN_KEY=... pnpm exec convex deploy -y`.
  - Several env vars must be set **on the Convex deployment** (`pnpm exec convex env set ...`), not just in the app `.env`: `LOGTO_ENDPOINT` + `LOGTO_APP_ID` (needed at deploy time by `convex/auth.config.ts`) and `CONVEX_SESSION_SECRET` (must match the dashboard's value — `permissions.ts` verifies the legacy session token inside Convex, so a missing/mismatched value makes authenticated queries like `users:getMe` fail with "Missing CONVEX_SESSION_SECRET").
  - Docker note: on Docker 29 use storage-driver `fuse-overlayfs` with `features.containerd-snapshotter=false` in `/etc/docker/daemon.json`, and switch to `iptables-legacy`.

### Known pre-existing issue

- `pnpm check` fails only on a pre-existing Prettier formatting issue in `apps/website/src/pages/privacy-policy.astro` (unrelated to environment setup). `pnpm typecheck` and `pnpm test` pass cleanly once the `.env` above is in place.
