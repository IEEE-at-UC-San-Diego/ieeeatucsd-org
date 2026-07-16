# 002 — Drop wizard step remount keyframe entrances

- **Status**: DONE
- **Commit**: 24bdb1d
- **Severity**: HIGH
- **Category**: Interruptibility (+ Purpose & frequency)
- **Estimated scope**: 2 files, ~40 lines (incl. removing unused `direction` state)

## Problem

Both deposit and event-request wizards remount step content with a `key` that includes `direction`, then run `animate-in` / slide keyframes. Rapid Back/Next restarts the animation from zero (keyframes cannot retarget). In a crisp dashboard this motion is also decorative on a frequently hit path.

```tsx
/* apps/dashboard/src/components/dashboard/fund-deposits/FundDepositWizard.tsx:381-389 — current (step 1; same at 556-564 and 621-629) */
{step === 1 && (
  <div
    key={`${step}-${direction}`}
    className={cn(
      "space-y-4 animate-in fade-in duration-200 ease-[var(--ease-out)] motion-surface motion-instant-reduce",
      direction === "forward"
        ? "slide-in-from-right-4"
        : "slide-in-from-left-4",
    )}
  >
```

```tsx
/* apps/dashboard/src/components/manage-events/modals/EventRequestWizardModal.tsx:495-500 — current */
<div
  key={`${currentStep}-${direction}`}
  className="min-h-[300px] animate-in fade-in duration-150 ease-[var(--ease-out)] motion-instant-reduce"
>
  {renderStepContent()}
</div>
```

`direction` exists only to drive these classes (`useState` + `setDirection` on next/back/reset). AUDIT.md §4: rapidly-triggered reversible UI must use transitions/springs, not keyframes that restart. AUDIT.md §1: decorative motion on repeated step nav should be removed.

## Target

Instant step swaps — no entrance animation, no direction-keyed remount.

```tsx
/* FundDepositWizard — target for each step block */
{step === 1 && (
  <div className="space-y-4">
    {/* …unchanged children… */}
  </div>
)}
```

```tsx
/* EventRequestWizardModal — target */
<div className="min-h-[300px]">
  {renderStepContent()}
</div>
```

Also remove the now-dead `direction` state and all `setDirection(...)` calls in both files.

Leave conditional field reveals at FundDepositWizard `:497` and `:531` alone (out of scope). Leave `.success-reveal` alone.

## Repo conventions to follow

- Crisp dashboard: prefer deleting decorative motion over inventing a new transition system.
- Progress bars in the same wizards already use interruptible CSS transitions (`transition-transform`) — that pattern stays; step content should not animate at all.
- Motion tokens live in `apps/dashboard/src/styles.css` (`--ease-geist`, `--duration-*`); do not add new tokens for this plan.

## Steps

1. **`FundDepositWizard.tsx`**
   - Remove `const [direction, setDirection] = useState<"forward" | "back">("forward");` (near line 54).
   - Remove every `setDirection("forward")` / `setDirection("back")` call (reset, next, back handlers — currently ~203–254).
   - For step 1, 2, and 3 wrappers: delete `key={...}`, delete `cn(...)` slide/fade classes; keep a plain `className="space-y-4"` wrapper (or equivalent static classes already needed for layout). Drop unused `cn` import only if it becomes unused in the file.
2. **`EventRequestWizardModal.tsx`**
   - Remove `direction` state (near line 148) and all `setDirection` calls (reset / next / back / open effects — currently ~165–220).
   - Replace the step content wrapper with `<div className="min-h-[300px]">` — no `key`, no `animate-in` / `fade-in` / `duration-*` / `ease-*` / `motion-instant-reduce`.
3. Confirm neither file still references `direction` / `setDirection`.

## Boundaries

- Do NOT change form validation, step indices, submit/success UI, or `.success-reveal`.
- Do NOT animate conditional fields (`depositMethod === "other"`, `isIeeeDeposit`) in this plan.
- Do NOT convert overlays (dialog/sheet) off `tw-animate-css`.
- Do NOT add Framer Motion or new dependencies.
- If `direction` is used for something other than animation when you open the file, STOP and report.

## Verification

- **Mechanical**: `cd apps/dashboard && bun run typecheck && bun run check`.
- **Feel check**:
  - Fund deposits wizard: spam Next/Back — content swaps instantly; no slide/fade, no flash restart.
  - Event request wizard: same.
  - Animations panel at 10%: no enter keyframes on step change.
  - With `prefers-reduced-motion: reduce`, behavior identical (already instant).
- **Done when**: no `animate-in` / `slide-in-from-*` / direction-keyed remount on wizard steps; `direction` state fully removed from both files.
