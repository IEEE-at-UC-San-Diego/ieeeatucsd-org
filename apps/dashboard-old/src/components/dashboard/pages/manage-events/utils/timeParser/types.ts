/**
 * Represents a parsed time with all necessary information
 */
export interface ParsedTime {
  /** Time in 24-hour format (HH:MM) */
  time24: string;
  /** Time in 12-hour format with AM/PM (H:MM AM/PM) */
  time12: string;
  /** Hour component (0-23) */
  hour: number;
  /** Minute component (0-59) */
  minute: number;
  /** Whether this is AM or PM */
  period: "AM" | "PM";
}

/**
 * Represents a parsed time range
 */
export interface ParsedTimeRange {
  /** Start time information */
  startTime: ParsedTime;
  /** End time information */
  endTime: ParsedTime;
  /** Duration in minutes */
  durationMinutes: number;
  /** Formatted display string for the range */
  displayString: string;
}

/**
 * Result of time parsing operation
 */
export interface TimeParseResult {
  /** Whether parsing was successful */
  isValid: boolean;
  /** Parsed time (if single time) */
  time?: ParsedTime;
  /** Parsed time range (if range) */
  timeRange?: ParsedTimeRange;
  /** Error message if parsing failed */
  errorMessage?: string;
  /** Warning messages for non-critical issues */
  warnings?: string[];
  /** Original input that was parsed */
  originalInput: string;
}

/**
 * Configuration options for the parser
 */
export interface TimeParserOptions {
  /** Whether to be strict about format or allow more lenient parsing */
  strictMode?: boolean;
  /** Default minutes when not specified */
  defaultMinutes?: number;
  /** Whether to validate time ranges (end after start) */
  validateRanges?: boolean;
  /** Custom separator patterns */
  customSeparators?: string[];
}

/**
 * Error types for time parsing
 */
export enum TimeParseErrorType {
  INVALID_FORMAT = "INVALID_FORMAT",
  INVALID_HOUR = "INVALID_HOUR",
  INVALID_MINUTE = "INVALID_MINUTE",
  INVALID_RANGE = "INVALID_RANGE",
  AMBIGUOUS_FORMAT = "AMBIGUOUS_FORMAT",
  MISSING_SEPARATOR = "MISSING_SEPARATOR",
  MULTIPLE_SEPARATORS = "MULTIPLE_SEPARATORS",
  EMPTY_INPUT = "EMPTY_INPUT",
}

/**
 * Detailed error information
 */
export interface TimeParseError {
  type: TimeParseErrorType;
  message: string;
  position?: number;
  suggestion?: string;
}