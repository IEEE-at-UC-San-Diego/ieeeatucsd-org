---
name: verify-dashboard
description: Drive the IEEE at UCSD officer dashboard (apps/dashboard) in a browser and prove a user-facing flow, including event-request invoice uploads. Use when a dashboard change needs a real click-through, not only a unit test.
---

# Verify the officer dashboard

The dashboard is the TanStack Start app in `apps/dashboard`. Officers use it in a browser at `http://localhost:3000`. Convex is the database at `http://127.0.0.1:3210`. The public website (`pnpm dev:website`, port 4321) is a separate surface. Do not drive it with this skill.

## Launch

From the repo root, with a gitignored `.env` (copy `.env.example`) and `apps/dashboard/.env` symlinked to it:

1. `VITE_CONVEX_URL` must be an absolute URL, normally `http://127.0.0.1:3210`.
2. Start Convex with `pnpm dev:convex` only when `http://127.0.0.1:3210/version` is down. Do not start a second backend if `/version` already answers. Image and Docker notes live in `AGENTS.md`.
3. Set the Convex deployment env `LOGTO_ENDPOINT`, `LOGTO_APP_ID`, and `CONVEX_SESSION_SECRET` to the same values as `.env`. From `apps/dashboard`, deploy with `pnpm exec convex deploy -y` and the self-hosted URL and admin key in the environment. Do not print the admin key.
4. The officer who signs in must already exist, with `signedUp` true and an officer role.
5. Start the dashboard only if doctor reports it down: `pnpm dev:dashboard`. Ready means `http://localhost:3000/api/health` returns 200 and `http://localhost:3000/manage-events` renders either the events page or the sign-in page.

Two dashboards cannot share port 3000. Two Convex backends cannot share port 3210. If doctor already passes, reuse that instance.

## Doctor

```bash
node .cursor/skills/verify-dashboard/doctor.mjs
```

Exit 0 means the dashboard health route and Convex `/version` both respond. Exit 1 means do not drive. Doctor does not start processes and does not print secrets.

## Drive

Browser drives use `drive-invoice-upload.mjs` (puppeteer-core plus system Chrome). Install the driver once if `PUPPETEER_CORE` is unset:

```bash
npm install --prefix /tmp/verify-dashboard-pw puppeteer-core
```

Set `CHROME_PATH` to a Chrome or Chromium binary. When it is unset, the script uses the first of `google-chrome`, `google-chrome-stable`, `chromium`, or `chromium-browser` on `PATH`. Headless Chrome on a container needs `--no-sandbox`, which the script already passes.

Sign in with Continue with Google on `/signin`. The script can also preload a session file:

```bash
IEEE_DEV_OFFICER_JSON=/path/to/session.json \
  VERIFY_EVIDENCE_DIR=/tmp/verify-dashboard-evidence \
  node .cursor/skills/verify-dashboard/drive-invoice-upload.mjs
```

The file stays outside the repo. It is JSON with `logtoId`, `accessToken`, `sessionToken`, and `expiresAt`. The script writes it to `localStorage` under `ieeeDevOfficer` before the first load. The committed dashboard does not read that key. If the page stays on Sign in, stop. Do not add a login bypass to the app, and do not create users in production Logto.

The script opens `/manage-events`, walks the event-request wizard to Funding, and drops `invoice.pdf` with an empty `File.type`. A file input cannot reproduce that case, because the browser assigns `application/pdf`. Success is the text `Invoice file attached` and a storage POST whose body contains `storageId`. Failure is HTTP 400 `Bad header for content-type` and the banner `Failed to upload file. Check your connection and try again.`

The committed test that locks the same path, with no browser and no Convex, is:

```bash
pnpm --dir apps/dashboard exec vitest run src/components/manage-events/wizard/invoicePdfUpload.test.tsx
```

## Evidence

Write proof under `VERIFY_EVIDENCE_DIR` (default `/tmp/verify-dashboard-evidence`). The script saves `events-list.png` before the wizard, `invoice-upload.png` after the drop, and `invoice-upload.json` with the drop's file type, the visible invoice text, the storage status and body, and console lines. Keep the screenshot of the action's result and the JSON of the storage response together. A screenshot with no response body is not proof of the upload.

The unit test's stdout is the proof for the headless path. Mocks are allowed there because the test replaces `fetch` at the storage boundary the browser also hits. The browser drive must hit the real local Convex `/api/storage/upload`.

## Cleanup

```bash
node .cursor/skills/verify-dashboard/cleanup.mjs
```

Cleanup kills only PIDs listed in `VERIFY_PID_FILE` (default `/tmp/verify-dashboard-pids`). Launch writes that file only for processes this run started. A reused dashboard or Convex process is left running. Cleanup never deletes `VERIFY_EVIDENCE_DIR`.

## Helpers

- `node .cursor/skills/verify-dashboard/doctor.mjs` checks the dashboard and Convex.
- `node .cursor/skills/verify-dashboard/drive-invoice-upload.mjs` performs the invoice upload drive.
- `node .cursor/skills/verify-dashboard/cleanup.mjs` stops processes this run recorded.

Keep the map honest with `/maintain-verification-skill` when routes or wizard steps change.
