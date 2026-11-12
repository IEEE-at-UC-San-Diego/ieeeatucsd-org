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
- Launch has written `VERIFY_LOGTO_SESSION`, or a real Google login has produced the same file. Do not create users in production Logto.

- **See the wall.** Open `/signin` in a fresh profile with empty Logto storage. The button name is `Continue with Google`.
- **Enter as an officer.** Run `node .cursor/skills/verify-dashboard/drive-invoice-upload.mjs`. It writes `logto:<appId>:idToken` and `logto:<appId>:accessToken` before the first document, then opens `/manage-events`. The page text includes `New Event Request` and the sidebar shows the officer name.
- **Proof.** `events-list.png` in `VERIFY_EVIDENCE_DIR` shows Manage Events and the officer name. A capture of the Google button alone does not prove an officer session.

## Gotchas

- Completing Google OAuth needs a real Google account. Stopping on the Logto redirect is not a signed-in session.
- The id token only marks the browser client signed in. The server still calls `LOGTO_ENDPOINT/oidc/me` with the access token. A token that endpoint rejects never opens the wizard.
- `users:getMe` must return the officer before the wizard step. A session the API rejects sends the page back to sign-in.
