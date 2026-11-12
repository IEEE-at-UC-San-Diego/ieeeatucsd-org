# Events

The public events page. The hero photo sits behind the "Events" title.

## Sub-features

- Hero photo.
- Upcoming events list and month calendar.

## How to get to it (user POV)

Open `/events`. The hero is the first screen.

## Driving it with the browser

Wait for `domcontentloaded`. The hero `img` alt is "IEEE at UC San Diego event". Success is `naturalWidth` greater than 0 and `currentSrc` containing `w=1600`, `w=1200`, or `w=768`. Failure is `w=4000`.

The calendar can show "No Upcoming Events" when the feed has none. That is a successful page, not a broken hero.

## Gotchas

The hero image is eager, but the first `/_image` request still waits on sharp. Give it about two seconds before reading `naturalWidth`.
