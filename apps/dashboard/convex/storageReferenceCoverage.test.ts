import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findDirectStorageWrites,
  findDirectStorageWritesInText,
} from "./storageReferenceGuard.ts";

const convexDir = fileURLToPath(new URL(".", import.meta.url));

const PREAMBLE = `
type Id<Table extends string> = string & { __tableName: Table };
declare const ctx: {
  db: {
    insert(table: string, value: object): Promise<string>;
    patch(id: string, value: object): Promise<void>;
    replace(id: string, value: object): Promise<void>;
    delete(id: string): Promise<void>;
  };
};
`;

const eventIdBypass = `
${PREAMBLE}
export async function save(eventId: Id<"events">) {
  await ctx.db.patch(eventId, { published: true });
  await ctx.db.delete(eventId);
  await ctx.db.replace(eventId, { published: false });
}
`;

const commentBypass = `
${PREAMBLE}
export async function save() {
  await ctx.db.insert("events", { name: "Launch" });
  // syncRecordStorage(ctx, "events", eventId)
}
`;

describe("storage reference coverage", () => {
  it("reads storage ids from the schema file fields", () => {
    const schema = readFileSync(join(convexDir, "schema.ts"), "utf8");
    const fields = [
      ...schema.matchAll(
        /^\s+((?:files|\w*Files|\w*File|proofFileUrl|attachments)):/gm,
      ),
    ].map((match) => match[1]);
    const helper = readFileSync(join(convexDir, "storageReferences.ts"), "utf8");
    const start = helper.indexOf("function storageIdsFrom");
    const end = helper.indexOf("type InsertValue");
    const extractor = helper.slice(start, end);

    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      const needle = field === "files" ? ".files" : field;
      expect(extractor, field).toContain(needle);
    }
    expect(readFileSync(join(convexDir, "resume.ts"), "utf8")).toContain(
      'storageId: v.id("_storage")',
    );
    expect(extractor).toContain("storageId");
    expect(helper).not.toContain("new Proxy");
    expect(helper).not.toContain("wrapMutationCtx");
    expect(helper).not.toContain("as never");
  });

  it("rejects an eventId write and a sync that exists only in a comment", () => {
    expect(findDirectStorageWritesInText(eventIdBypass).map((write) => write.kind)).toEqual([
      "patch",
      "delete",
      "replace",
    ]);
    expect(
      findDirectStorageWritesInText(eventIdBypass).every((write) => write.table === "events"),
    ).toBe(true);
    expect(findDirectStorageWritesInText(commentBypass)).toMatchObject([
      { kind: "insert", table: "events" },
    ]);
  });

  it("ignores writes inside the storage helpers and other tables", () => {
    const source = `
${PREAMBLE}
async function insertTracked() {
  await ctx.db.insert("events", { name: "inside helper" });
}
export async function save() {
  await insertTracked();
  await ctx.db.insert("budgetConfigs", { amount: 1 });
  await ctx.db.delete("budgetAdjustments" as Id<"budgetAdjustments">);
}
`;
    expect(findDirectStorageWritesInText(source)).toEqual([]);
  });

  it("finds no direct writes of the five storage tables", () => {
    const writes = findDirectStorageWrites(join(convexDir, ".."));
    expect(writes).toEqual([]);
  });
});
