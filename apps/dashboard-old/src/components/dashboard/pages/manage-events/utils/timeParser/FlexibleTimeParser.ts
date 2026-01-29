import type {
  ParsedTime,
  ParsedTimeRange,
  TimeParseResult,
  TimeParserOptions,
} from "./types";
import { TimeParseErrorType } from "./types";
import {
  TIME_PATTERNS,
  RANGE_SEPARATORS,
  DEFAULT_OPTIONS,
} from "./constants";

export class FlexibleTimeParser {
  /**
   * Parse a time string (single time or range)
   */
  parse(input: string, options: TimeParserOptions = {}): TimeParseResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Preprocessing
    const cleaned = this.preprocess(input);

    if (!cleaned) {
      return {
        isValid: false,
        originalInput: input,
        errorMessage: "Time input cannot be empty",
      };
    }

    // Range detection
    const isRange = this.detectRange(cleaned);

    if (isRange) {
      return this.parseRange(cleaned, opts, input);
    } else {
      return this.parseSingle(cleaned, opts, input);
    }
  }

  /**
   * Parse only a single time (not a range)
   */
  parseSingleTime(
    input: string,
    options: TimeParserOptions = {},
  ): TimeParseResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const cleaned = this.preprocess(input);

    if (!cleaned) {
      return {
        isValid: false,
        originalInput: input,
        errorMessage: "Time input cannot be empty",
      };
    }

    return this.parseSingle(cleaned, opts, input);
  }

  /**
   * Parse only a time range
   */
  parseTimeRange(
    input: string,
    options: TimeParserOptions = {},
  ): TimeParseResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const cleaned = this.preprocess(input);

    if (!cleaned) {
      return {
        isValid: false,
        originalInput: input,
        errorMessage: "Time input cannot be empty",
      };
    }

    if (!this.detectRange(cleaned)) {
      return {
        isValid: false,
        originalInput: input,
        errorMessage:
          'No range separator found. Use "-" or "to" to separate times',
      };
    }

    return this.parseRange(cleaned, opts, input);
  }

  /**
   * Validate if a string is a valid time format
   */
  isValid(input: string, options: TimeParserOptions = {}): boolean {
    const result = this.parse(input, options);
    return result.isValid;
  }

  /**
   * Format a parsed time to various string formats
   */
  formatTime(time: ParsedTime, format: "12h" | "24h" | "display"): string {
    switch (format) {
      case "12h":
        return time.time12;
      case "24h":
        return time.time24;
      case "display":
        return time.time12;
      default:
        return time.time12;
    }
  }

  /**
   * Format a parsed time range to display string
   */
  formatTimeRange(range: ParsedTimeRange): string {
    return range.displayString;
  }

  /**
   * Preprocess input string
   */
  private preprocess(input: string): string {
    return input.trim().toLowerCase().replace(/\s+/g, " ");
  }

  /**
   * Detect if input contains a range separator
   */
  private detectRange(input: string): boolean {
    return RANGE_SEPARATORS.some((sep) => sep.regex.test(input));
  }

  /**
   * Parse a single time component
   */
  private parseSingle(
    cleaned: string,
    opts: Required<Omit<TimeParserOptions, "customSeparators">>,
    originalInput: string,
  ): TimeParseResult {
    // Try each pattern
    for (const pattern of TIME_PATTERNS) {
      const match = cleaned.match(pattern.regex);
      if (match) {
        try {
          const time = this.extractTimeFromMatch(match, pattern.type, opts);
          return {
            isValid: true,
            time,
            originalInput,
          };
        } catch (error) {
          return {
            isValid: false,
            originalInput,
            errorMessage:
              error instanceof Error
                ? error.message
                : "Invalid time format",
          };
        }
      }
    }

    return {
      isValid: false,
      originalInput,
      errorMessage:
        'Invalid time format. Use formats like "9am", "9:30am", "930am", or "9a"',
    };
  }

  /**
   * Parse a time range
   */
  private parseRange(
    cleaned: string,
    opts: Required<Omit<TimeParserOptions, "customSeparators">>,
    originalInput: string,
  ): TimeParseResult {
    // Find the separator
    let separatorMatch: { separator: string; parts: string[] } | null = null;

    for (const sep of RANGE_SEPARATORS) {
      const parts = cleaned.split(sep.regex);
      if (parts.length === 2) {
        separatorMatch = { separator: sep.separator, parts };
        break;
      }
    }

    if (!separatorMatch || separatorMatch.parts.length !== 2) {
      return {
        isValid: false,
        originalInput,
        errorMessage: "Invalid range format. Use formats like '9am-10pm'",
      };
    }

    const [startStr, endStr] = separatorMatch.parts;

    // Parse start time
    const startResult = this.parseSingle(
      startStr.trim(),
      opts,
      startStr.trim(),
    );
    if (!startResult.isValid || !startResult.time) {
      return {
        isValid: false,
        originalInput,
        errorMessage: `Invalid start time: ${startResult.errorMessage}`,
      };
    }

    // Parse end time
    const endResult = this.parseSingle(endStr.trim(), opts, endStr.trim());
    if (!endResult.isValid || !endResult.time) {
      return {
        isValid: false,
        originalInput,
        errorMessage: `Invalid end time: ${endResult.errorMessage}`,
      };
    }

    // Validate range
    if (opts.validateRanges) {
      const startMinutes = startResult.time.hour * 60 + startResult.time.minute;
      const endMinutes = endResult.time.hour * 60 + endResult.time.minute;

      if (endMinutes <= startMinutes) {
        return {
          isValid: false,
          originalInput,
          errorMessage: "End time must be after start time",
        };
      }
    }

    // Calculate duration
    const durationMinutes =
      endResult.time.hour * 60 +
      endResult.time.minute -
      (startResult.time.hour * 60 + startResult.time.minute);

    const timeRange: ParsedTimeRange = {
      startTime: startResult.time,
      endTime: endResult.time,
      durationMinutes,
      displayString: `${startResult.time.time12} - ${endResult.time.time12}`,
    };

    return {
      isValid: true,
      timeRange,
      originalInput,
    };
  }

  /**
   * Extract time components from regex match
   */
  private extractTimeFromMatch(
    match: RegExpMatchArray,
    type: string,
    opts: Required<Omit<TimeParserOptions, "customSeparators">>,
  ): ParsedTime {
    let hours: number;
    let minutes: number;
    let period: string;

    if (type.includes("colon")) {
      // Colon-based formats: 9:30am, 9:30a
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      period = match[3].toLowerCase();
    } else if (type.includes("compact-3")) {
      // 3-digit compact: 930am, 930a
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      period = match[3].toLowerCase();
    } else if (type.includes("compact-4")) {
      // 4-digit compact: 1030am, 1030a
      hours = parseInt(match[1], 10);
      minutes = parseInt(match[2], 10);
      period = match[3].toLowerCase();
    } else {
      // Hour-only formats: 9am, 9a
      hours = parseInt(match[1], 10);
      minutes = opts.defaultMinutes;
      period = match[2].toLowerCase();
    }

    // Normalize period
    if (period === "a" || period === "am") {
      period = "am";
    } else if (period === "p" || period === "pm") {
      period = "pm";
    } else {
      throw new Error("Invalid AM/PM indicator");
    }

    // Validate hours
    if (hours < 1 || hours > 12) {
      throw new Error(`Invalid hour: ${hours}. Must be between 1 and 12`);
    }

    // Validate minutes
    if (minutes < 0 || minutes > 59) {
      throw new Error(`Invalid minutes: ${minutes}. Must be between 0 and 59`);
    }

    // Convert to 24-hour format
    let hours24 = hours;
    if (period === "pm" && hours !== 12) {
      hours24 = hours + 12;
    } else if (period === "am" && hours === 12) {
      hours24 = 0;
    }

    // Format strings
    const time24 = `${hours24.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    const time12 = `${hours}:${minutes.toString().padStart(2, "0")} ${period.toUpperCase()}`;

    return {
      time24,
      time12,
      hour: hours24,
      minute: minutes,
      period: period.toUpperCase() as "AM" | "PM",
    };
  }
}