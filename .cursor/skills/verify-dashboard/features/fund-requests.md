# Fund requests

Fund requests lists an officer's funding requests and opens a form for a new one.

## Sub-features

- `funds-list` shows the Fund Requests page.
- `funds-new` opens the New Fund Request form.

## How to get to it (user POV)

- Choose Fund Requests in the sidebar.
- Open `http://localhost:3000/fund-requests`.

## Driving it with verify-dashboard

Preconditions:

- Doctor exits 0.
- The officer session from [Sign in](./sign-in.md) is active.

- **Open the list.** Go to `/fund-requests`. The page title is Fund Requests.
- **Open a new request.** Choose the control that starts a request. The heading reads New Fund Request.
- **Proof.** A screenshot of `/fund-requests` shows the title. This feature is mapped and not yet driven by `drive-invoice-upload.mjs`. A run that only uploaded an invoice has not verified fund requests.

## Gotchas

- Fund deposit receipt uploads are a different form. A checksum check on their download URL is unrelated to the event-request invoice upload.
- Do not treat a passing invoice upload as proof that a fund request receipt uploads.
