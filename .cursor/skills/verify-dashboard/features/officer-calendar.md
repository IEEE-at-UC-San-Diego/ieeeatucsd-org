# Officer calendar

Officer calendar shows the shared officer calendar and a subscribe action.

## Sub-features

- `calendar-open` shows the Officer Calendar page.
- `calendar-subscribe` shows Subscribe Officer Calendar.

## How to get to it (user POV)

- Choose Officer Calendar in the sidebar.
- Open `http://localhost:3000/officer-calendar`.

## Driving it with verify-dashboard

Preconditions:

- Doctor exits 0.
- The officer session from [Sign in](./sign-in.md) is active.

- **Open the calendar.** Go to `/officer-calendar`. The page title is Officer Calendar.
- **Proof.** A screenshot shows the title and the Subscribe Officer Calendar control. This feature is mapped and not yet driven by `drive-invoice-upload.mjs`.

## Gotchas

- The page can load the shell before Google Calendar events arrive. The title is the ready check, not a particular event name.
- A missing calendar id shows an empty calendar. That is a configuration gap, not an invoice-upload failure.
