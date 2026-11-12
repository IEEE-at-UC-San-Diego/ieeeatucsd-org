# Home

The public home page. The hero is a Three.js board. The about section is a photo below the hero.

## Sub-features

- Hero headline and the Arduino figure.
- About photo of members at a workbench.

## How to get to it (user POV)

Open `/`. Scroll until the heading "About IEEE at UC San Diego" is on screen.

## Driving it with the browser

Wait for `domcontentloaded`, then scroll to `#about-heading`. The about `img` alt is "IEEE at UC San Diego members working together". Success is `naturalWidth` greater than 0 and `currentSrc` containing `w=960`, `w=768`, or `w=480`. Failure is a `w` of 5472, which is the original file width.

## Gotchas

Do not wait for network idle. The Three.js canvas does not go idle, and headless Chrome can hang while screenshotting that canvas. The about photo is lazy. A screenshot taken before the scroll does not load it.
