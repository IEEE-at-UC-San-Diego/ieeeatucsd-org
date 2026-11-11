// Locale is pinned so server-rendered and hydrated output match.
const LOCALE = "en-US";

type DateInput = number | string | Date;

const toDate = (value: DateInput) =>
	value instanceof Date ? value : new Date(value);

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
	style: "currency",
	currency: "USD",
});
const numberFormatter = new Intl.NumberFormat(LOCALE);
const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
	year: "numeric",
	month: "short",
	day: "numeric",
});
const longDateFormatter = new Intl.DateTimeFormat(LOCALE, {
	weekday: "long",
	year: "numeric",
	month: "long",
	day: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat(LOCALE, {
	month: "short",
	day: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
	year: "numeric",
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});
const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
	hour: "numeric",
	minute: "2-digit",
});
const monthYearFormatter = new Intl.DateTimeFormat(LOCALE, {
	month: "long",
	year: "numeric",
});
const weekdayShortFormatter = new Intl.DateTimeFormat(LOCALE, {
	weekday: "short",
});
const relativeTimeFormatter = new Intl.RelativeTimeFormat(LOCALE, {
	numeric: "auto",
});

export function formatCurrencyUSD(amount: number): string {
	return currencyFormatter.format(amount);
}

export function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

/** "Nov 5, 2026" */
export function formatDate(value: DateInput): string {
	return dateFormatter.format(toDate(value));
}

/** "Thursday, November 5, 2026" */
export function formatLongDate(value: DateInput): string {
	return longDateFormatter.format(toDate(value));
}

/** "Nov 5" */
export function formatShortDate(value: DateInput): string {
	return shortDateFormatter.format(toDate(value));
}

/** "Nov 5, 2026, 3:30 PM" */
export function formatDateTime(value: DateInput): string {
	return dateTimeFormatter.format(toDate(value));
}

/** "3:30 PM" */
export function formatTime(value: DateInput): string {
	return timeFormatter.format(toDate(value));
}

/** "November 2026" */
export function formatMonthYear(value: DateInput): string {
	return monthYearFormatter.format(toDate(value));
}

/** "Thu" */
export function formatWeekdayShort(value: DateInput): string {
	return weekdayShortFormatter.format(toDate(value));
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 365 * 24 * 60 * 60 * 1000],
	["month", 30 * 24 * 60 * 60 * 1000],
	["week", 7 * 24 * 60 * 60 * 1000],
	["day", 24 * 60 * 60 * 1000],
	["hour", 60 * 60 * 1000],
	["minute", 60 * 1000],
];

/** "3 hours ago", "in 2 days", "now" */
export function formatRelativeTime(
	value: DateInput,
	now: number = Date.now(),
): string {
	const diff = toDate(value).getTime() - now;
	for (const [unit, ms] of RELATIVE_UNITS) {
		if (Math.abs(diff) >= ms) {
			return relativeTimeFormatter.format(Math.round(diff / ms), unit);
		}
	}
	return relativeTimeFormatter.format(0, "second");
}

const FILE_SIZE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;
const fileSizeFormatters = FILE_SIZE_UNITS.map(
	(unit) =>
		new Intl.NumberFormat(LOCALE, {
			style: "unit",
			unit,
			unitDisplay: "short",
			maximumFractionDigits: 1,
		}),
);

/** "1.2 MB" */
export function formatFileSize(bytes: number): string {
	let index = 0;
	let value = bytes;
	while (value >= 1024 && index < FILE_SIZE_UNITS.length - 1) {
		value /= 1024;
		index++;
	}
	return fileSizeFormatters[index].format(value);
}

export function formatDateDisplay(timestamp: number | undefined): string {
	if (!timestamp) return "N/A";
	return formatDate(timestamp);
}

export function formatDateTimeDisplay(timestamp: number | undefined): string {
	if (!timestamp) return "N/A";
	return formatDateTime(timestamp);
}
