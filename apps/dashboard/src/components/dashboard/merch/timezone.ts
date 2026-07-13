const PACIFIC = "America/Los_Angeles";

function parts(timestamp: number) {
	const values = new Intl.DateTimeFormat("en-CA", {
		timeZone: PACIFIC,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(timestamp);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		values.find((part) => part.type === type)?.value;
	return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Parses datetime-local text as Pacific time, rejecting DST gaps and folds. */
export function parsePacificLocal(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
		throw new Error("Enter a valid date and time");
	const wallAsUtc = Date.parse(`${value}:00Z`);
	const candidates = [
		wallAsUtc + 7 * 3_600_000,
		wallAsUtc + 8 * 3_600_000,
	].filter((candidate) => parts(candidate) === value);
	if (candidates.length === 0)
		throw new Error("This time does not exist because of daylight saving time");
	if (candidates.length > 1)
		throw new Error(
			"This time occurs twice because of daylight saving time; choose another time",
		);
	return candidates[0];
}

export function toPacificLocalInput(timestamp?: number) {
	return timestamp ? parts(timestamp) : "";
}
