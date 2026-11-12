---
name: verify-website
description: Drive the IEEE at UCSD public website (apps/website) in a browser or with curl and prove a page render, including photo bytes. Use when a website change needs a real request, not only a unit test.
---

# Verify the public website

The public site is the Astro app in `apps/website`. Visitors use it at `http://127.0.0.1:4321`. The officer dashboard is a different app on port 3000. Do not drive the dashboard with this skill.

## Launch

From the repo root, for a production-shaped check:

```bash
pnpm --filter @ieeeatucsd/website run build
PORT=4321 HOST=127.0.0.1 NODE_ENV=production node apps/website/dist/server/entry.mjs
```

Ready means `http://127.0.0.1:4321/api/health` returns 200. Record the node pid yourself. Launch refuses nothing if the port is taken, so check the port first and do not start a second server on 4321.

Dev mode is `pnpm dev:website`. It is the same port. Do not run dev and the production server together.

Local images render through `/_image`. The first request for a size runs sharp and can take about a second. Later requests for that same URL return the same bytes faster. The files under `dist/client/_astro` are the source assets. The bytes a browser downloads are the `/_image` response, not those source files.

## Doctor

```bash
curl -sf -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4321/api/health
```

Exit 0 and code 200 means the server answers. This check does not start a process.

## Drive

Headless Chrome is `/usr/local/bin/google-chrome`. Install the driver once:

```bash
npm install --prefix /tmp/verify-website-pw puppeteer-core
```

Open a page with `domcontentloaded`. Do not wait for network idle. The home page runs a Three.js canvas that keeps the network busy, and Chrome's screenshot mode can hang on that canvas. Scroll the target into view, wait about two seconds so lazy images request `/_image`, then screenshot the viewport.

A photo is loaded when `img.currentSrc` contains `/_image` and `img.naturalWidth` is greater than 0. The `w` query value is the size the page asked for.

```bash
curl -s http://127.0.0.1:4321/ | head
```

## Evidence

Save screenshots next to the JSON or curl output that records `currentSrc` and the response byte count. A screenshot alone does not prove the photo was resized. `curl -s -o /tmp/photo.webp -w "%{size_download}"` on the `/_image` URL is the byte count.

## Cleanup

Stop the node pid you started. Do not kill every node process. Leave the screenshots and curl output in place.

## Helpers

There is no committed launcher. The commands above are the helpers.
