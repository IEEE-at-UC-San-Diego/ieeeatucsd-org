# AGENTS.md

## Cursor Cloud specific instructions

This is a Bun + Turborepo monorepo with two runnable apps: the public **website** (`apps/website`, Astro SSR) and the internal **dashboard** (`apps/dashboard`, TanStack Start). Standard commands live in the root `README.md`, `apps/dashboard/README.md`, and root `package.json` scripts — use those; the notes below only cover non-obvious cloud gotchas.

### Toolchain

- Package manager/runtime is **Bun 1.3.14** (pinned in `package.json` `packageManager`). Bun is installed to `~/.bun/bin`; if `bun` is not found, prepend `export PATH="$HOME/.bun/bin:$PATH"`. The startup update script (`bun install`) already refreshes dependencies.

### Local `.env` is required (and where it must live)

- Env files are gitignored, so they are NOT recreated by the update script. If missing, copy the root `.env.example` to `.env` and fill values.
- **Vite loads env from each app's own directory, not the repo root.** The dashboard therefore needs its own env file at `apps/dashboard/.env` (a symlink to the root `.env` works: `ln -sf ../../.env apps/dashboard/.env`).
- **`VITE_CONVEX_URL` must be a non-empty absolute URL** (e.g. `http://127.0.0.1:3210`). An empty value makes `ConvexReactClient` throw "Provided address was not an absolute URL", which both crashes dashboard boot and fails `apps/dashboard/src/reimbursement.ai.test.ts`. All other integration env vars are optional in code, so the apps boot without them.

### Running the apps

- Website: `bun run dev:website` → http://localhost:4321 (health: `/api/health`).
- Dashboard: `bun run dev:dashboard` → http://localhost:3000 (health: `/api/health`). The root path 307-redirects to `/signin`.

### External services (needed only for full end-to-end flows)

- **Logto** (auth) and **Convex** (database/backend) are external. Logto credentials are supplied as Cursor secrets (`VITE_LOGTO_ENDPOINT`, `VITE_LOGTO_APP_ID`, `LOGTO_ENDPOINT`, `LOGTO_APP_ID`, `LOGTO_M2M_APP_ID`, `LOGTO_M2M_APP_SECRET`) and must be copied into the local `.env` (they are injected as env vars but Vite reads client `VITE_*` values from the env file). With them set, "Continue with Google" correctly redirects through Logto (`auth.ieeeatucsd.org`) to Google OAuth; completing an actual login still needs valid Google account credentials.
- A local self-hosted Convex backend is available via `bun run dev:convex`, but it requires **Docker** (not installed by default) and a `tools/convex-local/.env` file.

### Known pre-existing issue

- `bun run check` fails only on a pre-existing Prettier formatting issue in `apps/website/src/pages/privacy-policy.astro` (unrelated to environment setup). `bun run typecheck` and `bun run test` pass cleanly once the `.env` above is in place.
