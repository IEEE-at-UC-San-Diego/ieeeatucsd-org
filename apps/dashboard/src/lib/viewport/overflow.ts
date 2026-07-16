/** Audited compact widths for mobile overflow regression checks. */
export const AUDITED_MOBILE_WIDTHS = [320, 375, 390, 430] as const;

/** Key routes covered by the mobile overflow smoke contract. */
export const OVERFLOW_SMOKE_ROUTES = [
	"/overview",
	"/events",
	"/reimbursement",
	"/leaderboard",
	"/links",
	"/settings",
	"/manage-events",
	"/manage-users",
	"/manage-sponsors",
	"/fund-requests",
	"/manage-reimbursements",
	"/manage-fund-requests",
	"/officer-calendar",
	"/slack-access",
	"/onboarding",
	"/constitution-builder",
	"/executive-analytics",
	"/sponsors/resume-database",
	"/sponsors/information",
	"/get-started",
	"/signin",
	"/privacy-policy",
	"/terms-of-service",
] as const;

/**
 * Document-level horizontal overflow check.
 * Tables/carousels may scroll locally; the document root must not widen.
 */
export function hasDocumentHorizontalOverflow(
	doc: Document = document,
	viewportWidth?: number,
): boolean {
	const root = doc.documentElement;
	const width =
		viewportWidth ?? doc.defaultView?.innerWidth ?? root.clientWidth;
	return root.scrollWidth > width + 1; // 1px tolerance for subpixel rounding
}

export function assertNoDocumentHorizontalOverflow(
	doc: Document = document,
	viewportWidth?: number,
) {
	const width =
		viewportWidth ??
		doc.defaultView?.innerWidth ??
		doc.documentElement.clientWidth;
	const scrollWidth = doc.documentElement.scrollWidth;
	if (scrollWidth > width + 1) {
		throw new Error(
			`Document horizontal overflow: scrollWidth=${scrollWidth} > innerWidth=${width}`,
		);
	}
}
