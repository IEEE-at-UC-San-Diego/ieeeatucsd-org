import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_generated/server", () => ({
  query: (definition: unknown) => definition,
  mutation: (definition: unknown) => definition,
}));

vi.mock("./permissions", () => ({
  requireAdminAccess: vi.fn(),
}));

import { create } from "./googleGroupAssignments";

const SECRET = "server-secret";

type MutationHandler = {
  handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
};

function asMutation(value: unknown): MutationHandler {
  return value as MutationHandler;
}

const assignment = {
  email: "person@ucsd.edu",
  googleGroup: "executiveofficers@ieeeatucsd.org",
  role: "Executive Officer",
  success: true,
};

describe("google group assignment audit writes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not insert a row when the caller omits the server secret", async () => {
    vi.stubEnv("CONVEX_SESSION_SECRET", SECRET);
    const insert = vi.fn();

    await expect(
      asMutation(create).handler({ db: { insert } }, assignment),
    ).rejects.toThrow(/Unauthorized/);

    expect(insert).not.toHaveBeenCalled();
  });

  it("does not insert a row when the server secret is wrong", async () => {
    vi.stubEnv("CONVEX_SESSION_SECRET", SECRET);
    const insert = vi.fn();

    await expect(
      asMutation(create).handler(
        { db: { insert } },
        { ...assignment, serverSecret: "wrong-secret" },
      ),
    ).rejects.toThrow(/Unauthorized/);

    expect(insert).not.toHaveBeenCalled();
  });

  it("does not insert a row when the deployment has no server secret", async () => {
    vi.stubEnv("CONVEX_SESSION_SECRET", "");
    const insert = vi.fn();

    await expect(
      asMutation(create).handler(
        { db: { insert } },
        { ...assignment, serverSecret: SECRET },
      ),
    ).rejects.toThrow(/Unauthorized/);

    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts the audit row when the server secret matches", async () => {
    vi.stubEnv("CONVEX_SESSION_SECRET", SECRET);
    const insert = vi.fn(async () => "assignment-id");

    await expect(
      asMutation(create).handler(
        { db: { insert } },
        {
          ...assignment,
          serverSecret: SECRET,
          googleGroup: "generalofficers@ieeeatucsd.org",
          role: "General Officer",
        },
      ),
    ).resolves.toBe("assignment-id");

    expect(insert).toHaveBeenCalledWith(
      "googleGroupAssignments",
      expect.objectContaining({
        email: "person@ucsd.edu",
        googleGroup: "generalofficers@ieeeatucsd.org",
        role: "General Officer",
        success: true,
      }),
    );
  });
});
