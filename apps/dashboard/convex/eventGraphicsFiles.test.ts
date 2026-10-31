import { describe, expect, it } from "vitest";
import { EventGraphicsFiles } from "./eventGraphicsFiles";

describe("EventGraphicsFiles.append", () => {
  it("appends onto the stored list so a second upload keeps the first id", () => {
    const stored = ["storage_existing"];
    const afterFirst = EventGraphicsFiles.append(stored, "storage_one");
    const afterSecond = EventGraphicsFiles.append(afterFirst, "storage_two");

    expect(afterSecond).toEqual([
      "storage_existing",
      "storage_one",
      "storage_two",
    ]);
    expect(stored).toEqual(["storage_existing"]);
  });

  it("keeps both ids when two uploads read the same list and commit in order", () => {
    let stored = ["storage_existing"];
    const first = EventGraphicsFiles.append(stored, "storage_one");
    stored = first;
    const second = EventGraphicsFiles.append(stored, "storage_two");

    expect(first).toEqual(["storage_existing", "storage_one"]);
    expect(second).toEqual(["storage_existing", "storage_one", "storage_two"]);
  });

  it("does not duplicate a storage id already on the event", () => {
    expect(
      EventGraphicsFiles.append(["storage_one", "storage_two"], "storage_one"),
    ).toEqual(["storage_one", "storage_two"]);
  });

  it("starts from an empty list", () => {
    expect(EventGraphicsFiles.append(undefined, " storage_one ")).toEqual([
      "storage_one",
    ]);
    expect(EventGraphicsFiles.append(null, "storage_one")).toEqual([
      "storage_one",
    ]);
  });

  it("rejects a blank storage id", () => {
    expect(() => EventGraphicsFiles.append(["storage_one"], "  ")).toThrow(
      "Storage file is missing",
    );
  });
});
