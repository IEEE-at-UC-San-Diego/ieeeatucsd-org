# Dashboard animation plans

Audit stamp: commit `24bdb1d`. Plans are self-contained — execute with any agent via `improve-animations execute <plan>` or by handing the markdown file to an implementer.

Source audit: full-dashboard pass (Geist tokens already present; CSS/`tw-animate-css`/Vaul/Sonner; unused `framer-motion`).

## Plans

| # | File | Title | Severity | Status |
|---|---|---|---|---|
| 001 | [001-mobile-task-stepper-scaleX.md](./001-mobile-task-stepper-scaleX.md) | Animate MobileTaskStepper progress with `scaleX` | HIGH | DONE |
| 002 | [002-wizard-step-drop-keyframe-remount.md](./002-wizard-step-drop-keyframe-remount.md) | Drop wizard step remount keyframe entrances | HIGH | DONE |
| 003 | [003-vaul-reduced-motion.md](./003-vaul-reduced-motion.md) | Gate Vaul drawer movement under reduced motion | HIGH | DONE |
| 004 | [004-press-scale-reduced-motion.md](./004-press-scale-reduced-motion.md) | Honor reduced-motion for ad-hoc `active:scale` | HIGH | DONE |
| 005 | [005-drawer-overlay-easing-tokens.md](./005-drawer-overlay-easing-tokens.md) | Tokenize drawer overlay entrance easing | MEDIUM | DONE |

## Recommended execution order

1. **001** — isolated, high leverage, no dependencies.
2. **002** — isolated (wizards only); can run parallel with 001.
3. **003** then **005** — both touch the drawer motion surface; run 003 first (a11y), then 005 (overlay tokens). 005 only edits `drawer.tsx`; 003 only edits `styles.css` — low conflict risk, but verify together.
4. **004** — edits `styles.css` reduce block + many call sites; run after **003** so the reduce block is merged once without fighting.

## Dependencies

```
001  (none)
002  (none)
003  → styles.css reduce block
004  → styles.css reduce block (merge after 003)
005  → drawer.tsx only (pairs with 003 for feel-check)
```

No plan requires Framer Motion. Do not add dependencies unless a plan says so (none do).

## Remaining audit findings (not planned yet)

Ask to plan these if you want a second wave: wizard purpose cleanup is largely covered by 002; still open from the table — overlay family cohesion (#9), token consolidation (#10), keyboard sheet skip (#11), asymmetric press (#12), skeleton pulse (#13), switch easing (#14), sidebar/tabs press feedback (#8), MobileDataList transform transition (partially absorbed if 004 applies `.motion-press`).
