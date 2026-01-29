import type { TimeParserOptions } from "./types";

/**
 * Time parsing patterns ordered by specificity (most specific first)
 */
export const TIME_PATTERNS = [
  // 9:30am, 10:30pm (with colon and full am/pm)
  {
    regex: /^(\d{1,2}):(\d{2})\s*(am|pm)$/i,
    type: "colon-full",
  },
  // 9:30a, 10:30p (with colon and shorthand)
  {
    regex: /^(\d{1,2}):(\d{2})\s*([ap])$/i,
    type: "colon-short",
  },
  // 930am, 1030pm (3-4 digits + full am/pm)
  {
    regex: /^(\d{1})(\d{2})\s*(am|pm)$/i,
    type: "compact-3-full",
  },
  // 1230am, 1030pm (4 digits + full am/pm)
  {
    regex: /^(\d{2})(\d{2})\s*(am|pm)$/i,
    type: "compact-4-full",
  },
  // 930a, 1030p (3-4 digits + shorthand)
  {
    regex: /^(\d{1})(\d{2})\s*([ap])$/i,
    type: "compact-3-short",
  },
  // 1230a, 1030p (4 digits + shorthand)
  {
    regex: /^(\d{2})(\d{2})\s*([ap])$/i,
    type: "compact-4-short",
  },
  // 9am, 10pm (hour only + full am/pm)
  {
    regex: /^(\d{1,2})\s*(am|pm)$/i,
    type: "hour-full",
  },
  // 9a, 10p (hour only + shorthand)
  {
    regex: /^(\d{1,2})\s*([ap])$/i,
    type: "hour-short",
  },
] as const;

/**
 * Range separator patterns
 */
export const RANGE_SEPARATORS = [
  { separator: "-", regex: /\s*-\s*/ },
  { separator: "to", regex: /\s+to\s+/i },
  { separator: "through", regex: /\s+through\s+/i },
  { separator: "until", regex: /\s+until\s+/i },
] as const;

/**
 * Valid characters for time input
 */
export const VALID_CHARS_REGEX = /^[0-9:\samp\-to]+$/i;

/**
 * Default parser options
 */
export const DEFAULT_OPTIONS: Required<
  Omit<TimeParserOptions, "customSeparators">
> = {
  strictMode: false,
  defaultMinutes: 0,
  validateRanges: true,
};
