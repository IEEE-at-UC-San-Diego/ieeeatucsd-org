# Dashboard Prefetch-on-Intent Implementation Plan

## Status

- Decision status: Design approved via interview; ready for implementation
- Scope: `apps/dashboard` only
- Delivery model: Infrastructure (token holder + helper) plus one-line `loader` per route
- Affected routing: TanStack Router `_dashboard/*` routes

## Executive Summary

Prefetch the data behind a dashboard route when the user signals intent to navigate
(hovering a link on desktop, touchstart on mobile), so the destination renders with a
warm Convex cache instead of a loading skeleton.

Intent detection already exists. The router sets `defaultPreload: "intent"`
(`src/router.tsx:18`), which fires preload on hover and touchstart for every
`<Link>`. Today that only prefetches the route's JS chunk, because **no route has a
`loader`**. This plan adds data prefetch by giving each route a non-blocking `loader`
that warms the Convex query cache. No custom hover/touch code is required — we reuse the
existing intent mechanism.

## Architecture Context (verified)

- **Routing:** TanStack Router + Start. `defaultPreload: "intent"` already set; no route
  currently defines a `loader`.
- **Data:** Every dashboard route fetches inside its component via Convex reactive
  hooks — `useQuery` (from `convex/react`) and the `useAuthedQuery` wrapper
  (`src/hooks/useAuthedConvex.ts`). These are live WebSocket subscriptions, **not**
  TanStack Query loaders.
- **react-query bridge:** `ConvexQueryClient` is instantiated in
  `src/integrations/convex/provider.tsx` and its `convexClient` powers the provider, but
  it is **never `.connect()`-ed** to a `QueryClient` (root-provider just does
  `new QueryClient()`). So the `convexQuery()` / `ensureQueryData` path is not wired and is
  intentionally not used by this feature.
- **Auth:** Almost all queries are `useAuthedQuery`, which injects
  `{ logtoId, authToken: convexSessionToken }` into the query args. Those tokens live only
  in React `AuthContext` state (`src/hooks/useAuth.ts`) and are **never persisted** to
  storage (verified) — so a loader running outside React cannot read them without a bridge.
- **Filters/pagination:** Applied in-memory to a full list, so the primary query's args do
  **not** change with UI state. The main content of nearly every route is gated on a single
  list query keyed only on `{ logtoId }`.

## Design Decisions

1. **Mechanism — route loaders warm the Convex cache.** Components stay on
   `convex/react` `useQuery` / `useAuthedQuery` unchanged. The route→query mapping is
   co-located in each route file's `loader`; there is no separate registry to drift.

2. **Auth bridge — module-level token holder.** `useAuth`'s shared client writes
   `{ logtoId, convexSessionToken }` into a module-level singleton whenever they change.
   Loaders read the latest via `getAuthTokens()`.

3. **Warm primitive — `convexClient.watchQuery` directly.** The loader calls
   `convexQueryClient.convexClient.watchQuery(query, args)` (already exported from
   `provider.tsx`) and holds an `onUpdate` subscription. This populates the exact store the
   component's raw `useQuery` reads, with zero dependency on the unconnected react-query
   bridge.

4. **Loader is non-blocking.** It opens the subscription and returns immediately; it never
   awaits data. Cold clicks (before preload finishes) render the route normally with the
   component's existing skeleton — no regression. Warm clicks (hover-then-click) are instant.

5. **Lifecycle — hold with timeout + concurrency cap.** On real navigation the component
   opens its own subscription to the same query+args; Convex dedupes to one server
   subscription (clean handoff). For hovers that never convert:
   - **Concurrency cap: 4** simultaneous warm prefetch subscriptions, evict oldest.
   - **Idle timeout: 90s** — dispose a prefetch subscription if the route is not navigated to.
   - **Dedup by query+args** — a repeat hover resets the idle timer instead of opening a
     second subscription.

6. **Coverage — primary query only.** Prefetch the one `{logtoId}`-keyed list query that
   gates the page's main content. Secondary, derived (e.g. `listByDepartment` depending on
   `budgetStats.startDate`), and tab-gated queries load normally in-component.

7. **Loader API — thin helper, one line per route.**
   - `loader: () => prefetchAuthedQuery(api.users.getOverviewData)`
   - With literal extras: `prefetchAuthedQuery(api.fundRequests.getBudgetStats, { department: "events" })`
   - Sibling `prefetchQuery(api.events.listPublished)` for public (non-authed) queries.
   - Standard `createFileRoute` API is otherwise untouched.

8. **Scope — all `_dashboard` routes with a primary query (~15).** Skip dataless routes
   (settings, get-started, slack-access, sponsors/information).
   **Observability:** dev-only `console.debug` for start / hit / miss / evict; production
   silent.

### Baked-in guards (not optional)

- **No-op on server.** SSR has no client `convexClient` and no tokens; the helper returns
  immediately when `typeof window === "undefined"`.
- **Skip silently** when tokens are absent (auth still bootstrapping or unauthenticated),
  or when the target route is the current route.
- **Swallow all prefetch errors** — a failed prefetch must never break preload or
  navigation.

## Implementation Workstreams

### 1. Auth token holder (bridge)

- New module, e.g. `src/lib/prefetch/authTokens.ts`:
  - `setAuthTokens({ logtoId, convexSessionToken })` and
    `getAuthTokens(): { logtoId: string; authToken: string } | null`.
- In `src/hooks/useAuth.ts` `useSharedAuthClient`, add an effect that calls
  `setAuthTokens` whenever `logtoId` / `convexSessionToken` change (and clears on sign-out).

### 2. Prefetch helper

- New module, e.g. `src/lib/prefetch/prefetch.ts`:
  - `prefetchQuery(query, args?)` — warms a public query.
  - `prefetchAuthedQuery(query, extraArgs?)` — reads `getAuthTokens()`, builds
    `{ ...extraArgs, logtoId, authToken }`, skips if no tokens.
  - Internals: maintain a small registry keyed by `query + JSON-stable args`:
    - On warm: if entry exists, reset its 90s idle timer; else open
      `convexClient.watchQuery(...).onUpdate(noop)`, store the disposer, and enforce the
      cap of 4 (dispose oldest).
    - Each entry disposes itself after 90s idle.
  - Guards: server no-op, missing-token skip, try/catch swallow, dev-only `console.debug`.
  - Reads `convexQueryClient` from `src/integrations/convex/provider.tsx`.

### 3. Route loaders

Add a one-line `loader` to each in-scope route:

| Route file | Primary query | Helper call |
|---|---|---|
| `_dashboard/overview.tsx` | `users.getOverviewData` | `prefetchAuthedQuery(api.users.getOverviewData)` |
| `_dashboard/leaderboard.tsx` | `users.getLeaderboard` | `prefetchAuthedQuery(api.users.getLeaderboard)` |
| `_dashboard/links.tsx` | `links.list` | `prefetchAuthedQuery(api.links.list)` |
| `_dashboard/reimbursement.tsx` | `reimbursements.listMine` | `prefetchAuthedQuery(api.reimbursements.listMine)` |
| `_dashboard/manage-users.tsx` | `users.list` | `prefetchAuthedQuery(api.users.list)` |
| `_dashboard/manage-events.tsx` | `events.listAll` | `prefetchAuthedQuery(api.events.listAll)` |
| `_dashboard/manage-reimbursements.tsx` | `reimbursements.listAll` | `prefetchAuthedQuery(api.reimbursements.listAll)` |
| `_dashboard/manage-fund-requests.tsx` | `fundRequests` list (allRequests) | `prefetchAuthedQuery(...)` |
| `_dashboard/fund-requests.tsx` | `fundRequests.listMine` | `prefetchAuthedQuery(api.fundRequests.listMine)` |
| `_dashboard/events.tsx` | `events.listPublished` (public) | `prefetchQuery(api.events.listPublished)` |
| `_dashboard/officer-calendar.tsx` | events list | `prefetchAuthedQuery(...)` |
| `_dashboard/manage-sponsors.tsx` | sponsors domains | `prefetchAuthedQuery(...)` |
| `_dashboard/executive-analytics.tsx` | analytics | `prefetchAuthedQuery(...)` |
| `_dashboard/onboarding.tsx` | invitations/orgSettings (pick the content-gating one) | `prefetchAuthedQuery(...)` |
| `_dashboard/constitution-preview.tsx` | constitution | `prefetchAuthedQuery(...)` |

> Confirm each route's exact primary query + any literal args against the component before
> wiring (a mismatch is harmless — it just produces a cache miss and normal load).

## Verification

- Dev build, open the dashboard, hover a sidebar link: confirm the `console.debug` "start"
  log and a new Convex subscription in devtools; then click and confirm the page renders
  with no skeleton flash.
- Cold click (no hover) still shows the existing skeleton — confirm no regression.
- Rapidly hover many links: confirm no more than 4 warm subscriptions, oldest evicted.
- Hover then wait >90s then click: confirm subscription was disposed (cache miss, normal load).
- Sign out / unauthenticated: confirm loaders no-op and never throw.

## Out of Scope

- Refactoring components to `useSuspenseQuery` / `convexQuery`.
- Connecting `ConvexQueryClient` to a `QueryClient`.
- Prefetching secondary, derived, or tab-gated queries.
- Prefetch on entry points other than `<Link>` intent (e.g. programmatic navigation).
