import { FlexibleTimeParser } from "./FlexibleTimeParser";

export * from "./types";
export * from "./constants";
export { FlexibleTimeParser };

// Create singleton instance for convenience
export const flexibleTimeParser = new FlexibleTimeParser();