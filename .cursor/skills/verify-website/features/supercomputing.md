# Supercomputing programs

Program cards on `/projects/supercomputing`. Each card has a photo and a description.

## Sub-features

- Student Cluster Competition photo.
- Single Board Cluster competition photo.
- Projects photo.

## How to get to it (user POV)

Open `/projects/supercomputing` and scroll to "Our Programs".

## Driving it with the browser

Scroll to `img[alt='Student Cluster Competition']`. Success is all three program images complete, with `currentSrc` using `w=960`, `w=768`, or `w=480`. Failure is a `w` above 4000, which is the original camera size.

## Gotchas

The first `img` on the page is the navbar logo. Scrolling to `img` without an alt lands on the logo, not the program photos.
