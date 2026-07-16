import * as React from "react";

/** Compact phones through large phones — bottom tabs + mobile shell. */
export const MOBILE_BREAKPOINT = 768;

/** Breakpoint contract (px):
 * - Compact: 320–479
 * - Large phone: 480–767
 * - Tablet: 768–1023
 * - Desktop: 1024+
 */
export type ViewportTier = "compact" | "large-phone" | "tablet" | "desktop";

function getViewportTier(width: number): ViewportTier {
	if (width < 480) return "compact";
	if (width < 768) return "large-phone";
	if (width < 1024) return "tablet";
	return "desktop";
}

export function useIsMobile() {
	const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
		undefined,
	);

	React.useEffect(() => {
		const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
		const onChange = () => {
			setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		};
		mql.addEventListener("change", onChange);
		setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		return () => mql.removeEventListener("change", onChange);
	}, []);

	return !!isMobile;
}

export function useViewportTier() {
	const [tier, setTier] = React.useState<ViewportTier | undefined>(undefined);

	React.useEffect(() => {
		const update = () => setTier(getViewportTier(window.innerWidth));
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	return tier ?? "desktop";
}

/** True for compact + large-phone (< 768px). Prefer CSS when possible. */
export function useIsCompact() {
	return useIsMobile();
}
