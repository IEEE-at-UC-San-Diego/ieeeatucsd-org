import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const convexDir = fileURLToPath(new URL(".", import.meta.url));

const TRACKED_TABLES = [
  "users",
  "events",
  "reimbursements",
  "fundDeposits",
  "fundRequests",
] as const;

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_generated") continue;
      files.push(...sourceFiles(path));
      continue;
    }
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}

function restOfWriter(source: string, index: number): string {
  const rest = source.slice(index);
  const boundary = rest.search(/\nexport const |\nasync function |\n  static async /);
  return boundary === -1 ? rest : rest.slice(0, boundary);
}

function writerHead(source: string, index: number): string {
  const start = Math.max(
    source.lastIndexOf("\nexport const ", index),
    source.lastIndexOf("\nasync function ", index),
    source.lastIndexOf("\n  static async ", index),
  );
  return source.slice(start < 0 ? 0 : start, index);
}

function missesSync(
  source: string,
  pattern: RegExp,
  skip?: (head: string) => boolean,
): number[] {
  const lines: number[] = [];
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    const head = writerHead(source, index);
    if (skip?.(head)) continue;
    if (!restOfWriter(source, index).includes("syncRecordStorage")) {
      lines.push(source.slice(0, index).split("\n").length);
    }
  }
  return lines;
}

describe("storage reference coverage", () => {
  it("reads storage ids from the schema file fields", () => {
    const schema = read(join(convexDir, "schema.ts"));
    const fields = [
      ...schema.matchAll(
        /^\s+((?:files|\w*Files|\w*File|proofFileUrl|attachments)):/gm,
      ),
    ].map((match) => match[1]);
    const helper = read(join(convexDir, "storageReferences.ts"));
    const start = helper.indexOf("function storageIdsFrom");
    const end = helper.indexOf("export async function syncRecordStorage");
    const extractor = helper.slice(start, end);

    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) {
      const needle = field === "files" ? ".files" : field;
      expect(extractor, field).toContain(needle);
    }
    expect(read(join(convexDir, "resume.ts"))).toContain(
      'storageId: v.id("_storage")',
    );
    expect(extractor).toContain("storageId");
    expect(helper).not.toContain("new Proxy");
    expect(helper).not.toContain("wrapMutationCtx");
    expect(helper).not.toContain("as never");
  });

  it("syncs every write of a storage table", () => {
    const misses: string[] = [];
    for (const path of sourceFiles(convexDir)) {
      const source = read(path);
      const file = path.slice(convexDir.length + 1);
      const rules: Array<{ pattern: RegExp; skip?: (before: string) => boolean }> = [
        {
          pattern: new RegExp(
            `\\.insert\\(\\s*"(${TRACKED_TABLES.join("|")})"`,
            "g",
          ),
        },
        {
          pattern: new RegExp(
            `\\.table\\(\\s*"(${TRACKED_TABLES.join("|")})"`,
            "g",
          ),
        },
        { pattern: /\.patch\(\s*(?:user\._id|args\.userId|existingUser\._id)/g },
        { pattern: /\.delete\(\s*args\.userId/g },
      ];
      if (file === "userAuth.ts") {
        rules.push({
          pattern: /\.patch\(\s*(?:existing\._id|bestMatch\._id)/g,
        });
      }
      if (file === "events.ts" || file === "fundRequests.ts") {
        rules.push({ pattern: /\.patch\(\s*(?:id|args\.id)\b/g });
      }
      if (
        file === "events.ts" ||
        file === "fundDeposits.ts" ||
        file === "reimbursements.ts" ||
        file === "fundRequests.ts"
      ) {
        rules.push({
          pattern: /\.patch\(\s*args\.id\b/g,
          skip: (before) =>
            file === "fundRequests.ts" && before.includes("budgetAdjustments"),
        });
        rules.push({
          pattern: /\.delete\(\s*args\.id\b/g,
          skip: (before) => before.includes("budgetAdjustments"),
        });
      }
      for (const rule of rules) {
        for (const line of missesSync(source, rule.pattern, rule.skip)) {
          misses.push(`${file}:${line}`);
        }
      }
    }
    expect(misses).toEqual([]);
  });
});
