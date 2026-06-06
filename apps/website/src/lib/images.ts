import type { ImageMetadata } from "astro";

// Eagerly map every asset under src/images so JSON/data-driven paths
// (e.g. "/src/images/project.webp") can be resolved to ImageMetadata
// and rendered through Astro's <Image /> component.
const images = import.meta.glob<{ default: ImageMetadata }>(
  "/src/images/**/*.{webp,png,jpg,jpeg,avif,gif,svg}",
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
