export interface WeekLabelSettings {
	fallWeek0Start: string;
	winterWeek1Start: string;
	springWeek1Start: string;
}

const STORAGE_KEY = "dashboard.week-label-settings.v1";

export const defaultWeekLabelSettings: WeekLabelSettings = {
	fallWeek0Start: "",
	winterWeek1Start: "",
	springWeek1Start: "",
};

function parseDateInput(value: string): Date | null {
	if (!value) return null;
	const parts = value.split("-").map((part) => Number.parseInt(part, 10));
	if (parts.length !== 3 || parts.some((part) => Number.isNaN(part)))
		return null;
	const [year, month, day] = parts;
	const date = new Date(year, month - 1, day);
	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day
	) {
		return null;
	}
	return date;
}

function startOfLocalDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start: Date, end: Date): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	return Math.floor(
		(startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) /
			msPerDay,
	);
}

function buildFallLabel(date: Date, startInput: string): string | null {
	const start = parseDateInput(startInput);
	if (!start) return null;
	const offsetDays = daysBetween(start, date);
	if (offsetDays < 0) return null;
	const weekIndex = Math.floor(offsetDays / 7);
	if (weekIndex <= 10) return `Fall Week ${weekIndex}`;
	if (weekIndex === 11) return "Fall Finals";
	return null;
}

function buildStandardQuarterLabel(
	quarter: "Winter" | "Spring",
	date: Date,
	startInput: string,
): string | null {
	const start = parseDateInput(startInput);
	if (!start) return null;
	const offsetDays = daysBetween(start, date);
	if (offsetDays < 0) return null;
	const weekIndex = Math.floor(offsetDays / 7) + 1;
	if (weekIndex < 1 || weekIndex > 11) return null;
	if (weekIndex === 11) return `${quarter} Finals`;
	return `${quarter} Week ${weekIndex}`;
}

export function getWeekLabelForDate(
	date: Date,
	settings: WeekLabelSettings,
): string | null {
	return (
		buildFallLabel(date, settings.fallWeek0Start) ||
		buildStandardQuarterLabel("Winter", date, settings.winterWeek1Start) ||
		buildStandardQuarterLabel("Spring", date, settings.springWeek1Start)
	);
}

export function loadWeekLabelSettings(): WeekLabelSettings {
	if (typeof window === "undefined") return defaultWeekLabelSettings;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaultWeekLabelSettings;
		const parsed = JSON.parse(raw) as Partial<WeekLabelSettings>;
		return {
			fallWeek0Start:
				typeof parsed.fallWeek0Start === "string" ? parsed.fallWeek0Start : "",
			winterWeek1Start:
				typeof parsed.winterWeek1Start === "string"
					? parsed.winterWeek1Start
					: "",
			springWeek1Start:
				typeof parsed.springWeek1Start === "string"
					? parsed.springWeek1Start
					: "",
		};
	} catch {
		return defaultWeekLabelSettings;
	}
}

export function saveWeekLabelSettings(settings: WeekLabelSettings): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
