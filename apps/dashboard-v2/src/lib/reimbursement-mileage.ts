/** Fixed org rate for mileage reimbursement (USD per mile). */
export const MILEAGE_RATE_PER_MILE = 0.2;

const METERS_PER_MILE = 1609.344;

export function roundMileage(miles: number): number {
	const n = Number(miles);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.round(n * 100) / 100;
}

export function metersToRoundedMiles(meters: number): number {
	const n = Number(meters);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return roundMileage(n / METERS_PER_MILE);
}

export function computeMileageTotal(miles: number): number {
	return Math.round(roundMileage(miles) * MILEAGE_RATE_PER_MILE * 100) / 100;
}

/** Join from → optional intermediate stops → to for display and legacy `location`. */
export function formatMileageRoute(
	from: string | undefined,
	to: string | undefined,
	stops: string[] | undefined,
): string {
	const parts = [
		(from ?? "").trim(),
		...(stops ?? []).map((s) => s.trim()).filter(Boolean),
		(to ?? "").trim(),
	].filter(Boolean);
	return parts.join(" → ");
}
