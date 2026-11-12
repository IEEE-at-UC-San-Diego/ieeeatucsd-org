# Sign in

Sign in lets an officer open the dashboard with Google through Logto. A signed-in officer sees the sidebar and their name.

## Sub-features

- `signin-wall` shows Continue with Google when no session exists.
- `signin-officer` lands on a dashboard page with the officer name in the sidebar.

## How to get to it (user POV)

- Open `http://localhost:3000`. The root redirects toward sign-in.
- Open `http://localhost:3000/signin` and choose Continue with Google.

## Driving it with verify-dashboard

Preconditions:

- Doctor exits 0.
- A real Google officer account is available, or `IEEE_DEV_OFFICER_JSON` points at a session file that stays outside the repo. Do not create users in production Logto.

- **See the wall.** Open `/signin` with a fresh profile and no `ieeeDevOfficer` value. The button name is `Continue with Google`.
- **Enter as an officer.** Sign in with Google, then open `/manage-events`. To drive the wizard script, run `node .cursor/skills/verify-dashboard/drive-invoice-upload.mjs`. The page text includes `New Event Request` and the sidebar shows the officer name.
- **Proof.** `events-list.png` in `VERIFY_EVIDENCE_DIR` shows Manage Events and the officer name. A capture of the Google button alone does not prove an officer session.

## Gotchas

- Completing Google OAuth needs a real Google account. Stopping on the Logto redirect is not a signed-in session.
- The committed dashboard does not read a local session file. If the script stops on Continue with Google, sign in for real. Do not add a login bypass to the app to get past that wall.
- `users:getMe` must return the officer before the wizard step. A session the API rejects sends the page back to sign-in.
