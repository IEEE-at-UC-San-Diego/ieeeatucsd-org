/**
 * Roster columns already stored on `users` and shown in Manage Users
 * (table + edit modal), plus join/onboarding fields on that same document.
 * Excludes auth IDs, payment info, resumes, and preference blobs.
 */
export const MEMBER_CSV_HEADERS = [
	"Name",
	"Email",
	"Role",
	"Position",
	"Team",
	"Status",
	"PID",
	"Member ID",
	"Major",
	"Graduation Year",
	"Points",
	"Events Attended",
	"Join Date",
	"Last Login",
	"Signed Up",
	"IEEE Email",
	"Has IEEE Email",
	"IEEE Email Created",
	"Sponsor Tier",
	"Sponsor Organization",
] as const;

export type MemberCsvSource = {
	name: string;
	email: string;
	role: string;
	position?: string;
	team?: string;
	status: string;
	pid?: string;
	memberId?: string;
	major?: string;
	graduationYear?: number;
	points?: number;
	eventsAttended?: number;
	joinDate?: number;
	lastLogin?: number;
	signedUp?: boolean;
	ieeeEmail?: string;
	hasIEEEEmail?: boolean;
	ieeeEmailCreatedAt?: number;
	sponsorTier?: string;
	sponsorOrganization?: string;
};

export function escapeCsvField(value: string): string {
	const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
	if (
		safeValue.includes(",") ||
		safeValue.includes('"') ||
		safeValue.includes("\n") ||
		safeValue.includes("\r")
	) {
		return `"${safeValue.replace(/"/g, '""')}"`;
	}
	return safeValue;
}

export function formatCsvDate(timestamp: number | undefined): string {
	if (timestamp == null) return "";
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return "";
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function formatOptional(value: string | number | boolean | undefined): string {
	if (value === undefined) return "";
	return String(value);
}

export function membersCsvFilename(now = new Date()): string {
	return `ieee-members-${formatCsvDate(now.getTime())}.csv`;
}

export function buildMembersCsv(members: readonly MemberCsvSource[]): string {
	const rows = members.map((member) =>
		[
			member.name,
			member.email,
			member.role,
			member.position ?? "",
			member.team ?? "",
			member.status,
			member.pid ?? "",
			member.memberId ?? "",
			member.major ?? "",
			formatOptional(member.graduationYear),
			formatOptional(member.points),
			formatOptional(member.eventsAttended),
			formatCsvDate(member.joinDate),
			formatCsvDate(member.lastLogin),
			formatOptional(member.signedUp),
			member.ieeeEmail ?? "",
			formatOptional(member.hasIEEEEmail),
			formatCsvDate(member.ieeeEmailCreatedAt),
			member.sponsorTier ?? "",
			member.sponsorOrganization ?? "",
		]
			.map(escapeCsvField)
			.join(","),
	);

	return [MEMBER_CSV_HEADERS.join(","), ...rows].join("\n");
}

export function downloadMembersCsv(
	csvContent: string,
	filename: string,
	documentRef: Document = document,
): void {
	const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
	const link = documentRef.createElement("a");
	const url = URL.createObjectURL(blob);
	link.setAttribute("href", url);
	link.setAttribute("download", filename);
	link.style.visibility = "hidden";
	documentRef.body.appendChild(link);
	link.click();
	documentRef.body.removeChild(link);
	URL.revokeObjectURL(url);
}
