import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOfficerAccess = vi.hoisted(() => vi.fn());
const requireAdminAccess = vi.hoisted(() => vi.fn());

vi.mock("./_generated/server", () => ({
  query: (definition: unknown) => definition,
  mutation: (definition: unknown) => definition,
}));

vi.mock("./permissions", () => ({
  requireOfficerAccess,
  requireAdminAccess,
}));

import { get, getAuditLog, getByTitle } from "./constitutions";

type QueryHandler = {
  args: object;
  handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
};

function asQuery(value: unknown): QueryHandler {
  return value as QueryHandler;
}

describe("constitution read auth", () => {
  beforeEach(() => {
    requireOfficerAccess.mockReset();
    requireAdminAccess.mockReset();
  });

  it("requires officer access before loading a constitution by id", async () => {
    const order: string[] = [];
    requireOfficerAccess.mockImplementation(async () => {
      order.push("auth");
      return { role: "General Officer" };
    });
    const document = { title: "Draft constitution" };
    const ctx = {
      db: {
        get: vi.fn(async () => {
          order.push("read");
          return document;
        }),
      },
    };

    await expect(
      asQuery(get).handler(ctx, {
        logtoId: "officer",
        authToken: "token",
        id: "constitutions:1",
      }),
    ).resolves.toBe(document);

    expect(order).toEqual(["auth", "read"]);
    expect(requireOfficerAccess).toHaveBeenCalledWith(ctx, "officer", "token");
    expect(Object.keys(asQuery(get).args).sort()).toEqual([
      "authToken",
      "id",
      "logtoId",
    ]);
  });

  it("does not read a constitution by id when officer access fails", async () => {
    requireOfficerAccess.mockRejectedValue(
      new Error("Insufficient permissions: officer access required"),
    );
    const ctx = { db: { get: vi.fn() } };

    await expect(
      asQuery(get).handler(ctx, {
        logtoId: "member",
        authToken: "token",
        id: "constitutions:1",
      }),
    ).rejects.toThrow(/officer access required/);

    expect(ctx.db.get).not.toHaveBeenCalled();
  });

  it("requires officer access before loading a constitution by title", async () => {
    requireOfficerAccess.mockResolvedValue({ role: "Executive Officer" });
    const document = { title: "IEEE at UC San Diego Constitution" };
    const first = vi.fn(async () => document);
    const ctx = {
      db: {
        query: vi.fn(() => ({
          filter: () => ({ first }),
        })),
      },
    };

    await expect(
      asQuery(getByTitle).handler(ctx, {
        logtoId: "officer",
        authToken: "token",
        title: document.title,
      }),
    ).resolves.toBe(document);

    expect(requireOfficerAccess).toHaveBeenCalledWith(ctx, "officer", "token");
    expect(ctx.db.query).toHaveBeenCalledWith("constitutions");
  });

  it("does not scan constitutions by title when officer access fails", async () => {
    requireOfficerAccess.mockRejectedValue(
      new Error("Insufficient permissions: officer access required"),
    );
    const ctx = { db: { query: vi.fn() } };

    await expect(
      asQuery(getByTitle).handler(ctx, {
        logtoId: "anon",
        authToken: "nope",
        title: "IEEE at UC San Diego Constitution",
      }),
    ).rejects.toThrow(/officer access required/);

    expect(ctx.db.query).not.toHaveBeenCalled();
  });

  it("requires admin access before reading the audit log", async () => {
    const order: string[] = [];
    requireAdminAccess.mockImplementation(async () => {
      order.push("auth");
      return { role: "Administrator" };
    });
    const ctx = {
      db: {
        query: vi.fn((table: string) => {
          order.push(table);
          if (table === "constitutionAuditLogs") {
            return {
              withIndex: () => ({
                first: async () => ({
                  entries: [{ userId: "logto|1", userName: "Unknown User" }],
                }),
              }),
            };
          }
          return {
            withIndex: () => ({
              first: async () => ({ name: "Ada Lovelace", email: "ada@ieee.org" }),
            }),
          };
        }),
      },
    };

    await expect(
      asQuery(getAuditLog).handler(ctx, {
        logtoId: "admin",
        authToken: "token",
        constitutionId: "constitutions:1",
      }),
    ).resolves.toEqual([
      { userId: "logto|1", userName: "Ada Lovelace" },
    ]);

    expect(order[0]).toBe("auth");
    expect(requireAdminAccess).toHaveBeenCalledWith(ctx, "admin", "token");
    expect(Object.keys(asQuery(getAuditLog).args).sort()).toEqual([
      "authToken",
      "constitutionId",
      "logtoId",
    ]);
  });

  it("does not read audit entries when admin access fails", async () => {
    requireAdminAccess.mockRejectedValue(
      new Error("Insufficient permissions: admin access required"),
    );
    const ctx = { db: { query: vi.fn() } };

    await expect(
      asQuery(getAuditLog).handler(ctx, {
        logtoId: "officer",
        authToken: "token",
        constitutionId: "constitutions:1",
      }),
    ).rejects.toThrow(/admin access required/);

    expect(ctx.db.query).not.toHaveBeenCalled();
  });
});
