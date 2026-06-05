/**
 * Parse flexible time input strings into hours and minutes.
 * Supports: "9a", "9am", "9:00am", "9:00 am", "2p", "2pm", "2:00pm", "14:00", "9:00", "9a-2pm" (takes first part)
 */
export function parseFlexibleTime(input: string): { hours: number; minutes: number } | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // If input contains a range separator, take the first part
  const rangeSeparators = [" - ", "-", " to ", " – "];
  let timePart = trimmed;
  for (const sep of rangeSeparators) {
    if (trimmed.includes(sep)) {
      timePart = trimmed.split(sep)[0].trim();
      break;
    }
  }

  // Pattern: HH:MM (24-hour) e.g. "14:00", "9:30"
  const match24 = timePart.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
    return null;
  }

  // Pattern: H:MMam/pm or H:MM am/pm e.g. "9:00am", "2:30 pm"
  const matchAmPm = timePart.match(/^(\d{1,2}):(\d{2})\s*(a|am|p|pm)$/);
  if (matchAmPm) {
    let hours = parseInt(matchAmPm[1], 10);
    const minutes = parseInt(matchAmPm[2], 10);
    const period = matchAmPm[3];

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;

    if (period.startsWith("p") && hours !== 12) hours += 12;
    if (period.startsWith("a") && hours === 12) hours = 0;

    return { hours, minutes };
  }

  // Pattern: Ha or Ham or Hp or Hpm e.g. "9a", "9am", "2p", "2pm"
  const matchShort = timePart.match(/^(\d{1,2})\s*(a|am|p|pm)$/);
  if (matchShort) {
    let hours = parseInt(matchShort[1], 10);
    const period = matchShort[2];

    if (hours < 1 || hours > 12) return null;

    if (period.startsWith("p") && hours !== 12) hours += 12;
    if (period.startsWith("a") && hours === 12) hours = 0;

    return { hours, minutes: 0 };
  }

  // Pattern: just a number (assume hour in 24h if <= 23)
  const matchNum = timePart.match(/^(\d{1,2})$/);
  if (matchNum) {
    const hours = parseInt(matchNum[1], 10);
    if (hours >= 0 && hours <= 23) {
      return { hours, minutes: 0 };
    }
  }

  return null;
}

/**
 * Parse flexible date input strings into a Date object.
 * Supports: "mm/dd/yy", "mm/dd/yyyy", "m/d/yy", "m/d/yyyy"
 */
export function parseFlexibleDate(input: string): Date | null {
  if (!input || typeof input !== "string") return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Pattern: mm/dd/yy or mm/dd/yyyy (also m/d/yy, m/d/yyyy)
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    let year = parseInt(match[3], 10);

    // Convert 2-digit year to 4-digit
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    // Validate the date is real (e.g., not Feb 30)
    if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;

    return date;
  }

  // Try native Date parsing as fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

/**
 * Format a timestamp to mm/dd/yy string
 */
export function formatDateShort(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

/**
 * Format a timestamp to a time string like "9:00 AM"
 */
export function formatTimeShort(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minuteStr = String(minutes).padStart(2, "0");
  return `${hours}:${minuteStr} ${ampm}`;
}

/**
 * Combine a date and time into a timestamp.
 * Takes a base date (Date object or timestamp) and time { hours, minutes }.
 */
export function combineDateAndTime(
  baseDate: Date | number,
  time: { hours: number; minutes: number }
): number {
  const d = typeof baseDate === "number" ? new Date(baseDate) : new Date(baseDate);
  d.setHours(time.hours, time.minutes, 0, 0);
  return d.getTime();
}
