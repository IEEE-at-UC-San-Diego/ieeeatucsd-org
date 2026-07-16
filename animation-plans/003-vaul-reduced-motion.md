# 003 — Gate Vaul drawer movement under prefers-reduced-motion

- **Status**: DONE
- **Commit**: 24bdb1d
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 file (`styles.css`), ~15 lines

## Problem

Mobile overlays use Vaul (`apps/dashboard/src/components/ui/drawer.tsx` → `ResponsiveOverlay`, more drawer, etc.). Vaul injects its own CSS with **500ms** slide keyframes / transform transitions and **does not** honor `prefers-reduced-motion`. The app’s `.motion-surface` rules only affect tw-animate enter vars on the overlay classes we add — not Vaul’s `[data-vaul-drawer]` panel motion.

Relevant Vaul-injected rules (from `vaul@1.1.2` runtime CSS):

```css
[data-vaul-drawer] {
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  animation-duration: 0.5s;
  animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
}
/* open/close: animation-name slideFromBottom / slideToBottom / … */
```

AUDIT.md §6: movement must drop under reduced motion; keep gentler opacity feedback when useful.

**Note on Sonner:** `sonner@2.0.7` already ships:

```css
@media (prefers-reduced-motion) {
  .sonner-loading-bar,
  [data-sonner-toast],
  [data-sonner-toast] > * {
    transition: none !important;
    animation: none !important;
  }
}
```

Do **not** add a second Sonner override in this plan. Feel-check that it works; only add CSS if verification fails.

## Target

Extend the existing `@media (prefers-reduced-motion: reduce)` block in `apps/dashboard/src/styles.css` (starts ~line 653):

```css
/* add inside the existing reduce block */
[data-vaul-drawer],
[data-vaul-overlay] {
  animation-duration: 1ms !important;
  animation-delay: 0ms !important;
  transition-duration: 1ms !important;
  transition-delay: 0ms !important;
}
```

Keep opacity changes allowed (1ms fade is effectively instant feedback). Do not set `animation: none` on the drawer if that leaves it stuck off-screen — prefer collapsing duration so open/close keyframes still complete to the end state.

Also ensure drawer overlay fade we own stays tokenized (plan 005); this plan only adds the Vaul reduce rules.

## Repo conventions to follow

- Reduced-motion handling already lives in `apps/dashboard/src/styles.css` (`.motion-surface`, `.motion-instant-reduce`, `.motion-press`).
- Exemplar pattern for “collapse duration, keep comprehension”:

```css
/* styles.css:668-671 — current */
.motion-instant-reduce {
  animation-duration: 1ms !important;
  transition-duration: 1ms !important;
}
```

- Do not invent a JS `useReducedMotion` hook unless the CSS gate fails verification.

## Steps

1. Open `apps/dashboard/src/styles.css`.
2. Inside the existing `@media (prefers-reduced-motion: reduce) { ... }` block (after `.motion-surface` / `.motion-instant-reduce` rules is fine), add the `[data-vaul-drawer], [data-vaul-overlay]` duration collapse rules from Target.
3. Do not modify `drawer.tsx` markup in this plan (ease tokens are plan 005).
4. Do not add Sonner CSS unless feel-check proves Sonner’s built-in media query is not applying.

## Boundaries

- Do NOT change Vaul / Sonner package versions.
- Do NOT disable dragging or dismissibility.
- Do NOT set `shouldScaleBackground` or other Drawer root props unless required after a failed feel-check (then STOP and report).
- Do NOT touch dialog/sheet tw-animate classes here.

## Verification

- **Mechanical**: `cd apps/dashboard && bun run check` (CSS-only; typecheck optional).
- **Feel check**:
  - Emulate mobile width, open a `ResponsiveOverlay` / more-drawer (Vaul). Confirm normal slide with reduce **off**.
  - Enable `prefers-reduced-motion: reduce`. Re-open/close: panel should appear/disappear with no perceptible slide (≤1ms). Overlay should not linger in a half-animated state.
  - Trigger a toast (`toast.success(...)` from any page). With reduce on, confirm no 400ms slide/stack motion (Sonner built-in). If toast still slides, then add a matching duration collapse for `[data-sonner-toast]` and re-verify — keep opacity usable.
- **Done when**: under reduced motion, Vaul drawer transform motion is imperceptible; Sonner verified (built-in or added fallback).
