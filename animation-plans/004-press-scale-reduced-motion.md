# 004 — Honor reduced-motion for ad-hoc active:scale press feedback

- **Status**: DONE
- **Commit**: 24bdb1d
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 CSS rule + ~8 call sites, small class edits

## Problem

`styles.css` already zeros press scale for `[data-slot='button']:active` and `.motion-press:active` under `prefers-reduced-motion: reduce`. Many interactive surfaces use bare Tailwind `active:scale-[…]` on plain `<a>`, `<button>`, `<Link>`, or `role="button"` elements **without** those hooks, so press transforms still run when the user asks for less motion.

Confirmed call sites at commit `24bdb1d` (skip ones already on `Button` / `data-slot="button"` — e.g. `MobileAppBar.tsx`, `ConstitutionDocumentEditor.tsx` toolbar — those are already covered):

```tsx
/* apps/dashboard/src/components/mobile/MobileTabBar.tsx:77-79 */
"flex flex-1 flex-col items-center justify-center gap-1 px-1 transition-transform active:scale-[0.97]",

/* apps/dashboard/src/components/mobile/MobileTaskStepper.tsx:59-60 */
"flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold transition-colors active:scale-[0.97]",

/* apps/dashboard/src/components/theme/appearance-picker.tsx:54-56 */
"group relative flex flex-col items-start gap-3 rounded-md border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-[var(--ease-geist)]",
"hover:bg-ds-gray-100 active:scale-[0.98]",

/* apps/dashboard/src/components/mobile/MobileDataList.tsx:66-67 */
"cursor-pointer transition-colors active:bg-muted/60 active:scale-[0.995] md:hover:bg-muted/40",

/* apps/dashboard/src/components/mobile/MobileFilters.tsx:129 */
"inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-ieee-blue/30 bg-ds-blue-100/80 px-2.5 text-xs font-medium text-tone-link active:scale-[0.97]",

/* apps/dashboard/src/routes/_dashboard/reimbursement.tsx:1124 */
"flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/80 bg-card p-8 text-center active:scale-[0.99] transition-transform",

/* apps/dashboard/src/routes/_dashboard/executive-analytics.tsx:310 */
"flex h-11 w-full items-center justify-between rounded-md border bg-background px-3 text-sm font-medium active:scale-[0.99]",

/* apps/dashboard/src/routes/__root.tsx:112 */
"inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground active:scale-[0.97]",

/* apps/dashboard/src/components/manage-events/calendar/EventCalendar.tsx:199 */
"flex min-h-14 min-w-14 shrink-0 flex-col items-center justify-center rounded-md border px-2 py-1.5 text-xs active:scale-[0.97]",
```

AUDIT.md §6: drop movement under reduced motion; keep other feedback.

## Target

### A. CSS safety net (required)

In `apps/dashboard/src/styles.css`, inside `@media (prefers-reduced-motion: reduce)`, expand the active-transform kill list:

```css
/* replace / extend the existing button-only rule */
[data-slot='button']:active,
.motion-press:active,
:where(a, button, [role='button'], [role='radio'], [role='tab']):active {
  transform: none !important;
}
```

Keep the existing `.motion-press { transition: none !important; }` rule as-is.

### B. Route pressables through `.motion-press` (required for listed sites)

Existing utility (do not redefine):

```css
/* styles.css:740-746 — current */
.motion-press {
  transition: transform var(--duration-fast) var(--ease-geist);
}
.motion-press:active {
  transform: scale(0.97);
}
```

For each listed site:

1. Add class `motion-press`.
2. Remove the local `active:scale-[…]` (and redundant `transition-transform` that only existed for that scale) so `.motion-press` owns press motion.
3. Keep non-transform transitions (`transition-colors`, background, etc.) as needed.

Special cases:

- **appearance-picker** (`active:scale-[0.98]`): switch to `.motion-press` (`scale(0.97)`). Accept the 0.01 difference — do not fork a second press scale token.
- **MobileDataList** (`active:scale-[0.995]`): same — use `.motion-press` at `0.97`, or if that feels too strong on dense rows, use `motion-press` plus an override class is **not** allowed; stick to `0.97` for cohesion.
- **reimbursement / executive-analytics** (`0.99`): same — standardize on `.motion-press` / `0.97`.

## Repo conventions to follow

- Press feedback exemplar already used in-product: `apps/dashboard/src/components/dashboard/manage-users/AddMemberModal.tsx:180` (`motion-press` + `transition-colors`).
- Button press (already gated): `apps/dashboard/src/components/ui/button.tsx:8` — `active:scale-[0.97]` + `data-slot="button"`.
- Duration/easing tokens: `--duration-fast: 150ms`, `--ease-geist: cubic-bezier(0.23, 1, 0.32, 1)`.

## Steps

1. Update the reduced-motion `:active` transform rule in `styles.css` per Target A.
2. Edit each file in the call-site list: add `motion-press`, remove bare `active:scale-*` (and orphaned transform-only transition utilities).
3. Grep `apps/dashboard/src` for `active:scale-` afterward. Remaining hits should only be on `Button` / `buttonVariants` / elements that already have `data-slot="button"`. If you find new orphans, apply the same fix or report them.
4. Do not change hover colors, layout, or hit targets.

## Boundaries

- Do NOT add Framer Motion.
- Do NOT invent `--press-scale` tokens.
- Do NOT weaken the CSS safety net (Target A is mandatory even if every site migrates to `.motion-press`).
- Do NOT modify sidebar menu button press in this plan (finding #8 — separate).
- If a site already uses `Button`, leave it alone.

## Verification

- **Mechanical**: `cd apps/dashboard && bun run typecheck && bun run check`.
- **Feel check**:
  - Reduce **off**: press MobileTabBar / appearance cards / data-list rows — subtle `scale(0.97)` over ~150ms `--ease-geist`.
  - Reduce **on**: same controls — no scale on `:active`; color/opacity feedback may remain.
  - Spam-press tab bar: no stuck scaled state.
- **Done when**: CSS safety net covers interactive `:active`; listed sites use `.motion-press` without local `active:scale-*`; grep shows no orphaned ad-hoc scales outside `Button`.
