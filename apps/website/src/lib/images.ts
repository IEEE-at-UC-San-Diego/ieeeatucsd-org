import type { ImageMetadata } from "astro";

// Eagerly map every asset under src/images so JSON/data-driven paths
// (e.g. "/src/images/project.webp") can be resolved to ImageMetadata
// and rendered through Astro's <Image /> component.
// Only the paths JSON data passes to resolveImage. A wider glob also emits
// unused photos into the client build, including files no page renders.
const images = import.meta.glob<{ default: ImageMetadata }>(
  [
    "/src/images/project.webp",
    "/src/images/halloween.webp",
    "/src/images/hardhack.webp",
    "/src/images/waterpurity.webp",
    "/src/images/play-a-eye.webp",
    "/src/images/lavagame.webp",
    "/src/images/compactgps.webp",
    "/src/images/powertag.webp",
    "/src/images/holidayrobot.webp",
    "/src/images/step.webp",
    "/src/images/scc.jpg",
    "/src/images/sbcc.jpg",
    "/src/images/projects.png",
    "/src/images/logos/*",
  ],
  { eager: true },
);

/**
 * Resolve a `/src/images/...` path to its imported ImageMetadata.
 * Throws at build time if the path does not match a known asset, so
 * broken references surface immediately instead of silently rendering nothing.
 */
export function resolveImage(path: string): ImageMetadata {
  const asset = images[path];
  if (!asset) {
    throw new Error(
      `resolveImage: no asset found for "${path}". ` +
        `Expected a file under /src/images matching the import.meta.glob pattern.`,
    );
  }
  return asset.default;
}
