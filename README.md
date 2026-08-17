# IEEE at UC San Diego Monorepo

Official monorepo for the IEEE UC San Diego student branch website and internal dashboard.

## Repository layout

```text
apps/
  dashboard/   # TanStack Start dashboard (@ieeeatucsd/dashboard)
  website/     # Astro public website (@ieeeatucsd/website)
packages/
  config/      # Shared Tailwind preset (@ieeeatucsd/config)
  email/       # Shared email rendering (@ieeeatucsd/email)
tools/
  test-emails/
docs/
  deployment.md
```

## Prerequisites

- [Node.js 24](https://nodejs.org/)
- [pnpm 11.21.0](https://pnpm.io) (pinned in `package.json` `packageManager`)

Or enter the Nix flake (`direnv allow` / `nix develop`), which provides both. Then from the repository root:

```bash
pnpm install
```

## Root commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start all dev servers via Turborepo |
| `pnpm dev:website` | Website only |
| `pnpm dev:dashboard` | Dashboard only |
| `pnpm build` | Build all packages and apps |
| `pnpm check` | Non-mutating format/lint/check across the workspace |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm test` | Run all test suites |
| `pnpm format` | Apply formatters locally |
| `pnpm verify:google-auth` | Diagnose Google Workspace auth setup |

## Environment setup

Copy `.env.example` to `.env` and fill in values for the apps you are running. See:

- [`.env.example`](.env.example) for variable ownership and aliases
- [`apps/website/.env.example`](apps/website/.env.example) for website-specific notes
- [`docs/deployment.md`](docs/deployment.md) for production build-time vs runtime variables

## Docker

Both production images build from the repository root:

```bash
docker compose build
docker compose up website   # http://localhost:4321
docker compose up dashboard # http://localhost:4323
```

Health endpoints: `/api/health` on both services.

See [`docs/deployment.md`](docs/deployment.md) for Dokploy configuration and rollout steps.

## Package ownership

- Apps declare their own runtime dependencies. Do not add app dependencies at the repository root.
- Cross-workspace imports must use scoped package names and `workspace:*` dependencies.
- Shared rendering logic belongs in `packages/email`, not in app `src/` trees.
- Tools under `tools/` are workspace members with their own `package.json` files.

## App documentation

- Dashboard: [`apps/dashboard/README.md`](apps/dashboard/README.md)
- Deployment: [`docs/deployment.md`](docs/deployment.md)
