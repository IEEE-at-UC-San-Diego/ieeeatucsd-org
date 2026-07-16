# 005 — Tokenize drawer overlay entrance easing

- **Status**: DONE
- **Commit**: 24bdb1d
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 1 className string

## Problem

`DrawerOverlay` uses `animate-in` / `fade-in` without an easing or duration token. `tw-animate-css` defaults the animation timing function to weak built-in `ease`, so the scrim feels sluggish compared to sheet/dialog overlays that already use Geist / drawer curves.

```tsx
/* apps/dashboard/src/components/ui/drawer.tsx:37-39 — current */
className={cn(
  "motion-surface data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 [@media(prefers-reduced-transparency:reduce)]:bg-black/70",
  className,
)}
```

Compare sheet overlay (correct pattern for drawer family):

```tsx
/* apps/dashboard/src/components/ui/sheet.tsx:37 — exemplar */
"motion-surface data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 ease-[var(--ease-drawer)] data-[state=closed]:duration-[var(--duration-ui)] data-[state=open]:duration-[var(--duration-panel)] [@media(prefers-reduced-transparency:reduce)]:bg-black/70",
```

AUDIT.md §2: entering → strong ease-out family; built-in `ease` is too weak. Drawer curve token already exists:

```css
/* apps/dashboard/src/styles.css:130-134 */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
--duration-ui: 200ms;
--duration-panel: 220ms;
```

## Target

```tsx
/* drawer.tsx DrawerOverlay — target */
className={cn(
  "motion-surface data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 ease-[var(--ease-drawer)] data-[state=closed]:duration-[var(--duration-ui)] data-[state=open]:duration-[var(--duration-panel)] [@media(prefers-reduced-transparency:reduce)]:bg-black/70",
  className,
)}
```

Exact values:

- Easing: `var(--ease-drawer)` → `cubic-bezier(0.32, 0.72, 0, 1)`
- Open duration: `var(--duration-panel)` → `220ms`
- Close duration: `var(--duration-ui)` → `200ms`

Do not change `DrawerContent` classes in this plan (Vaul owns panel motion; reduced-motion is plan 003).

## Repo conventions to follow

- Sheet overlay is the exemplar (`sheet.tsx:37`) — copy its ease/duration token classes onto drawer overlay.
- Dialog/alert-dialog use `--ease-geist` + panel/panel-exit; drawers/sheets use `--ease-drawer` — keep that family split.

## Steps

1. Edit `apps/dashboard/src/components/ui/drawer.tsx` `DrawerOverlay` `className` to match Target (add the three token utilities; keep `motion-surface` and transparency media query).
2. No other file changes.

## Boundaries

- Do NOT alter Vaul `DrawerContent` markup, handle, or direction classes.
- Do NOT change sheet/dialog overlays.
- Do NOT add new CSS variables.
- Do NOT remove `motion-surface` (needed for plan 003 / existing reduce rules on tw-animate enter vars).

## Verification

- **Mechanical**: `cd apps/dashboard && bun run typecheck && bun run check`.
- **Feel check**:
  - Open a mobile drawer / `ResponsiveOverlay`. Scrim fade should feel responsive (strong drawer curve), open ~220ms / close ~200ms — aligned with sheet.
  - Animations panel at 10%: overlay animation uses the custom cubic-bezier, not default `ease`.
  - With `prefers-reduced-motion: reduce`, overlay movement/enter vars still collapse via existing `.motion-surface` / plan 003 Vaul rules.
- **Done when**: `DrawerOverlay` class string includes `ease-[var(--ease-drawer)]`, `data-[state=open]:duration-[var(--duration-panel)]`, and `data-[state=closed]:duration-[var(--duration-ui)]`.
