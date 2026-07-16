# 001 — Animate MobileTaskStepper progress with scaleX

- **Status**: DONE
- **Commit**: 24bdb1d
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file, ~5 lines

## Problem

The mobile wizard progress bar animates `width`, which forces layout + paint + composite on every step change. Sibling progress UI in this repo already uses GPU-friendly `scaleX`.

```tsx
/* apps/dashboard/src/components/mobile/MobileTaskStepper.tsx:42-45 — current */
<div
  className="h-full rounded-full bg-ieee-blue transition-[width] duration-200 ease-[var(--ease-out)]"
  style={{ width: `${progress}%` }}
/>
```

AUDIT.md §5: animate `transform` and `opacity` only. Moving/morphing on screen → `ease-in-out` (`cubic-bezier(0.77, 0, 0.175, 1)`), not `ease-out`.

## Target

Match the existing Progress / FundDepositWizard pattern:

```tsx
/* target */
<div
  className="h-full w-full origin-left rounded-full bg-ieee-blue transition-transform duration-200 ease-[var(--ease-in-out)] motion-instant-reduce"
  style={{ transform: `scaleX(${progress / 100})` }}
/>
```

Exact values:

- Property: `transform: scaleX(...)` with `origin-left`
- Duration: `200ms` (same as current / `progress.tsx`)
- Easing: `var(--ease-in-out)` → `cubic-bezier(0.77, 0, 0.175, 1)`
- Reduced motion: class `motion-instant-reduce` (already defined in `styles.css`)

## Repo conventions to follow

- Progress fill exemplar: `apps/dashboard/src/components/ui/progress.tsx:20-24`

```tsx
<ProgressPrimitive.Indicator
  data-slot="progress-indicator"
  className="bg-primary h-full w-full flex-1 origin-left transition-transform duration-200 ease-[var(--ease-in-out)] motion-instant-reduce"
  style={{ transform: `scaleX(${(value || 0) / 100})` }}
/>
```

- Same pattern in `apps/dashboard/src/components/dashboard/fund-deposits/FundDepositWizard.tsx:374-377`.

## Steps

1. In `apps/dashboard/src/components/mobile/MobileTaskStepper.tsx`, replace the progress fill `div` (lines 42–45) with the target markup above. Keep the parent `role="progressbar"` / aria attrs unchanged. Keep `progress` computed as today (`(currentStep / totalSteps) * 100`); pass `progress / 100` into `scaleX`.
2. Do not change step-button classes in this plan (covered by plan 004).

## Boundaries

- Do NOT touch `progress.tsx`, FundDepositWizard progress bar, or other wizards.
- Do NOT change step titles, click handlers, or layout structure outside the fill element.
- Do NOT add dependencies.
- If the fill element no longer uses `width` inline / `transition-[width]`, stop and report instead of inventing a different approach.

## Verification

- **Mechanical**: from `apps/dashboard`, run `bun run typecheck` and `bun run check` — both should pass.
- **Feel check**:
  - Open a multi-step mobile wizard that uses `MobileTaskStepper`. Advance steps and confirm the blue bar grows via scale (no layout jump / reflow of surrounding chrome).
  - In DevTools Animations panel at 10% speed, confirm only `transform` animates (not `width`).
  - Toggle `prefers-reduced-motion: reduce` (Rendering panel) and confirm the bar snaps with essentially no duration (`motion-instant-reduce`).
- **Done when**: fill uses `scaleX` + `origin-left` + `--ease-in-out` + `motion-instant-reduce`; no `transition-[width]` / inline `width` percent on the fill.
