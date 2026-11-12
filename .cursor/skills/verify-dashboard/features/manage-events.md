# Manage events

Manage events lists event requests and opens the wizard that creates one.

## Sub-features

- `events-list` shows the events list for an officer.
- `events-new` opens Create Event Request on the disclaimer step.

## How to get to it (user POV)

- Choose Manage Events in the sidebar.
- Open `http://localhost:3000/manage-events`.
- Choose the `New Event Request` button.

## Driving it with verify-dashboard

Preconditions:

- Doctor exits 0.
- The officer session from [Sign in](./sign-in.md) is active. A member without officer access cannot open this page.

- **Open the list.** Go to `/manage-events`. The heading reads Manage Events and a button named `New Event Request` is visible.
- **Open the wizard.** Choose `New Event Request`. The dialog title is Create Event Request and the body includes Before You Begin.
- **Proof.** `events-list.png` shows the heading and the button. The next feature, invoice upload, continues from this dialog.

## Gotchas

- The root path redirects to sign-in. Start at `/manage-events` after the session exists.
- Open the app at `http://localhost:3000`. A request to `127.0.0.1` can miss the dev server.
- Two New Event Request buttons can exist (header and empty state). Clicking either opens the same wizard.
