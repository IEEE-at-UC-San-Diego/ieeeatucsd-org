# GitHub Actions Workflows

This directory contains GitHub Actions workflows for continuous integration, deployment, and infrastructure management for the IEEE at UCSD dashboard application.

## Overview

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| **CI** | [`ci.yml`](./workflows/ci.yml) | Push to main/develop, PRs | Code quality, testing, building |
| **Deploy Dev** | [`deploy-dev.yml`](./workflows/deploy-dev.yml) | Push to develop | Deploy to development environment |
| **Deploy Prod** | [`deploy-prod.yml`](./workflows/deploy-prod.yml) | Tag push, manual | Deploy to production environment |
| **Deploy Convex** | [`deploy-convex.yml`](./workflows/deploy-convex.yml) | Convex changes, manual | Deploy Convex backend functions |

## Workflow Details

### 1. Continuous Integration (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Changes in `apps/dashboard/**` directory

**Steps:**
1. Checkout code
2. Setup Bun runtime
3. Cache dependencies
4. Install dependencies (`bun install`)
5. Run Biome linter/formatter (`bun run check`)
6. TypeScript type checking (`bunx tsc --noEmit`)
7. Run tests with Vitest (`bun run test`)
8. Build application (`bun run build`)
9. Upload build artifacts

**Purpose:** Ensures code quality and catches issues before deployment.

---

### 2. Deploy to Development (`deploy-dev.yml`)

**Triggers:**
- Push to `develop` branch
- Changes in `apps/dashboard/**` directory

**Environment:** `development`

**Steps:**
1. Checkout code
2. Setup Bun runtime
3. Install and cache dependencies
4. Run quality checks (lint + type check)
5. Build application with development environment variables
6. Deploy to development environment (placeholder)

**Required Secrets:**
- `VITE_CONVEX_URL` - Convex backend URL for development
- `VITE_LOGTO_ENDPOINT` - Logto authentication endpoint
- `VITE_LOGTO_APP_ID` - Logto application ID

**Purpose:** Automatically deploy latest changes to the development environment for testing.

---

### 3. Deploy to Production (`deploy-prod.yml`)

**Triggers:**
- Push of version tags (`v*`, e.g., `v1.0.0`)
- Manual trigger with confirmation (`workflow_dispatch`)

**Environment:** `production`

**Safety Features:**
- Pre-deployment authorization check
- Tag-based deployment ensures versioned releases
- Manual trigger requires typing "DEPLOY" as confirmation
- Concurrency protection (only one production deployment at a time)

**Steps:**
1. Pre-deployment verification
2. Checkout code
3. Setup Bun runtime
4. Install and cache dependencies
5. Run all checks (lint, type check, tests)
6. Build application with production environment variables
7. Deploy to production environment (placeholder)
8. Create GitHub release notes (for tag deployments)

**Required Secrets:**
- `VITE_CONVEX_URL` - Convex backend URL for production
- `VITE_LOGTO_ENDPOINT` - Logto authentication endpoint
- `VITE_LOGTO_APP_ID` - Logto application ID

**Purpose:** Deploy stable, tested versions to production with proper safeguards.

---

### 4. Deploy Convex Functions (`deploy-convex.yml`)

**Triggers:**
- Push to `main` or `develop` with changes in `apps/dashboard/convex/**`
- Manual trigger with environment selection

**Steps:**
1. Checkout code
2. Setup Node.js (required for Convex CLI)
3. Setup Bun runtime
4. Install dependencies
5. Validate Convex TypeScript code
6. Deploy to Convex (`bunx convex deploy`)
7. Verify deployment

**Required Secrets:**
- `CONVEX_DEPLOY_KEY` - Convex deployment key
  - Get from: https://dashboard.convex.dev -> Settings -> Deploy Key
  - Or run: `npx convex deploy --dry-run`

**Purpose:** Deploy backend functions to Convex when schema or function code changes.

---

## Required Repository Secrets

Configure these secrets in your GitHub repository settings (`Settings -> Secrets and variables -> Actions`):

### Environment-Specific Secrets

For each environment (development, production), configure:

| Secret | Description | How to Obtain |
|--------|-------------|---------------|
| `VITE_CONVEX_URL` | Convex deployment URL | From Convex dashboard |
| `VITE_LOGTO_ENDPOINT` | Logto auth endpoint | From Logto console |
| `VITE_LOGTO_APP_ID` | Logto application ID | From Logto console |

### Shared Secrets

| Secret | Description | How to Obtain |
|--------|-------------|---------------|
| `CONVEX_DEPLOY_KEY` | Convex CLI deploy key | `npx convex deploy --dry-run` or Convex dashboard |

### Optional Secrets (for actual deployment providers)

When you configure actual deployment targets:

| Secret | Description | Provider |
|--------|-------------|----------|
| `VERCEL_TOKEN` | Vercel CLI token | Vercel |
| `NETLIFY_AUTH_TOKEN` | Netlify auth token | Netlify |
| `AWS_ACCESS_KEY_ID` | AWS access key | AWS |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | AWS |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | Cloudflare Pages |

---

## Setting Up Secrets

### 1. Convex Deploy Key

```bash
# In your local project directory
cd apps/dashboard
npx convex deploy --dry-run
# Or visit: https://dashboard.convex.dev
```

Copy the deploy key and add it as `CONVEX_DEPLOY_KEY` in GitHub secrets.

### 2. Environment Variables

For development:
1. Go to GitHub repository settings
2. Click "Environments" -> "New environment" -> Name it "development"
3. Add environment secrets: `VITE_CONVEX_URL`, `VITE_LOGTO_ENDPOINT`, `VITE_LOGTO_APP_ID`

For production:
1. Create "production" environment
2. Add the same secrets with production values
3. Enable protection rules (optional but recommended)

---

## Deployment Provider Setup

### Vercel (Recommended for TanStack Start)

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Get token
vercel tokens create github-actions
```

Add `VERCEL_TOKEN` secret and update [`deploy-dev.yml`](./workflows/deploy-dev.yml) and [`deploy-prod.yml`](./workflows/deploy-prod.yml):

```yaml
- name: Deploy to Vercel
  run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Get token
netlify login
netlify status # shows site ID
```

Add `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` secrets.

### Cloudflare Pages

Use the official action:

```yaml
- name: Deploy to Cloudflare Pages
  uses: cloudflare/pages-action@v1
  with:
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    projectName: your-project
    directory: apps/dashboard/dist
    gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

---

## Best Practices

1. **Never commit secrets** - Always use GitHub secrets
2. **Use branch protection** - Require PR reviews for main branch
3. **Tag releases** - Use semantic versioning (v1.0.0) for production
4. **Test in development** - Always verify in dev before production deploy
5. **Monitor deployments** - Check Actions tab for deployment status
6. **Enable notifications** - Set up Slack/Discord webhooks for deployment alerts

---

## Troubleshooting

### Workflow not triggering?
- Check branch names match your repository
- Verify file paths in `paths:` filters
- Check if workflow is enabled in Actions tab

### Bun cache issues?
- Clear cache: `rm -rf ~/.bun/install/cache`
- Or disable cache temporarily by removing the cache step

### Convex deployment failing?
- Verify `CONVEX_DEPLOY_KEY` is set correctly
- Check Convex dashboard for deployment status
- Ensure TypeScript compiles without errors

### Build failing?
- Check all required environment variables are set
- Verify `bun.lock` is up to date
- Run locally: `cd apps/dashboard && bun run build`

---

## Related Documentation

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Bun Documentation](https://bun.sh/docs)
- [TanStack Start Deployment](https://tanstack.com/start/latest/docs/framework/react/deployment)
- [Convex Documentation](https://docs.convex.dev/)
- [Biome Documentation](https://biomejs.dev/)
