# Merch store operations runbook

The merch store launches in two independent stages. `merchStoreEnabled` controls member visibility; `merchCheckoutEnabled` controls new purchases. Existing order management, cancellation, rescheduling, and fulfillment remain available when checkout is disabled.

## Before launch

1. Deploy the additive schema and run `migrations:initializePointLedger` in resumable batches until its cursor is complete.
2. In Manage Merch → Points, confirm the point-account reconciliation has zero mismatches. Repository searches must show no direct point-balance writers outside `convex/lib/pointsLedger.ts` and user provisioning defaults.
3. Configure the Project Space display name, address, `America/Los_Angeles` timezone, and member cancellation cutoff.
4. Add products, claimed images, active variants, prices, limits, and initial inventory. Catalog activation must reject products without an image and an active variant.
5. Enable future published event pickups or create Project Space windows. Review generated slots, cutoff times, and capacities.
6. Set `RESEND_API_KEY` and optionally `MERCH_EMAIL_FROM`. Missing email configuration never invalidates an order, but it will move notices through retry/dead-letter handling.
7. Run the dashboard typecheck, tests, Biome check, production build, and Convex code generation. Complete a device pilot covering camera permission allowed/denied, manual entry, repeat scan, cancellation, and rescheduling.

## Staged rollout

1. Keep both flags off while managers configure inventory and pickup choices.
2. Turn on `merchStoreEnabled` only for a read-only catalog preview.
3. Verify mobile and desktop catalog data, Pacific times, member eligibility, and sidebar visibility.
4. Turn on `merchCheckoutEnabled` for purchasing.

## Daily operations

- Review pending, overdue, and action-required orders. Source edits do not rewrite the immutable pickup snapshot.
- Before disabling a booked event, slot, or window, use the impact review and reschedule or cancel every pending order.
- Review notification dead letters and retry only after fixing the provider/configuration issue.
- Use reason-required point and inventory adjustments. Never repair state by editing an account, stock summary, order, or historical ledger row directly.
- Export orders only for authorized operational use; the export includes member identity.

## Reconciliation and incidents

- Points: compare account summaries, ledger totals, and compatibility mirrors in Manage Merch → Points.
- Inventory: compare each variant summary with its append-only movements in Manage Merch → Inventory.
- Orders: verify purchase/refund links, inventory movements, state events, and pickup booked counts with `merchOrders.reconcileForManager` in the Convex dashboard when investigating an incident.
- A mismatch is repaired with a documented compensating entry. Preserve the original rows and capture the actor, reason, request ID, and affected order.
- For suspected QR exposure, manager-cancel a pending order to revoke its code. A code alone cannot fulfill an order; authenticated staff must preview and confirm.
- Uploaded files are accepted only through short-lived manager claims and validated using storage MIME metadata and size. The current Convex storage API does not provide decoded image-byte inspection in a mutation; investigate suspicious files before activating the product.

## Rollback

Turn off `merchCheckoutEnabled` first. Keep `merchStoreEnabled` on if members still need receipts and pickup codes, and keep manager/fulfillment routes available. Do not delete orders, ledger rows, inventory movements, or pickup mappings. Turn off store visibility only after communicating the incident and confirming members still have an alternate way to access scheduled pickup details.
