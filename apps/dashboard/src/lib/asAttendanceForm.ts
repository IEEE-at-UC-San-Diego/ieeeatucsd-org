/**
 * A.S. Funded Event Attendance 2026-2027.
 * Entry ids and option strings come from the live viewform
 * `FB_PUBLIC_LOAD_DATA_` blob. The form has no name question.
 * The event control is a multiple-choice list replaced weekly.
 * Its options use "Club Name - Event Name".
 */
export const asAttendanceForm = {
	viewformUrl:
		"https://docs.google.com/forms/d/e/1FAIpQLSc3CypbxjZgU7ZzbhlpEy1XtytmzDquuU4ELmf_VtDRjkDomw/viewform",
	clubName: "Institute of Electrical and Electronics Engineers (IEEE)",
	membership: "Member",
	entries: {
		event: "219446721",
		graduationYear: "1687560837",
		membership: "1851239463",
		food: "570464428",
	},
	// 2027 uses U+2018 on the form. 2028–2030 use ASCII '.
	graduationYear: {
		2027: "Class of \u201827",
		2028: "Class of '28",
		2029: "Class of '29",
		2030: "Class of '30",
	} as Record<number, string>,
};

export type AsAttendancePrefill = {
	email?: string | null;
	graduationYear?: number | null;
	eventName?: string | null;
	foodVendor?: string | null;
};

function filled(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

export function asAttendanceEventOption(eventName: string): string {
	return `${asAttendanceForm.clubName} - ${eventName.trim()}`;
}

export function buildAsAttendanceFormUrl(input: AsAttendancePrefill): string {
	const params = new URLSearchParams();
	const email = filled(input.email);
	if (email) params.set("emailAddress", email);

	const yearLabel =
		input.graduationYear == null
			? undefined
			: asAttendanceForm.graduationYear[input.graduationYear];
	if (yearLabel) {
		params.set(`entry.${asAttendanceForm.entries.graduationYear}`, yearLabel);
	}

	params.set(
		`entry.${asAttendanceForm.entries.membership}`,
		asAttendanceForm.membership,
	);

	const eventName = filled(input.eventName);
	if (eventName) {
		params.set(
			`entry.${asAttendanceForm.entries.event}`,
			asAttendanceEventOption(eventName),
		);
	}

	const foodVendor = filled(input.foodVendor);
	if (foodVendor) {
		params.set(`entry.${asAttendanceForm.entries.food}`, foodVendor);
	}

	return `${asAttendanceForm.viewformUrl}?${params.toString()}`;
}
