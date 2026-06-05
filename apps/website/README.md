# IEEE at UC San Diego Website

Astro public website (`@ieeeatucsd/website`).

From the repository root:

```bash
bun install
bun run dev:website
```

App-local commands from `apps/website`:

```bash
bun run dev
bun run build
bun run check
bun run test
```

Deployment uses the root `Dockerfile` `website` target. See [`docs/deployment.md`](../../docs/deployment.md).
