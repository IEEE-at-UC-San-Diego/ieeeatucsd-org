# Mobile-First, Native-Looking Dashboard Overhaul

## Status

- Decision status: Implementation in progress (A/B/C/D complete; E QA hardening)
- Scope: The complete `apps/dashboard` application, including signed-in member,
  officer, executive, sponsor, authentication, invitation, settings, and legal flows
- Goal: Make mobile a first-class product surface that feels like a native application,
  while preserving the existing desktop experience
- Primary target: iPhone Safari and installed standalone mode, with Android Chrome parity
- Implementation strategy: Fix the shared shell and adaptive primitives first, then migrate
  route families in priority order

### D leftovers closed (ResponsiveOverlay)

- EventDetailModal / CheckInModal
- FundDepositWizard / FundDepositDetail reject
- manage-reimbursements payment/review
- FundRequestFormModal modal mode
- ConstitutionAuditLog detail + VersionHistory restore confirm

### E QA notes

- Tab bar hides for immersive tasks: events detail/check-in, officer calendar create/view,
  resume preview, constitution preview/export, manage-reimbursements detail/payment,
  fund deposits wizard (plus previously: reimbursement, manage-events, fund requests)
- Thumb-reach: migrated overlays use `h-11` primary actions on compact; audit “View details”
  is always visible (no hover-only)
- Overflow: jsdom fixtures in `lib/viewport/overflow.test.ts` for 320/375/390/430

### Intentional desktop-only density (kept on purpose)

These surfaces stay denser on `md+` and are not meant to match mobile list/sheet patterns:

- Manage Events / Manage Users / Manage Sponsors / Resume Database **tables** (semantic
  `<table>` on desktop; `MobileDataList` on compact)
- Executive Analytics multi-chart grid (stacked + inspect on mobile; multi-column on desktop)
- Constitution rich-text toolbar (full formatting row on desktop; progressive disclosure on
  compact)
- Fund request / reimbursement **desktop** review split panes (sectioned stacks on compact)
- Sidebar navigation hierarchy (desktop only; compact uses tab bar + More sheet)
- Event request wizard step rail (Progress + 6-column labels on desktop; `MobileTaskStepper`
  on compact)

## Executive Summary

The app is technically responsive in many places, but it is not yet a mobile product.
The current approach mostly compresses desktop layouts into a narrow viewport:

- Desktop sidebar navigation is placed in a left sheet with the same hierarchy, large empty
  regions, and footer controls.
- Desktop tables survive as horizontally scrollable tables or partially hidden columns.
- Desktop dialogs are frequently centered, fixed-height workspaces rather than native mobile
  screens or bottom sheets.
- Filters and page actions consume too much vertical space and lack progressive disclosure.
- The reimbursement request flow can make the document wider than the viewport. During the
  audit, this shifted the entire page horizontally and the offset persisted when navigating to
  another route.
- Mobile chrome is visually a shrunken desktop header. There is no persistent thumb-reachable
  primary navigation, safe-area treatment, standalone/PWA configuration, or mobile route
  transition model.

The correct destination is not “make every desktop element fit.” It is an adaptive mobile
information architecture: a compact top app bar, persistent bottom navigation for frequent
member tasks, a role-aware More sheet for the full hierarchy, mobile list/detail patterns in
place of wide tables, and full-screen task flows for multi-step work.

## Audit Method

### Live Computer Use review

The running authenticated application was inspected with Chrome device emulation at:

- Responsive mobile viewport: 400 × 749
- iPhone SE preset: 375 × 667
- Desktop baseline for comparison

Live routes and states reviewed:

- `/overview`
- Mobile navigation drawer
- `/events`
- `/reimbursement` list
- New reimbursement request, steps 1 and 2
- `/manage-events` list and Create Event Request wizard
- `/manage-users`
- `/constitution-builder`
- `/settings`

The remaining routes were audited from their route/component code, shared primitives, table
usage, modal usage, fixed dimensions, grid breakpoints, and overflow behavior.

### Important observed defects

1. **Horizontal overflow is a P0 defect.** Reimbursement step 2 rendered with the page visibly
   shifted and content clipped. The horizontal offset remained after navigating to Settings.
2. **Manage Events is still a desktop table.** At 400px only the first columns were visible;
   there was no strong affordance explaining that critical data/actions were off-screen.
3. **Manage Users has a mobile semantic/visual column mismatch.** The table header declares
   `Actions` before `Role`, while body cells render role before actions. On mobile, hidden columns
   make the mismatch visible and confusing. Fix this regardless of the larger redesign.
4. **The reimbursement wizard header collides with its Back action.** The title wraps into the
   navigation region, and the stepper is wider and more decorative than the available width.
5. **The current drawer is a desktop sidebar in a sheet.** It uses 18rem of a 400px viewport,
   retains accordion groups and a footer, and leaves substantial unused vertical space.
6. **Event wizard policy tables clip horizontally.** Dense informational tables are not
   transformed into mobile-readable stacked rows.
7. **The constitution editor technically fits, but its toolbar is dense and has 24px controls.**
   Editing actions need touch-sized controls, progressive disclosure, and keyboard-aware
   positioning.
8. **Settings works visually but behaves like stacked desktop cards.** Save actions are distant
   from the fields they affect, and there is no sticky, keyboard-aware action treatment.

## Product Direction

### Human and context

The primary mobile user is an IEEE UCSD member or officer using the app between classes, at an
event, while uploading a receipt, or while responding to an operational task. They are often
one-handed, time-constrained, and may be on a weak network. Mobile should favor quick checking,
capturing, approving, and continuing later; desktop can retain dense planning and bulk work.

### Domain

- Student organization membership
- Campus events and check-in
- Officer operations and approvals
- Reimbursements and receipt capture
- Project funding
- Team coordination
- Constitution and governance
- Sponsor access and resume review

### Color world

- IEEE blue for identity and active navigation
- UCSD coastal white and cool gray for the canvas
- Dark graphite for primary controls and readable text
- Amber for deadlines and pending operational work
- Green for completed check-ins and approvals
- Red only for destructive or failed states

### Signature

Use an IEEE-blue **signal rail** as the mobile signature: a restrained active-state line/dot that
appears in the bottom tab bar, selected filters, step progress, and current task status. It should
communicate “you are here / this is live” without turning every surface blue.

### Defaults to reject

- Hamburger-only navigation → persistent primary bottom tabs plus a role-aware More sheet
- Horizontally scrolling desktop tables → mobile list rows/cards with drill-in detail
- Centered desktop modals → bottom sheets for short choices and full-screen routes for tasks
- Card around every group → edge-to-edge grouped lists and inset sections where native apps use
  them
- One global “mobile breakpoint” → component-driven compact, medium, and wide behavior

### Intended feel

Calm, direct, and operational: an IEEE tool that feels at home on iPhone, not a website pretending
to be an app. Motion should be physical and restrained. Hierarchy should come from typography,
spacing, and grouped surfaces rather than heavy borders.

## Target Mobile Information Architecture

### 1. Mobile app shell

Implement a dedicated mobile shell in
`apps/dashboard/src/components/dashboard/DashboardLayout.tsx` instead of relying on the desktop
sidebar component to adapt itself.

#### Top app bar

- Height: 48–52px plus `env(safe-area-inset-top)`.
- Sticky, translucent material with a subtle scroll-edge fade rather than a hard border.
- Leading slot: Back for nested/detail/task screens; menu only when there is no better route
  affordance.
- Center/leading-aligned concise route title. Do not repeat the same large title immediately in
  page content unless the content title carries additional hierarchy.
- Trailing slot: one primary contextual action or notifications/avatar; overflow secondary
  actions into a menu.
- Keep every control at least 44 × 44px even when the icon is 18–20px.

#### Bottom tab bar

For member and officer accounts, use four persistent destinations:

1. Overview
2. Events
3. Reimburse
4. More

Requirements:

- Role-aware badges may appear on More for pending approvals/tasks.
- `More` opens a full-height or large detent bottom sheet containing the complete role-based
  navigation hierarchy, settings, AI Assistant, and account actions.
- Active state uses the IEEE-blue signal rail plus icon/label emphasis.
- Respect `env(safe-area-inset-bottom)` and keep content padded above the tab bar.
- Hide the tab bar during full-screen creation/editing tasks when it would compete with task
  controls.
- Preserve the current desktop sidebar at `md`/`lg` widths; do not force bottom tabs onto tablets
  where the side layout is more efficient.

#### Route hierarchy

- Treat list → detail and list → create as real navigable states where practical, with browser
  history and native Back behavior.
- Avoid keeping critical task state only inside modal booleans.
- Preserve drafts when navigating away from multi-step work.

### 2. Navigation More sheet

Replace the current 18rem sidebar sheet in
`apps/dashboard/src/components/ui/sidebar.tsx` for compact viewports.

- Present account identity at the top, not the bottom.
- Group destinations by Member, Officer, Executive, and Sponsor access.
- Use compact section headers and 48–52px rows.
- Close automatically after route selection.
- Show Settings, AI Assistant, and Sign Out as distinct account actions.
- Support a drag handle, swipe-to-dismiss, Escape, focus trapping, and focus return.
- Use Vaul `Drawer` or an equivalent accessible primitive so drag progress is 1:1 and
  interruptible.

## Responsive Foundation

### Breakpoint and container contract

Do not rely exclusively on `useIsMobile()` at 768px. Define and document:

- Compact: 320–479px
- Large phone: 480–767px
- Tablet: 768–1023px
- Desktop: 1024px+

Use CSS/container queries for layout whenever possible. Reserve JavaScript media queries for
behavior that truly changes component semantics.

Update `DashboardPage` and `PageHeader`:

- Compact page gutter: 16px; allow 12px only for dense data rows.
- Major section gap: 24px compact, 32px desktop.
- Mobile page title: 24px/29px with balanced wrapping; desktop may retain 28px.
- Header actions: primary action may become a floating/sticky bottom action or full-width button;
  secondary actions collapse into overflow.
- Provide named slots/variants for `list`, `form`, `editor`, and `immersive` screens.

### Viewport, safe areas, and installability

Update `apps/dashboard/src/routes/__root.tsx` and public assets:

- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`.
- Add `theme-color` and status-bar metadata.
- Add web app manifest with name, short name, icons, `display: standalone`, start URL, background
  color, and theme color.
- Add iOS standalone metadata and confirm the existing Apple touch icon.
- Prefer `100dvh`/`100svh` over `100vh` for mobile task screens.
- Apply safe-area padding to top bars, bottom navigation, sheets, and sticky action bars.
- Decide whether offline read support is in scope. At minimum, installed mode must show a useful
  network error/retry state instead of an indefinite spinner.

### Global overflow contract

Add an explicit regression rule:

- `html`, `body`, and the dashboard root must never exceed viewport width.
- Every flex/grid child that may contain long content needs `min-width: 0`.
- No task step may use `w-fit` plus fixed connectors in a way that widens the document.
- Tables may scroll only inside a named local scroller, never at document level.
- Reset route scroll to `{ top: 0, left: 0 }` and preserve/restores list scroll intentionally.
- Add a development/test assertion: `document.documentElement.scrollWidth <= window.innerWidth` for
  every audited route at 320, 375, 390, and 430px.

### Typography and input behavior

- Keep mobile form inputs at 16px or larger to prevent iOS auto-zoom.
- Use system-ui on mobile if it produces more native text rendering; Geist may remain for brand
  headings and desktop if desired.
- Use `font-optical-sizing: auto`, tighter tracking for large headings, and comfortable body
  leading.
- Use `inputMode`, `autoComplete`, `enterKeyHint`, and correct input types for PID, amounts,
  graduation year, dates, phone/Zelle, and email.
- Avoid placeholder-only labeling.
- Ensure layouts remain usable at 200% text zoom and with iOS Larger Text.

### Touch and pointer behavior

- Minimum target: 44 × 44px; 48px preferred for primary rows and controls.
- Add touch-down feedback immediately (`scale(.97)` or tonal highlight) and commit on release.
- Remove hover-only affordances. Every row action must be discoverable through a visible chevron,
  overflow button, swipe action with fallback, or detail screen.
- Do not overlap expanded hit areas.
- Add `touch-action` intentionally to drawers, carousels, crop/zoom viewers, and editor toolbars.

## Adaptive Component Primitives

Build these shared primitives before migrating pages.

### `MobileAppShell`

Suggested files:

- `components/dashboard/MobileAppBar.tsx`
- `components/dashboard/MobileTabBar.tsx`
- `components/dashboard/MobileMoreDrawer.tsx`
- Update `DashboardLayout.tsx`, `AppSidebar.tsx`, and `config/navigation.ts`

The navigation config should expose mobile priority, badge source, and whether a route hides the
tab bar.

### `ResponsiveOverlay`

Create one adaptive contract on top of existing Radix/Vaul primitives:

- Short confirmation or choice → bottom sheet on compact; dialog/popover on desktop.
- Medium detail → large-detent sheet on compact; dialog on desktop.
- Long form, editor, preview, or wizard → full-screen mobile task surface; dialog on desktop.

Requirements:

- Safe areas and dynamic viewport height.
- Sticky header and footer with only the content region scrolling.
- Keyboard avoidance using `visualViewport` where needed.
- Focus management and accessible title/description.
- Back/close behavior that warns only for dirty, destructive abandonment.
- Opening and closing follow the same path; gesture-driven sheets inherit release velocity.
- Reduced-motion mode replaces translation/spring with a short cross-fade.

Update shared primitives in `components/ui/dialog.tsx`, `drawer.tsx`, `sheet.tsx`, and
`alert-dialog.tsx`, then migrate feature-specific overlays.

### `MobileDataList`

Create a shared list/detail alternative to desktop tables:

- Primary label, one or two important metadata lines, status, optional amount/date, and chevron.
- Entire row is a 52px+ target; nested overflow action remains independently accessible.
- Pull secondary columns into the detail route/sheet.
- Desktop keeps semantic `<table>` markup.
- Mobile pagination uses Previous/Next or “Load more”; do not render isolated page numbers such as
  `1 2 58` without labels.

Use it for events, users, reimbursements, fund requests, sponsors, onboarding, deposits, and
resume records.

### `MobileFilters`

- Search remains inline and full width.
- Show at most the one highest-value filter inline.
- Remaining filters open in a bottom sheet.
- Display active filters as horizontally scrollable chips with a clear-all action.
- Filter sheet has Reset and Apply controls pinned above the safe area.
- Preserve filter state per route when opening a detail and returning.

### `MobileTaskStepper`

- Replace wide numbered steppers with a compact `Step 2 of 4` label, thin progress bar, and current
  step title.
- Keep Back in the app bar or sticky footer, not beside a wrapping page title.
- Pin Next/Submit above the keyboard and safe area.
- Persist draft data locally/server-side where appropriate.

## Route-by-Route Implementation Plan

### Member routes

#### Overview — `routes/_dashboard/overview.tsx`

- Keep the greeting concise; let the app bar provide the route title.
- Convert metrics into a deliberate 2 × 2 compact grid or one hero metric plus two secondary
  metrics. Avoid a single oversized Points card followed by two small cards unless hierarchy is
  intentional.
- Chart: support horizontal touch inspection, fewer x-axis labels, and a summary fallback for
  screen readers. Do not depend on hover tooltips.
- Recent Activity becomes an edge-to-edge timeline/list with 52px+ rows and a “See all” action.
- Reserve bottom-tab clearance and avoid nested scroll areas on mobile.

#### Links — `routes/_dashboard/links.tsx`

- Present frequent links as large native rows with leading icon, title, optional domain, and
  external-link affordance.
- Keep management/edit controls in a contextual sheet for authorized roles.
- Ensure copied/opened feedback is immediate and does not rely on hover.

#### Events — `routes/_dashboard/events.tsx` and `components/events/*`

- Make search full width. Put Add to Calendar in the app-bar overflow or a compact primary action.
- Use sticky Upcoming/Past segmented control below the app bar.
- Event cards should prioritize name, date/time, location, and check-in state; demote policy text.
- Event detail becomes a large-detent sheet or route, with check-in action pinned to the bottom.
- Check-in must handle camera/code keyboard permissions gracefully and expose loading, success,
  already-checked-in, closed, and offline states.
- Calendar export options belong in a bottom action sheet.

#### Reimbursement — `routes/_dashboard/reimbursement.tsx` and
`components/reimbursement/*`

P0 fixes:

- Eliminate all document-level horizontal overflow in the request stepper and detail workspace.
- Replace the numbered `w-fit` stepper/connectors with `MobileTaskStepper`.
- Move the request title/back action into a real mobile task app bar.

List:

- Keep the total as the primary summary; make remaining statuses compact horizontally scrollable
  summary chips or a balanced 2 × 2 grid.
- Reimbursement rows must not truncate the identifying title to an ambiguous fragment. Allow two
  lines and prioritize title, amount, and status.
- Business purpose moves to detail, not the compact list row.

Create flow:

- Full-screen route/surface with one clear task per screen.
- Sticky safe-area footer with Back and Next; Next is the primary full-width action.
- Upload step prioritizes camera capture, Photo Library, and Files.
- Receipt viewer uses a full-screen preview with pinch zoom, pan, and a visible Done action.
- Handle HEIC conversion/loading explicitly and show per-file progress/retry.
- Preserve entered data if the keyboard closes, the app backgrounds, or a route is accidentally
  left.
- Mileage/address inputs use mobile autocomplete, correct keyboard types, and vertically stacked
  stops.

Detail:

- Collapse the desktop 12-column split view into sections: Summary, Expenses, Receipts, Payment,
  Timeline.
- Receipt preview opens full-screen instead of consuming half the viewport below the details.

#### Leaderboard — `routes/_dashboard/leaderboard.tsx`

- Show the current user’s position as a sticky/featured row.
- Use ranked list rows instead of a table.
- Keep season/time filters in a compact segmented control or filter sheet.
- Use tabular numerals and make rank, name, and points the only always-visible values.

### General Officer routes

#### Manage Events — `routes/_dashboard/manage-events.tsx`,
`components/manage-events/*`

- Replace `EventsDataTable` with `MobileDataList` below 768px. Do not ask mobile users to pan a
  six-column table.
- Consolidate Quick Draft, settings, and New Event Request: one primary Create button opens a
  bottom action sheet with New Request and Quick Draft; settings stays in overflow.
- Events List/Event Planning becomes a sticky segmented control.
- Search stays inline; team/status filters move into `MobileFilters`.
- Calendar mobile view defaults to agenda/day mode. Month grid is secondary and must support
  touch without tiny cells.
- Event detail/edit/file manager overlays become large-detent or full-screen adaptive surfaces.

Event request wizard:

- Retain the existing full-screen mobile intent, but add safe-area and keyboard handling.
- Convert deadline tables in `wizard/DisclaimerSection.tsx` to stacked labeled rows on compact
  screens.
- Footer must keep the current step’s primary action visible. Policy acceptance should scroll into
  view above it and not compete with footer buttons.
- Collapse Cancel into app-bar Close; preserve a dirty-state confirmation.
- Review every date/time, upload, invoice, checkbox, and select for 44px targets.

#### Officer Calendar — `routes/_dashboard/officer-calendar.tsx`

- Mobile default is agenda view with day chips, not a compressed desktop calendar.
- Event creation/editing uses full-screen task surfaces.
- Use a floating/sticky Add button that clears the bottom tab bar.
- Provide today jump and explicit date navigation with large targets.

#### Fund Requests — `routes/_dashboard/fund-requests.tsx`,
`components/dashboard/fund-requests/*`, `components/fund-requests/*`

- Use stacked request rows and a compact budget summary.
- The existing wide desktop detail/form layouts become sectioned mobile screens.
- Convert budget history tables to timeline/list rows.
- Fund request creation becomes a full-screen step flow with sticky actions.
- Budget tracking actions and logs must not depend on hover; preserve the user’s in-progress
  changes.

#### Slack Access — `routes/_dashboard/slack-access.tsx`,
`components/dashboard/slack-access/*`

- Keep the primary account/access state at the top.
- Email/message inspection becomes a full-screen reader with readable line length and safe HTML
  overflow.
- Password fields use reveal controls with 44px targets and platform password-manager attributes.
- Long email content must wrap safely; no document-level horizontal scrolling.

### Executive routes

#### Manage Reimbursements — `routes/_dashboard/manage-reimbursements.tsx`

- Replace approval table with a queue-style mobile list: submitter/title, amount, department,
  age, and status.
- Detail opens as a navigable review screen with Summary, Receipt, Timeline, and Payment sections.
- Pin approve/decline/pay actions above the safe area. Destructive or irreversible actions require
  confirmation at the final step.
- Payment proof upload should offer camera/photo/files and show upload progress.
- Do not show a desktop split receipt viewer on compact screens.

#### Manage Fund Requests — `routes/_dashboard/manage-fund-requests.tsx`

- Use the same queue/review pattern as reimbursements.
- Keep budget impact and requested amount visible before the action bar.
- Move dense logs/tables into chronological mobile rows.

#### Manage Users — `routes/_dashboard/manage-users.tsx`,
`components/dashboard/manage-users/*`

P0 independent fix:

- Correct the table header/body order in `UserTable.tsx`; current header order is User, Actions,
  Email, Role while body order is User, Email, Role, …, Actions.

Mobile redesign:

- Replace the table with user rows: avatar, name, PID/email, role, chevron/overflow.
- Search is inline. Role/status/team filters move to a filter sheet with active chips.
- Promote member and Add user collapse into one Add action sheet.
- User detail/edit becomes a full-screen surface grouped into Identity, Membership, Officer Role,
  Permissions, and Account Status.
- Do not show sensitive identifiers more prominently than needed.

#### Manage Sponsors — `routes/_dashboard/manage-sponsors.tsx`,
`components/dashboard/manage-sponsors/*`

- Convert sponsor table to rows/cards with organization, tier, status, contact, and renewal state.
- Stats collapse into a 2 × 2 compact summary.
- Sponsor create/edit becomes a full-screen form with sticky Save.

#### Onboarding — `routes/_dashboard/onboarding.tsx`

- The four desktop tabs become a horizontally scrollable segmented control or mobile subroute
  picker. Never compress all labels into tiny tabs.
- Invitation and Direct Onboarding forms become sectioned, single-column forms with sticky submit.
- Pending invitations and rejections become lists, not tables.
- Long template editors should open full-screen with preview and keyboard-aware controls.
- Current `p-6` route wrapper should use the shared `DashboardPage` mobile gutters.

#### Constitution Builder — `routes/_dashboard/constitution-builder.tsx`,
`components/constitution-builder/*`

- Keep Search and Preview in the app bar or a compact toolbar.
- Editor/Versions/Audit becomes a segmented control with 44px targets.
- Formatting controls become a horizontally scrollable toolbar or More-format sheet; replace 24px
  targets in `ConstitutionSidebar.tsx` with at least 44px coarse-pointer targets.
- Make the formatting toolbar sticky immediately above the software keyboard using
  `visualViewport` offsets.
- Section navigation opens as a searchable sheet; selecting a section scrolls/focuses it and
  closes the sheet.
- Save status remains visible but subtle. Use explicit error/retry state when autosave fails.
- Preview is a full-screen reader; PDF/export actions live in an overflow sheet.

#### Executive Analytics — `routes/_dashboard/executive-analytics.tsx`

- Prioritize one insight per viewport rather than shrinking a desktop dashboard.
- Charts need touch inspection, reduced axis density, accessible summaries, and no hover-only
  legends.
- Filters move into a sheet; active date range remains visible.
- Avoid nested scroll regions around charts.

### Sponsor routes

#### Resume Database — `components/dashboard/sponsors/ResumeDatabaseContent.tsx`

- Replace the six-column table with candidate rows/cards.
- Search remains inline; major, graduation year, and role filters move to a sheet.
- Resume preview becomes a full-screen document viewer with explicit Done, Download, and next/
  previous candidate controls.
- Avoid fixed `72vh` preview behavior on mobile; use dynamic viewport and safe areas.
- Multi-select/bulk actions should enter an explicit selection mode rather than using tiny
  checkboxes in every default row.

#### Sponsor Information — `routes/_dashboard/sponsors/information.tsx`

- Convert dense tables into grouped account/benefit sections.
- Make key sponsor contacts and resources one-tap actions.
- Ensure external links and downloadable resources have clear labels and feedback.

### Account and public routes

#### Settings — `routes/_dashboard/settings.tsx`

- Use grouped native-style sections rather than one card for every region.
- Keep each Save action adjacent to its section and sticky only while that section is dirty.
- Use mobile keyboard types and autocomplete tokens for profile fields.
- Resume replace action uses a bottom action sheet for Camera/Photo Library/Files when relevant.
- Destructive Remove remains a confirmed action.
- Ensure AI toggle label and description stay tappable as one 44px+ row.

#### Get Started — `routes/_dashboard/get-started.tsx`

- Convert onboarding/checklist content into one clear next action per screen.
- Keep progress persistent and allow resuming.
- Avoid desktop multi-column callouts on compact screens.

#### Sign in and callback — `routes/signin.tsx`, `routes/callback.tsx`

- Respect safe areas and keyboard height.
- Primary sign-in target is 48px high and full width.
- Standalone mode must return cleanly from OAuth without trapping the user in an external browser
  context where avoidable.
- Loading and error states must provide a retry/back path.

#### Invitation acceptance — `routes/accept-invitation.$inviteId.tsx`

- Reduce 32px card padding on compact screens and avoid redundant full-screen centering when the
  keyboard is open.
- Stack the existing two-column fields at compact widths.
- Keep acceptance action sticky and expose validation inline.

#### Privacy, terms, and 404

- Use 16px mobile gutters, readable line length, safe areas, and a compact sticky back/header.
- 404 should use the same mobile shell or a clear full-width return action.

## Motion and Material Specification

- Top and bottom chrome may use translucent material: approximately 0.78–0.9 background opacity,
  16–24px blur, and a subtle bright edge. Provide solid fallback for reduced transparency.
- Bottom sheets track the finger 1:1, respect the grab offset, rubber-band past bounds, and settle
  with a slight momentum-driven spring only after a drag/flick.
- Default non-gesture surfaces use a critically damped response around 0.3–0.4s with no bounce.
- Press feedback: 100–140ms, scale no lower than 0.97.
- Navigation/detail transitions: 180–260ms and interruptible. Enter and exit use the same spatial
  path.
- Animate only transforms and opacity; never `transition: all`.
- `prefers-reduced-motion`: remove slides, parallax, and overshoot; retain short cross-fades.
- `prefers-reduced-transparency`: solidify app bars/sheets and remove blur.
- `prefers-contrast: more`: strengthen boundaries and text without changing layout.

## Accessibility Requirements

- WCAG 2.2 AA minimum.
- Every interactive control has a programmatic name and visible focus state.
- All target sizes are 44 × 44px minimum on coarse pointers.
- Bottom navigation exposes current page with `aria-current="page"`.
- Sheets/dialogs trap focus, announce their title, and restore focus to the opener.
- Tables retained on desktop keep correct semantic header/cell relationships.
- Mobile list replacements expose the same data through meaningful text order.
- Status never relies on color alone.
- Charts provide a textual summary/table alternative.
- Toasts are not the only place an error or completion is communicated.
- Test VoiceOver rotor order, dynamic type/text zoom, Switch Control/keyboard, reduced motion, and
  high contrast.

## Performance and Reliability

- Mobile route shells should become interactive quickly even while data is loading.
- Use route-level skeletons matching the final mobile layout; avoid full-page generic spinners for
  normal navigation.
- Lazy-load heavy editors, PDF/receipt viewers, charts, and admin-only dialogs.
- Do not mount every desktop table and mobile list simultaneously with expensive data work; share
  prepared data and render only the active presentation when needed.
- Virtualize or incrementally load user/resume lists containing hundreds of rows.
- Preserve current prefetch-on-intent behavior for touchstart, but do not prefetch every More-sheet
  destination on open.
- Handle offline, upload interruption, token refresh, and background/resume without losing task
  state.

## Implementation Phases

### Phase 0 — Regressions and instrumentation

- Fix reimbursement/document horizontal overflow.
- Fix Manage Users header/body column ordering.
- Add automated viewport overflow assertion.
- Capture baseline screenshots at 320, 375, 390, 430, 768, and desktop widths.
- Add route-level mobile smoke coverage for every navigation destination.

Exit criteria: no document-level horizontal scrolling on any route; current defects have regression
tests.

### Phase 1 — Shell and mobile primitives

- Build mobile app bar, bottom tab bar, More drawer, safe-area tokens, and route metadata.
- Add manifest/standalone metadata.
- Build ResponsiveOverlay, MobileDataList, MobileFilters, and MobileTaskStepper.
- Upgrade Dialog/Sheet/Drawer motion, focus, keyboard, and reduced-motion behavior.
- Update `DashboardPage`/`PageHeader` contracts.

Exit criteria: all routes render inside the new shell; primary navigation is reachable one-handed;
shared primitives have stories/tests or dedicated fixture routes.

### Phase 2 — Highest-frequency member flows

- Overview
- Events and event detail/check-in
- Reimbursement list, create, detail, receipt capture/viewer
- Settings

Exit criteria: a member can complete all common mobile tasks without horizontal panning, clipped
content, or a desktop modal.

### Phase 3 — Officer operational flows

- Manage Events and event wizard
- Officer Calendar
- Fund Requests
- Slack Access

Exit criteria: an officer can create/edit an event and fund request entirely on a phone, including
uploads and keyboard use.

### Phase 4 — Executive and sponsor tools

- Manage Reimbursements
- Manage Fund Requests
- Manage Users
- Manage Sponsors
- Onboarding
- Constitution Builder
- Executive Analytics
- Resume Database and Sponsor Information

Exit criteria: all data-dense routes use list/detail or explicitly mobile-adapted presentation; all
review/approval actions remain visible and safe.

### Phase 5 — Public flows, polish, and standalone QA

- Sign-in/callback, invitations, Get Started, legal, and 404
- Motion/material pass
- Offline/network failure states
- Installed PWA/standalone and OAuth return validation
- Accessibility and cross-browser certification

Exit criteria: mobile production-readiness checklist passes and no desktop regression is detected.

## Verification Matrix

### Viewports

- 320 × 568 compact minimum
- 375 × 667 iPhone SE
- 390 × 844 current standard iPhone
- 430 × 932 large iPhone
- Android narrow and large presets
- 768px tablet portrait and landscape
- Desktop widths already supported

### Browsers/modes

- iOS Safari
- iOS installed standalone mode
- Android Chrome
- Android installed PWA
- macOS Chrome responsive emulation for rapid regression

### Per-route checks

- No document horizontal overflow.
- App bar/tab bar do not cover content.
- Safe areas work in portrait and landscape.
- Software keyboard does not cover focused input or primary action.
- Back returns to prior list and preserves scroll/filter state.
- Loading, empty, error, success, disabled, and offline states are usable.
- 44px targets and no overlapping hit regions.
- 200% text zoom does not clip or obscure actions.
- VoiceOver reading/focus order matches visual order.
- Reduced motion/transparency/contrast preferences are respected.
- Uploads can be retried after interruption.

### Feature-specific checks

- Reimbursement: camera/photo/files, HEIC, multiple receipts, mileage, draft resume, review/submit.
- Events: search, Upcoming/Past, event detail, check-in, calendar export, request wizard uploads.
- Tables/lists: sorting/filtering/pagination parity between desktop and mobile presentations.
- Constitution: typing with keyboard open, formatting, section navigation, save failure/retry,
  preview/export.
- Admin approvals: approve/decline/pay confirmations and focus return.
- OAuth: browser and standalone sign-in return path.

## Suggested File Ownership

### Shared shell and system

- `src/components/dashboard/DashboardLayout.tsx`
- `src/components/dashboard/AppSidebar.tsx`
- `src/components/dashboard/DashboardPage.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/config/navigation.ts`
- `src/hooks/use-mobile.ts`
- `src/routes/__root.tsx`
- `src/styles.css`

### Data-list migrations

- `src/components/manage-events/table/EventsDataTable.tsx`
- `src/components/dashboard/manage-users/UserTable.tsx`
- `src/components/dashboard/manage-sponsors/SponsorTable.tsx`
- `src/components/dashboard/sponsors/ResumeDatabaseContent.tsx`
- `src/components/dashboard/fund-deposits/FundDepositList.tsx`
- `src/routes/_dashboard/manage-reimbursements.tsx`
- `src/routes/_dashboard/manage-fund-requests.tsx`
- `src/routes/_dashboard/onboarding.tsx`

### Task/overlay migrations

- `src/routes/_dashboard/reimbursement.tsx`
- `src/components/manage-events/modals/*`
- `src/components/manage-events/wizard/*`
- `src/components/dashboard/fund-requests/*`
- `src/components/fund-requests/*`
- `src/components/dashboard/manage-users/*Modal.tsx`
- `src/components/dashboard/manage-sponsors/SponsorModal.tsx`
- `src/components/constitution-builder/*`
- `src/components/events/*Modal.tsx`
- `src/components/dashboard/slack-access/EmailModal.tsx`

## Definition of Done

The mobile overhaul is complete only when:

- Mobile uses a dedicated app shell with safe-area-aware top and bottom chrome.
- Every primary member task is reachable in one tap from the bottom bar or two taps through More.
- No route produces document-level horizontal scrolling at 320px or wider.
- All wide tables have a designed mobile alternative.
- All long forms/editors/wizards use full-screen mobile task surfaces; short choices use sheets.
- The software keyboard never obscures the active field or primary action.
- All coarse-pointer targets meet 44 × 44px.
- Navigation, overlays, and gesture motion are interruptible and respect reduced motion.
- The app is installable and visually correct in standalone mode.
- Mobile and desktop both pass route-level visual regression, accessibility, and core workflow
  tests.
- The resulting interface feels intentionally native on a phone, not merely responsive.

