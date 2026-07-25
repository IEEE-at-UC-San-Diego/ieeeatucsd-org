import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * JS counterpart to the `prefers-reduced-motion` CSS block in styles.css, for
 * motion that can't be reached from CSS (canvas/SVG libraries such as recharts).
 * Starts `false` so SSR and the first client render agree.
 */
export function usePrefersReducedMotion(): boolean {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	useEffect(() => {
		const media = window.matchMedia(REDUCED_MOTION_QUERY);
		setPrefersReducedMotion(media.matches);

		const onChange = (event: MediaQueryListEvent) => {
			setPrefersReducedMotion(event.matches);
		};
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, []);

	return prefersReducedMotion;
}
