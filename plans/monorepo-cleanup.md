# Monorepo Cleanup Implementation Plan

## Status

- Decision status: Approved for implementation planning
- Delivery model: One coordinated implementation pull request
- Implementation branch: `chore/monorepo-cleanup`
- Pull request state: Ready for review, not draft
- Deployment platform: Dokploy
- Docker build context: Repository root (`.`)
- Dockerfile path: `Dockerfile`

## Executive Summary

This cleanup will turn the repository's partially adopted Bun workspace into a coherent,
enforceable monorepo. The implementation will:

1. Register every package-based app and tool in one Bun workspace and one lockfile.
2. Introduce Turborepo for task orchestration, dependency-aware execution, and caching.
3. Create explicit internal package boundaries, including a reusable email rendering package.
4. Remove duplicated root website source and confirmed obsolete website API routes.
5. Add consistent checks, typechecking, tests, and pull request CI.
6. Consolidate deployment into one secure, multi-target root Dockerfile.
7. Preserve Dokploy's existing root build context, target names, and public ports.
8. Move private configuration out of Docker build arguments and image layers.
9. Document local development, Docker, CI, package ownership, and Dokploy configuration.

The cleanup will be implemented in one PR, but the changes should be made and reviewed in
the ordered workstreams below. Each workstream must leave the repository in a state that can
be inspected independently, even though only the complete PR is intended to merge.

## Goals

- Make the root workspace the only dependency installation boundary.
- Make package dependencies explicit and compatible with isolated installs.
- Make the root commands the canonical interface for repository checks and builds.
- Ensure Turbo understands all app, package, and tool relationships.
- Preserve application behavior while removing confirmed obsolete duplication.
- Ensure both deployable images build from the repository root.
- Prevent private credentials from being persisted in Docker image history or layers.
- Make CI exercise the same Docker targets used by Dokploy.
- Provide an exact Dokploy migration and rollback procedure.

## Non-Goals

- Upgrade the website from React 18 to React 19.
- Upgrade the website from Tailwind 3 to Tailwind 4.
- Align Zod major versions between applications.
- Replace Firebase throughout the website.
- Migrate all website backend behavior into the dashboard.
- Introduce Turborepo remote caching.
- Deduplicate large assets that are intentionally packaged with both deployable apps.
- Redesign application features or user interfaces.

## Current Problems Being Addressed

### Workspace and dependency graph

- The root workspace includes only `apps/*` and `packages/*`.
- `scripts/test-emails` and `scripts/migrate-firebase-to-convex` are independent package
  roots with their own lockfiles.
- `scripts/test-emails` imports a dashboard-private source file through a relative path.
- `apps/dashboard` imports `dompurify`, but the dependency is declared only at the root.
- Workspace package names are not consistently scoped.

### Repository ownership

- Root `src/` and `public/` contain duplicate website files.
- Some duplicate files have diverged, so contributors can modify the wrong copy.
- `apps/website` and `apps/dashboard` still expose several overlapping legacy APIs.
- Generated email preview HTML is committed.
- A deleted `apps/dashboard-v2` app is still referenced by a root script.

### Quality and automation

- There is no repository-wide `check`, `typecheck`, or `test` command.
- The website has no explicit formatting, typecheck, or test scripts.
- Tools have no consistent validation scripts.
- There is no current pull request CI workflow.

### Docker and deployment

- There are two website Dockerfiles with different Bun versions and installation behavior.
- The root Dockerfile duplicates dependency installation for each app.
- Many private credentials are accepted as Docker `ARG` values and copied into image layers.
- Final images run without explicit health checks or non-root enforcement.
- Docker Compose repeats build-time and runtime environment lists.
- Deployment documentation is stale and does not describe Dokploy.

## Target Repository Structure

```text
.
├── apps/
│   ├── dashboard/
│   └── website/
├── packages/
│   ├── config/
│   └── email/
├── tools/
│   ├── migrate-firebase-to-convex/
│   └── test-emails/
├── scripts/
│   └── verify-google-auth.ts
├── docs/
│   ├── deployment.md
│   └── firebase-schema.md
├── plans/
│   └── monorepo-cleanup.md
├── .github/workflows/ci.yml
├── Dockerfile
├── docker-compose.yml
├── turbo.json
├── package.json
└── bun.lock
```

`scripts/` remains available for simple repository scripts that do not own dependencies.
Anything with a `package.json`, source tree, or independent lifecycle belongs under
`apps/`, `packages/`, or `tools/`.

## Workspace and Turborepo Design

### Root package configuration

Update the root `package.json` to:

- Include `apps/*`, `packages/*`, and `tools/*` as workspaces.
- Pin the package manager with `packageManager: "bun@1.3.14"`.
- Add Turborepo as a root development dependency using `bun add -d turbo`.
- Remove application runtime dependencies from the root.
- Remove stale `dashboard-v2` scripts.
- Expose canonical root scripts:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "check": "turbo run check",
    "format": "turbo run format",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "dev:website": "turbo run dev --filter=@ieeeatucsd/website",
    "dev:dashboard": "turbo run dev --filter=@ieeeatucsd/dashboard",
    "build:website": "turbo run build --filter=@ieeeatucsd/website",
    "build:dashboard": "turbo run build --filter=@ieeeatucsd/dashboard"
  }
}
```

Do not manually edit dependency versions into `package.json`. Use Bun install commands so
`package.json` and `bun.lock` are updated together.

### Workspace names

Normalize package names:

| Path | Package name |
| --- | --- |
| `apps/dashboard` | `@ieeeatucsd/dashboard` |
| `apps/website` | `@ieeeatucsd/website` |
| `packages/config` | `@ieeeatucsd/config` |
| `packages/email` | `@ieeeatucsd/email` |
| `tools/migrate-firebase-to-convex` | `@ieeeatucsd/migrate-firebase-to-convex` |
| `tools/test-emails` | `@ieeeatucsd/test-emails` |

All internal imports must be represented by `workspace:*` dependencies.

### Turbo task graph

Create `turbo.json` with:

- `build` depending on upstream `^build`.
- Cacheable outputs for `dist/**`, `.output/**`, and framework-generated build output.
- `check`, `lint`, `typecheck`, and `test` depending on their upstream equivalents where
  shared packages must validate first.
- `dev` marked `persistent: true` and `cache: false`.
- Public client variables included in the build hash.
- Private runtime secrets excluded from the build hash because they must not affect builds.

Initial caching is local plus GitHub Actions cache only. Do not configure a remote cache.

### Version catalogs

Convert only dependencies that are intentionally synchronized to Bun catalog entries.
Initial candidates:

- `convex`
- `class-variance-authority`
- `clsx`
- `date-fns`
- `input-otp`
- `react-hook-form`
- `sonner`
- `vaul`

Do not catalog dependencies whose versions intentionally differ:

- React and React DOM
- Tailwind CSS
- Zod
- Resend
- Google APIs
- Framework-specific Vite and integration packages

Before adding each catalog entry, confirm that every consumer can use one selected version
without changing behavior.

## Package Boundary Cleanup

### Dashboard dependency ownership

- Add `dompurify` directly to `apps/dashboard`.
- Add its type dependency to the dashboard only if the installed package does not provide
  sufficient types.
- Remove `dompurify` and `@types/dompurify` from the root.
- Audit each workspace with an isolated-install or undeclared-import check.
- Treat any dependency used by app code but declared only at the root as a failure.

### Shared email package

Create `packages/email` as a pure internal package.

It should own:

- Universal email document rendering.
- Shared HTML escaping and URL sanitization.
- Currency and date formatting used by email templates.
- Shared visual primitives and template option types.
- Reusable status and detail presentation primitives.
- Unit tests for escaping, URL sanitization, and representative rendering output.

It should not own:

- Resend client creation.
- Environment variable reads.
- Recipient selection.
- Application authorization.
- Convex or Firebase reads and writes.
- Notification state transitions.
- Retry policy or user-facing error classification.

Move the reusable contents of `apps/dashboard/src/server/email-template.ts` into this
package. Keep dashboard notification construction and sending in the dashboard. Update:

- Dashboard email template builders.
- Dashboard notification senders.
- `tools/test-emails`.
- Any actively used website email builder that uses the same primitives.

`tools/test-emails` must depend on `@ieeeatucsd/email` through `workspace:*` and must never
import from an app's `src/` directory.

### Existing config package

Keep framework-specific configuration local unless a setting is genuinely shared. The
existing Tailwind preset can remain in `@ieeeatucsd/config`.

Do not introduce a large shared configuration package merely to reduce a few lines of
TypeScript, Biome, or Prettier configuration. Shared presets should be added only when both
apps can consume the same semantics.

## Tool Migration

Move:

- `scripts/migrate-firebase-to-convex` to `tools/migrate-firebase-to-convex`.
- `scripts/test-emails` to `tools/test-emails`.

Then:

- Delete both nested `bun.lock` files.
- Add both tools to the root workspace.
- Regenerate the root `bun.lock`.
- Add `typecheck` scripts to both tools.
- Add `check` or formatting scripts consistent with the repository formatter selected for
  those files.
- Keep migration execution opt-in; root checks must never execute a real migration.
- Keep email sending opt-in; tests may render previews but must never send messages.
- Move preview output under `tools/test-emails/preview/` and ignore it.
- Remove currently committed preview HTML after confirming it is reproducible.

The standalone `scripts/verify-google-auth.ts` can remain under `scripts/` because it does
not own a package. Add a documented root command for it if it remains operationally useful.

## Legacy Source and API Cleanup

### Root website copies

Treat `apps/website` as canonical.

Delete the root:

- `src/`
- `public/`

Before deletion:

1. Compare every root file against its `apps/website` equivalent.
2. Preserve the `apps/website` version when files differ.
3. Confirm no root build, import, Docker copy, or documentation reference still points at
   root `src/` or `public/`.

### Website and dashboard API ownership

Use repository-wide caller searches to remove only confirmed duplicate website APIs.

Expected duplicate removal candidates include:

- Website `check-email-exists`.
- Website `reset-email-password`.
- Website onboarding send invitation.
- Website onboarding resend invitation.
- Website direct onboarding.

Retain temporarily:

- The website public invitation page redirect to the dashboard.
- The website invitation acceptance proxy if it is still required by externally distributed
  links or compatibility behavior.

Leave unrelated website API routes in place during this cleanup. Their migration from
Firebase or movement into the dashboard should be a later domain-focused project.

For every removed route:

1. Confirm there are no website callers.
2. Confirm the dashboard owns the active implementation.
3. Confirm public links do not depend on the removed URL.
4. Add or retain compatibility redirects/proxies where external links may exist.

## Environment Configuration

### Application validation

Replace the website's custom `require`-based dotenv loader and hand-written `ImportMetaEnv`
interface with explicit validated server and client environment modules.

Rules:

- Client variables must use Astro's `PUBLIC_` prefix or Vite's `VITE_` prefix as appropriate.
- Private variables must never be exported through client modules.
- Server variables should be read from runtime `process.env` in server execution paths.
- Environment validation should fail with actionable messages when a required variable is
  missing for an invoked feature.
- Optional integrations should remain optional during generic CI checks.
- Remove `as any` environment access and replace it with typed access.

Retain the dashboard's `@t3-oss/env-core` approach, but audit every direct `process.env` and
`import.meta.env` read for consistency.

### Build-time public configuration

These values may be passed as Docker build arguments because they are intentionally exposed
to browser bundles.

Website candidates:

- `PUBLIC_FIREBASE_WEB_API_KEY`
- `PUBLIC_FIREBASE_AUTH_DOMAIN`
- `PUBLIC_FIREBASE_PROJECT_ID`
- `PUBLIC_FIREBASE_STORAGE_BUCKET`
- `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `PUBLIC_FIREBASE_APP_ID`
- `PUBLIC_DASHBOARD_URL`
- `PUBLIC_GOOGLE_CALENDAR_ID`

Dashboard candidates:

- `VITE_APP_TITLE`
- `VITE_AUTH_BRIDGE_MODE`
- `VITE_CONVEX_URL`
- `VITE_LOGTO_ENDPOINT`
- `VITE_LOGTO_APP_ID`
- `VITE_LOGTO_REDIRECT_URI`
- `VITE_LOGTO_SCOPES`
- `VITE_LOGTO_DIRECT_SIGN_IN_TARGET`
- `VITE_GOOGLE_MAPS_API_KEY`

Public API keys still need provider-side origin and API restrictions. "Public" means
browser-visible, not unrestricted.

### Runtime-only private configuration

The following must be removed from Docker `ARG` declarations and builder `ENV` layers unless
a specific build step demonstrably requires them:

- Firebase private key and service account fields.
- `RESEND_API_KEY`
- `LOGTO_M2M_APP_SECRET`
- `CONVEX_SELF_HOSTED_ADMIN_KEY`
- `CONVEX_SESSION_SECRET`
- `OPENROUTER_API_KEY`
- MXRoute credentials.
- Google service account private keys.
- Any future private token or password.

Pass these through Dokploy runtime environment variables. If a future build truly needs a
private value, use Dokploy build-time secrets and Docker BuildKit secret mounts, never
ordinary build arguments.

### Environment examples

Split or clearly annotate `.env.example` by service and visibility:

- Shared public build variables.
- Website runtime variables.
- Dashboard runtime variables.
- Convex deployment variables.
- Tool-only migration variables.

Document aliases that currently differ, such as `CONVEX_URL`, `VITE_CONVEX_URL`, and
`CONVEX_SELF_HOSTED_URL`, and reduce aliases where behavior permits.

## Quality Baseline

### Dashboard

- `format`: Biome formatting.
- `lint`: Biome lint.
- `check`: Biome check without mutation.
- `typecheck`: TypeScript without emit.
- `test`: Vitest run.
- `build`: Existing production build command.

### Website

- `format`: Prettier write with Astro plugin.
- `check`: Prettier check plus `astro check`.
- `typecheck`: `astro check`.
- `test`: Add a supported test runner for the existing normalization tests.
- `build`: Existing Astro production build.

Prefer Vitest if it integrates cleanly with the existing Jest-style tests and shared Vite
ecosystem. Do not leave test files present but unexecutable.

### Packages and tools

- Every TypeScript workspace gets `typecheck`.
- Pure shared packages get focused unit tests.
- `check` must be non-mutating.
- `format` may mutate and is intended for local use.
- Tool tests must not contact production systems.

### Root behavior

- `bun run check` validates every workspace through Turbo.
- `bun run typecheck` typechecks every workspace.
- `bun run test` runs every test suite.
- `bun run build` builds deployable applications and any buildable internal packages.
- Filters use scoped package names.

Local implementation should run check, format, lint, typecheck, and tests. Per repository
instructions, do not start development servers. Ask before running local application or
Docker build commands; PR CI will always perform the production Docker builds.

## Pull Request CI

Create `.github/workflows/ci.yml` triggered only for pull requests targeting `main`.

Recommended jobs:

### Repository checks

1. Checkout.
2. Install Bun `1.3.14`.
3. Cache Bun downloads and `.turbo`.
4. Run `bun install --frozen-lockfile`.
5. Run `bun run check`.
6. Run `bun run typecheck`.
7. Run `bun run test`.

### Docker build matrix

Build both root targets:

- `website`
- `dashboard`

Use `docker/setup-buildx-action` and `docker/build-push-action` with GitHub Actions cache.
Do not push images from PR CI.

Provide syntactically valid, non-secret placeholder values only for public build arguments.
No production credentials or GitHub secrets should be required for PR validation.

The Docker job must use:

- Context: `.`
- File: `Dockerfile`
- Target from the matrix.
- `push: false`

This verifies the same build entrypoints that Dokploy uses.

## Dockerfile Design

Delete `apps/website/Dockerfile`. The root `Dockerfile` becomes the only production
definition.

### Base image and versions

- Pin the Docker image to `oven/bun:1.3.14`.
- Match the root `packageManager` version and GitHub Actions Bun version.
- Keep Debian-compatible images for native dependencies and Chromium.
- Avoid installing Chromium in dashboard-only stages.

### Pruned monorepo builds

Use `turbo prune <package> --docker` for each deployable package:

- `turbo prune @ieeeatucsd/website --docker`
- `turbo prune @ieeeatucsd/dashboard --docker`

Each target should have:

1. A pruner stage that creates the target-specific partial workspace.
2. A dependency stage that installs from pruned package metadata and lockfile.
3. A builder stage that copies pruned source and runs the filtered build.
4. A production dependency stage containing only runtime dependencies.
5. A minimal final runtime stage.

Verify Bun's pruned lockfile installation for both targets. If a Turbo/Bun incompatibility is
found, preserve the same stage boundaries and copy only the explicit workspace manifests
needed by each target rather than falling back to copying the full repository before install.

### Website image

- Include Chromium and required shared libraries because website server routes use
  Puppeteer-related functionality.
- Set `PUPPETEER_SKIP_DOWNLOAD=true`.
- Set the correct Chromium executable path.
- Copy only production dependencies, the Astro standalone output, and required runtime
  assets.
- Default `PORT=4321` and `HOST=0.0.0.0`.
- Expose port `4321`.

### Dashboard image

- Do not install Chromium unless a verified dashboard runtime path requires it.
- Copy only production dependencies and the Nitro/TanStack output.
- Default `PORT=4323` and `HOST=0.0.0.0`.
- Expose port `4323`.

### Runtime hardening

For both final targets:

- Run as the existing non-root `bun` user.
- Ensure copied files are owned by that user.
- Add `/api/health` as a lightweight liveness endpoint.
- Add a Docker `HEALTHCHECK` that calls the local health endpoint without requiring curl.
- Keep health checks independent of external Firebase, Convex, Logto, Resend, or Google
  availability.
- Return service name and status, but never environment values or secrets.
- Use exec-form `CMD`.

### Docker context

Update `.dockerignore` to:

- Ignore all dependency, cache, build, coverage, and preview output.
- Ignore local environment files.
- Ignore plans and documentation if they are not required by Turbo prune.
- Stop ignoring the entire `scripts` directory if a required build or package references it.
- Include all package manifests required for workspace and prune resolution.

## Docker Compose

Retain `docker-compose.yml` as a local production-parity tool.

Update it to:

- Build both applications from context `.` and file `Dockerfile`.
- Preserve targets `website` and `dashboard`.
- Preserve ports `4321` and `4323`.
- Pass only browser-visible variables through `build.args`.
- Pass private configuration only through runtime `environment` or `env_file`.
- Avoid listing the same private variable in both build and runtime sections.
- Add health check integration and service dependency conditions only when useful.
- Use modern `docker compose` documentation while remaining compatible with the existing
  Compose file format.

## Dokploy Configuration Changes

The repository changes preserve the current high-level deployment topology: two Dokploy
applications built from the same repository.

### Website application

Set:

| Dokploy field | Value |
| --- | --- |
| Build type | Dockerfile |
| Dockerfile path | `Dockerfile` |
| Docker context path | `.` |
| Docker build stage | `website` |
| Application port | `4321` |
| Health path | `/api/health` |

Configure the website's browser-visible variables under **Build Time Arguments**.
Configure Firebase private credentials, Resend, OpenRouter, MXRoute, and other server
credentials under runtime **Environment Variables**.

### Dashboard application

Set:

| Dokploy field | Value |
| --- | --- |
| Build type | Dockerfile |
| Dockerfile path | `Dockerfile` |
| Docker context path | `.` |
| Docker build stage | `dashboard` |
| Application port | `4323` |
| Health path | `/api/health` |

Configure `VITE_*` browser variables under **Build Time Arguments**. Configure Logto M2M,
Convex admin/session, Resend, OpenRouter, MXRoute, Google private keys, and other credentials
under runtime **Environment Variables**.

### Dokploy migration checklist

Before deploying the implementation PR:

1. Export or record the current variable configuration for both Dokploy applications.
2. Classify every variable using the build-time and runtime sections above.
3. Add any newly documented public build arguments.
4. Ensure every private value exists as a runtime variable.
5. Do not remove the old private build arguments until the new Dockerfile is ready to deploy.

At rollout:

1. Merge the implementation PR after CI passes.
2. Update Dokploy build-time argument lists to public values only.
3. Confirm runtime secret variables are present.
4. Confirm Dockerfile path, context, targets, ports, and health paths.
5. Redeploy the website.
6. Verify health, public pages, sponsor form, and server APIs.
7. Redeploy the dashboard.
8. Verify health, sign-in, Convex connectivity, onboarding, email actions, and file-related
   workflows.
9. Inspect image history or build logs to ensure private values are not emitted.
10. Remove obsolete private build-argument entries from Dokploy.

Rollback:

1. Redeploy the previously successful image or commit in Dokploy.
2. Restore the previous build argument configuration if the old Dockerfile requires it.
3. Keep runtime variables in place; they are compatible with both configurations.

## Documentation

Rewrite the root `README.md` as the repository entrypoint. It should contain:

- Repository purpose.
- Workspace layout.
- Bun version and installation.
- Root Turbo commands.
- Filtered app commands.
- Environment setup links.
- Test and check commands.
- Docker and Compose quick start.
- Links to deployment and app-specific documentation.
- Package ownership and dependency rules.

Create `docs/deployment.md` containing:

- Production architecture.
- Root Docker targets.
- Build-time versus runtime variable policy.
- Docker Compose usage.
- Exact Dokploy configuration tables.
- Deployment verification.
- Rollback procedure.
- Health check behavior.

Update or reconcile `apps/dashboard/docs/DEPLOYMENT.md` so it does not contradict the root
deployment guide. Prefer app-specific operational details there and link to the root guide
for shared Docker and Dokploy configuration.

Update `apps/dashboard/README.md` and add an app-level website README if necessary, keeping
root commands canonical.

## Implementation Order

The work remains one PR, but should proceed in this order:

1. Create the implementation branch from an up-to-date `main`.
2. Add Turbo and normalize workspace names and scripts.
3. Move package-based scripts into `tools/*` and consolidate the lockfile.
4. Correct phantom dependencies and add intentional catalogs.
5. Create `@ieeeatucsd/email` and migrate consumers.
6. Add workspace quality scripts and make root checks pass.
7. Remove root website duplicates and generated previews.
8. Audit and remove confirmed duplicate website APIs.
9. Refactor environment access and document variable ownership.
10. Add health endpoints.
11. Replace Dockerfiles with the root pruned multi-target build.
12. Update Docker Compose.
13. Add pull request CI, including both Docker targets.
14. Rewrite repository and deployment documentation.
15. Run formatting, linting, checks, typechecks, and tests.
16. With explicit approval for local builds, build both Docker targets locally; otherwise use
    the PR Docker matrix as the production-build verification.
17. Open one ready-for-review PR against `main`.

## Suggested Commit Structure

Keep the final PR reviewable with focused commits:

1. `Configure Bun workspaces and Turborepo`
2. `Move repository tools into the workspace`
3. `Extract shared email rendering package`
4. `Remove legacy source and API duplication`
5. `Standardize checks and environment validation`
6. `Harden Docker and Dokploy deployment`
7. `Add pull request CI and documentation`

Commits may be adjusted as implementation reveals better boundaries, but unrelated feature
work must not be included.

## Verification Matrix

| Area | Verification |
| --- | --- |
| Install | `bun install --frozen-lockfile` from a clean checkout |
| Workspace graph | `turbo ls` contains all apps, packages, and tools |
| Dependency boundaries | No app imports undeclared root-only dependencies |
| Internal packages | All cross-workspace imports use package names and `workspace:*` |
| Formatting | Root `bun run check` succeeds |
| Types | Root `bun run typecheck` succeeds |
| Tests | Root `bun run test` succeeds |
| Website | Astro check and website tests succeed |
| Dashboard | Biome, TypeScript, and Vitest succeed |
| Email package | Rendering and sanitization tests succeed |
| Tools | Typechecking succeeds without executing external operations |
| Legacy cleanup | No imports or docs reference root `src/` or `public/` |
| API ownership | Removed website routes have no callers |
| Website image | PR CI builds Docker target `website` |
| Dashboard image | PR CI builds Docker target `dashboard` |
| Runtime user | Both images run as non-root |
| Health | Both `/api/health` endpoints return success |
| Secrets | Private values are absent from Docker build arguments and image history |
| Dokploy | Both applications deploy from root context with preserved targets and ports |

## Acceptance Criteria

The implementation is complete when:

- One root `bun.lock` covers every package-based workspace.
- No nested lockfiles remain.
- `tools/*` is part of the workspace.
- All workspace packages use scoped names.
- No app depends on undeclared root runtime dependencies.
- `tools/test-emails` depends on `@ieeeatucsd/email`, not dashboard source.
- Root `src/` and `public/` are removed.
- Confirmed obsolete website API duplicates are removed.
- Generated email previews are ignored.
- Root Turbo commands validate the complete repository.
- Pull request CI runs checks, types, tests, and both Docker builds.
- One root Dockerfile owns the `website` and `dashboard` targets.
- The app-level website Dockerfile is removed.
- Private credentials are runtime-only.
- Both final images run as non-root and expose working health endpoints.
- Docker Compose reflects production Docker targets without baking secrets.
- Dokploy migration instructions list every field the operator must change.
- README and deployment documentation match actual commands and ports.
- The implementation is delivered as one ready PR against `main`.

## Risks and Mitigations

### Bun and Turbo prune compatibility

Mitigation: Validate both pruned installs early. Preserve target-specific manifest-copy stages
as a fallback without abandoning one lockfile or workspace boundaries.

### Runtime dependency omissions

Mitigation: Build both final Docker targets in CI and smoke-test their health endpoints.
Audit server externalization in the dashboard and Astro standalone runtime imports.

### Environment timing differences

Mitigation: Classify every variable as browser build-time or server runtime. Add focused
tests for environment parsing and use CI placeholders only for public values.

### External links to legacy website APIs

Mitigation: Remove only routes with no repository callers and clear dashboard ownership.
Retain invitation redirects/proxies where distributed links may still exist.

### Coordinated Dokploy transition

Mitigation: Preserve Docker target names and ports, document the exact variable migration,
record current Dokploy settings before rollout, and keep rollback steps ready.

### Large single PR

Mitigation: Use focused commits, keep feature work out, retain stable behavior, and require
all repository and Docker checks before merge.

## Reference Documentation

- Bun workspaces: https://bun.sh/docs/install/workspaces
- Bun catalogs: https://bun.sh/docs/install/catalogs
- Bun isolated installs: https://bun.sh/docs/pm/isolated-installs
- Turborepo package and task graphs:
  https://turborepo.com/repo/docs/core-concepts/package-and-task-graph
- Turborepo Docker pruning:
  https://turborepo.com/repo/docs/handbook/deploying-with-docker
- Dokploy Dockerfile builds:
  https://docs.dokploy.com/docs/core/applications/build-type
- Dokploy environment variables:
  https://docs.dokploy.com/docs/core/variables
- Dokploy Turborepo guidance:
  https://docs.dokploy.com/docs/core/turborepo
