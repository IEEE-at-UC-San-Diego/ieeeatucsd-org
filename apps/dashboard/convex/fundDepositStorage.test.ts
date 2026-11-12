import { describe, expect, it } from "vitest";
import { storageChecksumMatches } from "./fundDepositStorage";

const EMPTY_FILE_SHA256 = "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";
const EMPTY_FILE_SHA256_HEX =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("storageChecksumMatches", () => {
  it("accepts the checksum Convex stores on the file", () => {
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, EMPTY_FILE_SHA256)).toBe(true);
  });

  it("accepts a checksum that differs only by surrounding space", () => {
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, `  ${EMPTY_FILE_SHA256}  `)).toBe(true);
  });

  it("rejects a checksum that differs only by case", () => {
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, EMPTY_FILE_SHA256.toLowerCase())).toBe(
      false,
    );
  });

  it("rejects a different checksum of the same shape", () => {
    const other = "pJx6wDzsrVwJNp9iFlOyB7YcRYB1xOZQ/hUPPek5ImA=";
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, other)).toBe(false);
  });

  it("rejects the hex encoding of the same file", () => {
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, EMPTY_FILE_SHA256_HEX)).toBe(false);
    expect(storageChecksumMatches(EMPTY_FILE_SHA256_HEX, EMPTY_FILE_SHA256_HEX)).toBe(false);
  });

  it("rejects checksums that are not a SHA-256 base64 digest", () => {
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, "")).toBe(false);
    expect(storageChecksumMatches(EMPTY_FILE_SHA256, EMPTY_FILE_SHA256.slice(0, 43))).toBe(
      false,
    );
    expect(storageChecksumMatches("not-a-checksum", EMPTY_FILE_SHA256)).toBe(false);
  });
});
