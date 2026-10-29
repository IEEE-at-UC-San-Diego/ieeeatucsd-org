import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LogtoIdentity } from "./logtoIdentity";
import { UserAuth } from "./userAuth";

const SESSION_SECRET = "test-convex-session-secret";

async function mintSessionToken(sub: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub, iat: now, exp: now + 300, v: 1 };
  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encodedPayload),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${encodedPayload}.${hex}`;
}

function createMockDb(seedUsers: Record<string, unknown>[] = []) {
  const tables: Record<string, Record<string, unknown>[]> = {
    users: [...seedUsers],
    sponsorDomains: [],
    officerInvitations: [],
  };
  let nextId = 1;

  const filterRows = (table: string, field: string, value: unknown) =>
    (tables[table] ?? []).filter((row) => row[field] === value);

  const queryHandle = (table: string) => ({
    withIndex(_name: string, builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown) {
      let field = "";
      let value: unknown;
      builder({
        eq: (nextField, nextValue) => {
          field = nextField;
          value = nextValue;
          return { field, value };
        },
      });
      const matched = filterRows(table, field, value);
      return {
        first: async () => matched[0] ?? null,
        collect: async () => matched,
        filter: (predicate: (q: {
          eq: (left: unknown, right: unknown) => boolean;
          field: (name: string) => string;
        }) => boolean) => {
          const filtered = matched.filter((row) =>
            predicate({
              eq: (left, right) => left === right,
              field: (name) => row[name] as string,
            }),
          );
          return {
            first: async () => filtered[0] ?? null,
          };
        },
      };
    },
  });

  return {
    query: (table: string) => queryHandle(table),
    insert: async (table: string, doc: Record<string, unknown>) => {
      const _id = `${table}_${nextId++}`;
      tables[table].push({ ...doc, _id, _creationTime: Date.now() });
      return _id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      const table = Object.values(tables).find((rows) =>
        rows.some((row) => row._id === id),
      );
      const row = table?.find((entry) => entry._id === id);
      if (row) Object.assign(row, patch);
    },
    get: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const row = rows.find((entry) => entry._id === id);
        if (row) return row;
      }
      return null;
    },
    _tables: tables,
  };
}

function memberUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: "users_alice",
    logtoId: "logto|alice",
    email: "alice@example.com",
    name: "Alice",
    role: "Member",
    status: "active",
    signedUp: true,
    zelleInformation: "alice-zelle-secret",
    pid: "A12345678",
    resume: { storageId: "storage_1", fileName: "alice.pdf" },
    ...overrides,
  };
}

function officerUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: "users_officer",
    logtoId: "logto|officer",
    email: "officer@example.com",
    name: "Officer",
    role: "General Officer",
    status: "active",
    signedUp: true,
    ...overrides,
  };
}

describe("UserAuth.upsertFromAuth", () => {
  beforeEach(() => {
    LogtoIdentity.clearCache();
  });

  afterEach(() => {
    LogtoIdentity.clearCache();
    LogtoIdentity.fetchImpl = fetch;
  });

  it("rejects unauthenticated calls", async () => {
    const persist = vi.fn();
    await expect(
      UserAuth.upsertFromAuth(
        { auth: { getUserIdentity: async () => null } },
        { authToken: "" },
        persist,
      ),
    ).rejects.toThrow("Authentication required");
    expect(persist).not.toHaveBeenCalled();
  });

  it("rejects forged JWT calls", async () => {
    process.env.LOGTO_ENDPOINT = "https://auth.example.com";
    process.env.LOGTO_APP_ID = "logto-app-id";
    LogtoIdentity.fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ keys: [] }), { status: 200 });
    }) as typeof fetch;

    const persist = vi.fn();
    await expect(
      UserAuth.upsertFromAuth(
        { auth: { getUserIdentity: async () => null } },
        { authToken: "aaa.bbb.ccc" },
        persist,
      ),
    ).rejects.toThrow();
    expect(persist).not.toHaveBeenCalled();

    delete process.env.LOGTO_ENDPOINT;
    delete process.env.LOGTO_APP_ID;
  });

  it("upserts only the verified identity, ignoring leftover client identity fields", async () => {
    const persist = vi.fn(async (verified) => verified);
    const result = await UserAuth.upsertFromAuth(
      {
        auth: {
          getUserIdentity: async () =>
            ({
              subject: "logto|verified",
              email: "verified@example.com",
              name: "Verified User",
            }) as never,
        },
      },
      {
        authToken: "client-supplied-token",
        name: "Attacker Name",
      },
      persist,
    );

    expect(persist).toHaveBeenCalledWith({
      logtoId: "logto|verified",
      email: "verified@example.com",
      name: "Verified User",
      avatar: undefined,
      signInMethod: undefined,
    });
    expect(result).toMatchObject({
      logtoId: "logto|verified",
      email: "verified@example.com",
    });
  });

  it("writes the verified subject and email into the user record", async () => {
    const db = createMockDb();
    const result = await UserAuth.applyVerifiedAuthUpsert(
      { db } as never,
      {
        logtoId: "logto|verified",
        email: "verified@example.com",
        name: "Verified User",
        signInMethod: "logto",
      },
    );

    const stored = db._tables.users[0];
    expect(stored.logtoId).toBe("logto|verified");
    expect(stored.email).toBe("verified@example.com");
    expect(stored.name).toBe("Verified User");
    expect(result.signedUp).toBe(false);
    expect(result.role).toBe("Member");
  });
});

describe("users public query surface", () => {
  it("does not export an unauthenticated getUserInfo lookup", async () => {
    const usersModule = await import("./users");
    expect(usersModule).not.toHaveProperty("getUserInfo");
  });
});

describe("UserAuth.getByLogtoId", () => {
  beforeEach(() => {
    process.env.CONVEX_SESSION_SECRET = SESSION_SECRET;
  });

  afterEach(() => {
    delete process.env.CONVEX_SESSION_SECRET;
  });

  it("rejects unauthenticated callers", async () => {
    const db = createMockDb([memberUser()]);
    await expect(
      UserAuth.getByLogtoId(
        {
          db,
          auth: { getUserIdentity: async () => null },
        } as never,
        { logtoId: "logto|alice", authToken: "" },
      ),
    ).rejects.toThrow("Missing auth token");
  });

  it("rejects a forged HMAC token", async () => {
    const db = createMockDb([memberUser()]);
    await expect(
      UserAuth.getByLogtoId(
        {
          db,
          auth: { getUserIdentity: async () => null },
        } as never,
        { logtoId: "logto|alice", authToken: "forged.payload" },
      ),
    ).rejects.toThrow();
  });

  it("returns the caller's own record", async () => {
    const alice = memberUser();
    const db = createMockDb([alice]);
    const authToken = await mintSessionToken("logto|alice");

    const result = await UserAuth.getByLogtoId(
      {
        db,
        auth: { getUserIdentity: async () => null },
      } as never,
      { logtoId: "logto|alice", authToken },
    );

    expect(result).toMatchObject({
      logtoId: "logto|alice",
      email: "alice@example.com",
      zelleInformation: "alice-zelle-secret",
    });
  });

  it("does not let a member read another user's record", async () => {
    const db = createMockDb([
      memberUser(),
      memberUser({
        _id: "users_bob",
        logtoId: "logto|bob",
        email: "bob@example.com",
        name: "Bob",
        zelleInformation: "bob-zelle-secret",
      }),
    ]);
    const authToken = await mintSessionToken("logto|alice");

    await expect(
      UserAuth.getByLogtoId(
        {
          db,
          auth: { getUserIdentity: async () => null },
        } as never,
        {
          logtoId: "logto|alice",
          authToken,
          targetLogtoId: "logto|bob",
        },
      ),
    ).rejects.toThrow("cannot read another user's record");
  });

  it("lets an officer read another user without sensitive fields", async () => {
    const db = createMockDb([
      officerUser(),
      memberUser({
        _id: "users_bob",
        logtoId: "logto|bob",
        email: "bob@example.com",
        name: "Bob",
      }),
    ]);
    const authToken = await mintSessionToken("logto|officer");

    const result = await UserAuth.getByLogtoId(
      {
        db,
        auth: { getUserIdentity: async () => null },
      } as never,
      {
        logtoId: "logto|officer",
        authToken,
        targetLogtoId: "logto|bob",
      },
    );

    expect(result).toMatchObject({
      logtoId: "logto|bob",
      name: "Bob",
      email: "bob@example.com",
    });
    expect(result).not.toHaveProperty("zelleInformation");
    expect(result).not.toHaveProperty("pid");
    expect(result).not.toHaveProperty("resume");
  });
});
