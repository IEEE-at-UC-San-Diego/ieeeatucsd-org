import type { UserRole } from "@/types/roles";

export function isVcoPosition(position?: string | null): boolean {
	if (!position) return false;
	const normalized = position.trim().toLowerCase();
	return (
		normalized === "vco" ||
		normalized === "vice chair operations" ||
		normalized.includes("vice chair operations")
	);
}

export function canViewVcoPipeline(
	role: UserRole,
	position?: string | null,
): boolean {
	const isAdmin = role === "Administrator" || role === "Executive Officer";
	const isOfficer = isAdmin || role === "General Officer";
	return isAdmin || (isOfficer && isVcoPosition(position));
}
