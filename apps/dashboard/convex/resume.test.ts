import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import {
  storageIdTakenBySomeoneElse,
  validateAndBuildResume,
  type StorageRecord,
} from "./resume";
import type { MutationCtx } from "./_generated/server";

const bobResume: StorageRecord = {
  recordId: "user_bob",
  body: { resume: { storageId: "storage_bob" } },
};

function resumeCtx(options: {
  contentType: string;
  size: number;
  users?: { _id: string; resume?: { storageId: string } }[];
  events?: { _id: string; graphicsFiles?: string[] }[];
  deleted: string[];
}): MutationCtx {
  const users = options.users ?? [];
  const events = options.events ?? [];
  return {
    db: {
      system: {
        get: async () => ({
          contentType: options.contentType,
          size: options.size,
          sha256: "abc",
        }),
      },
      query: (table: string) => ({
        collect: async () => {
          if (table === "users") return users;
          if (table === "events") return events;
          return [];
        },
      }),
    },
    storage: {
      delete: async (id: string) => {
        options.deleted.push(String(id));
      },
    },
  } as unknown as MutationCtx;
}

describe("storageIdTakenBySomeoneElse", () => {
  it("rejects another user's storage id", () => {
    expect(
      storageIdTakenBySomeoneElse("storage_bob", "user_ada", [bobResume]),
    ).toBe(true);
  });

  it("rejects a storage id saved on another record", () => {
    expect(
      storageIdTakenBySomeoneElse("storage_event", "user_ada", [
        {
          recordId: "event_1",
          body: {
            graphicsFiles: [
              "https://files.example/api/storage/storage_event?token=1",
            ],
          },
        },
      ]),
    ).toBe(true);
  });

  it("allows the caller's own resume storage id", () => {
    expect(
      storageIdTakenBySomeoneElse("storage_ada", "user_ada", [
        {
          recordId: "user_ada",
          body: { resume: { storageId: "storage_ada" } },
        },
      ]),
    ).toBe(false);
  });
});

describe("validateAndBuildResume", () => {
  it("rejects another user's storage id and does not delete the file", async () => {
    const deleted: string[] = [];
    const ctx = resumeCtx({
      contentType: "text/plain",
      size: 12,
      users: [{ _id: "user_bob", resume: { storageId: "storage_bob" } }],
      deleted,
    });

    await expect(
      validateAndBuildResume(
        ctx,
        "storage_bob" as Id<"_storage">,
        "bob.pdf",
        "user_ada" as Id<"users">,
      ),
    ).rejects.toThrow("Unauthorized");
    expect(deleted).toEqual([]);
  });

  it("rejects an event file id and does not delete it", async () => {
    const deleted: string[] = [];
    const ctx = resumeCtx({
      contentType: "image/png",
      size: 20,
      events: [{ _id: "event_1", graphicsFiles: ["storage_event"] }],
      deleted,
    });

    await expect(
      validateAndBuildResume(
        ctx,
        "storage_event" as Id<"_storage">,
        "flyer.png",
        "user_ada" as Id<"users">,
      ),
    ).rejects.toThrow("Unauthorized");
    expect(deleted).toEqual([]);
  });

  it("does not delete a fresh file that fails the pdf check", async () => {
    const deleted: string[] = [];
    const ctx = resumeCtx({
      contentType: "text/plain",
      size: 12,
      deleted,
    });

    await expect(
      validateAndBuildResume(
        ctx,
        "storage_new" as Id<"_storage">,
        "notes.txt",
        "user_ada" as Id<"users">,
      ),
    ).rejects.toThrow("Resume must be a PDF file");
    expect(deleted).toEqual([]);
  });

  it("accepts a pdf that no other record holds", async () => {
    const deleted: string[] = [];
    const ctx = resumeCtx({
      contentType: "application/pdf",
      size: 100,
      deleted,
    });

    await expect(
      validateAndBuildResume(
        ctx,
        "storage_new" as Id<"_storage">,
        " ada.pdf ",
        "user_ada" as Id<"users">,
      ),
    ).resolves.toMatchObject({
      storageId: "storage_new",
      fileName: "ada.pdf",
      contentType: "application/pdf",
    });
    expect(deleted).toEqual([]);
  });
});
