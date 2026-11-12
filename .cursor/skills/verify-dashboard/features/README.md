# Dashboard verification map

This directory is the maintained source for verifying the officer dashboard in `apps/dashboard`. Read the index, then use the matching feature file.

## Baseline preconditions

- Dashboard health at `http://localhost:3000/api/health` returns 200.
- Convex at `http://127.0.0.1:3210/version` responds.
- `node .cursor/skills/verify-dashboard/doctor.mjs` exits 0.
- An officer session can open `/manage-events`. Production sign-in is `Continue with Google`. The drive seeds `logto:<appId>:idToken` and `logto:<appId>:accessToken` from `VERIFY_LOGTO_SESSION`, which stays outside the repo.
- Do not drive an instance this run did not start unless doctor shows it is already the local dashboard and local Convex.

## Driving conventions

- Start from `/manage-events` after the officer session is active.
- Prefer accessible names (`New Event Request`, `Upload invoice file`) over coordinates.
- Drop an unlabeled PDF with `DataTransfer`. Do not use a file input for the empty-type case.
- Keep proof files. Cleanup does not delete `VERIFY_EVIDENCE_DIR`.

## Proof and skip reporting

- Save the screen before the action and the screen after it, plus the storage response body.
- Record the feature id `invoice-upload` on the JSON report.
- If sign-in blocks the wizard, report the sign-in wall and stop. Do not call another route verified in its place.

## Features

- [Sign in](./sign-in.md) covers the Google sign-in wall and the local officer bridge.
- [Manage events](./manage-events.md) covers the events list and opening a new event request.
- [Invoice upload](./invoice-upload.md) covers dropping an unlabeled PDF on the funding step.
- [Fund requests](./fund-requests.md) covers opening the fund request list.
- [Officer calendar](./officer-calendar.md) covers opening the officer calendar.
