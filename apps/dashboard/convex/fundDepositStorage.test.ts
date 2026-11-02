import { describe, expect, it } from "vitest";
import { storageChecksumMatches } from "./fundDepositStorage";

const EMPTY_FILE_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("storageChecksumMatches", () => {
  it("accepts the checksum stored on the file", () => {
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, EMPTY_FILE_SHA256)).toBe(true);
  });

  it("accepts a checksum that differs only by case or surrounding space", () => {
    expect(
      storageChecksumMatches(EMPTY_FILE_SHA256, `  ${EMPTY_FILE_SHA256.toUpperCase()}  `),
    ).toBe(true);
  });

  it("rejects a different checksum of the same length", () => {
    const other = `${"a".repeat(63)}b`;
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, other)).toBe(false);
  });

  it("rejects checksums that are not 64 hex characters", () => {
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, "")).toBe(false);
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, EMPTY_FILE_SHA256.slice(0, 63))).toBe(
      false,
    );
    expect(storageChecksumMatches("not-a-checksum", EMPTY_FILE_SHA256)).toBe(false);
  });
});
