# Event check-in

Members check in to a live published event, then open the A.S. attendance form.

## Sub-features

- `event-check-in` submits the event code and shows the attendance form link only after success.

## How to get to it (user POV)

- Choose Events in the sidebar.
- Open `http://localhost:3000/events`.
- Choose Check In on an event marked Live.

## Driving it with verify-dashboard

Preconditions:

- Doctor exits 0.
- The member session from [Sign in](./sign-in.md) is active. The seeded user `logtoId` is `officer-local`.
- The event is published, its window includes now, and the member is not already checked in. Upcoming events hide Check In.

- **Before.** Choose Check In. The dialog asks for the event code and has no link named `A.S. attendance form`.
- **After.** Type the event code and choose Continue. The dialog title becomes Checked in, and the link named `A.S. attendance form` has `target="_blank"`.
- **Form.** Open that link. Class year, Member, and the food vendor are filled when those values exist. The event control is a weekly multiple-choice list. It selects only when this week's options include `Institute of Electrical and Electronics Engineers (IEEE) - {event name}`.
- **Proof.** Save the dialog before submit, the dialog after success, the generated href, and the opened form.

## Gotchas

- `pnpm dev:convex` pulls `ghcr.io/get-convex/convex-backend`, which anonymous GHCR denies. The public images are `ghcr.io/convex/convex-backend` and `ghcr.io/convex/convex-dashboard`. Override those image names to start the local backend.
- On Docker 29, set storage-driver `fuse-overlayfs`, `features.containerd-snapshotter` false, and `iptables-legacy`. Install `fuse-overlayfs` with a noninteractive `--force-confold` if the package prompt blocks.
- `VITE_CONVEX_URL` must be a non-empty absolute URL. The dashboard reads `apps/dashboard/.env`. A symlink to the root `.env` works.
- Quote `.env` values that contain `|`. An unquoted `source` splits the Convex admin key.
- Check-in reads `foodVendor` from `listPublished`. An empty vendor is omitted from that public view and from the form URL.
- The live form has no name question. Do not add a guessed entry id for a name.
