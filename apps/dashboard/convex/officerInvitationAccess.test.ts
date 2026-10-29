import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import { OfficerInvitationAccess } from "./officerInvitationAccess";

const INVITE_ID = "invite_1" as Id<"officerInvitations">;

const SESSION_SECRET = "test-convex-session-secret";

async function mintSessionToken(sub: string, email?: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub, email, iat: now, exp: now + 300, v: 1 };
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

function createMockDb(seed: {
  users?: Record<string, unknown>[];
  invitations?: Record<string, unknown>[];
} = {}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    users: [...(seed.users ?? [])],
    officerInvitations: [...(seed.invitations ?? [])],
  };
  let nextId = 1;

  const filterRows = (table: string, field: string, value: unknown) =>
    (tables[table] ?? []).filter((row) => row[field] === value);

  return {
    query: (table: string) => ({
      withIndex(
        _name: string,
        builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
      ) {
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
        };
      },
    }),
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

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    _id: INVITE_ID,
    name: "Alex Officer",
    email: "alex@ucsd.edu",
    role: "General Officer",
    position: "Project Lead",
    offeredPositions: ["Project Lead"],
    status: "pending",
    invitedBy: "logto|admin",
    invitedAt: Date.now() - 60_000,
    expiresAt: Date.now() + 86_400_000,
    message: "Welcome",
    ...overrides,
  };
}

function memberUser(overrides: Record<string, unknown> = {}) {
  return {
    _id: "users_alex",
    logtoId: "logto|alex",
    email: "alex@ucsd.edu",
    name: "Alex Officer",
    role: "Member",
    status: "active",
    signedUp: true,
    ...overrides,
  };
}

function ctxFrom(
  db: ReturnType<typeof createMockDb>,
  identity: { subject: string; email: string } | null = null,
) {
  return {
    db,
    auth: {
      getUserIdentity: async () => identity,
    },
  };
}

describe("OfficerInvitationAccess.emailsMatch", () => {
  it("treats invitation emails as case-insensitive", () => {
    expect(
      OfficerInvitationAccess.emailsMatch("Alex@UCSD.edu", "alex@ucsd.edu"),
    ).toBe(true);
    expect(
      OfficerInvitationAccess.emailsMatch("alex@ucsd.edu", "other@ucsd.edu"),
    ).toBe(false);
    expect(OfficerInvitationAccess.emailsMatch("", "alex@ucsd.edu")).toBe(false);
  });
});

describe("OfficerInvitationAccess.accept", () => {
  beforeEach(() => {
    process.env.CONVEX_SESSION_SECRET = SESSION_SECRET;
  });

  afterEach(() => {
    delete process.env.CONVEX_SESSION_SECRET;
  });

  it("rejects a caller with no credentials", async () => {
    const db = createMockDb({ invitations: [invitation()] });
    await expect(
      OfficerInvitationAccess.accept(ctxFrom(db) as never, {
        id: INVITE_ID,
        logtoId: "",
        authToken: "",
      }),
    ).rejects.toThrow(OfficerInvitationAccess.AUTH_REQUIRED);
    expect(db._tables.officerInvitations[0]?.status).toBe("pending");
  });

  it("prefers the verified session email over a stored email that matches the invitation", async () => {
    const db = createMockDb({
      invitations: [invitation()],
      users: [memberUser()],
    });
    const authToken = await mintSessionToken("logto|alex", "other@ucsd.edu");

    await expect(
      OfficerInvitationAccess.accept(ctxFrom(db) as never, {
        id: INVITE_ID,
        logtoId: "logto|alex",
        authToken,
      }),
    ).rejects.toThrow(OfficerInvitationAccess.EMAIL_MISMATCH);
    expect(db._tables.officerInvitations[0]?.status).toBe("pending");
    expect(db._tables.users[0]?.role).toBe("Member");
    expect(db._tables.users[0]?.email).toBe("alex@ucsd.edu");
  });

  it("rejects a valid session whose email does not match the invitation", async () => {
    const db = createMockDb({
      invitations: [invitation()],
      users: [
        memberUser({
          _id: "users_intruder",
          logtoId: "logto|intruder",
          email: "intruder@ucsd.edu",
        }),
      ],
    });
    const authToken = await mintSessionToken("logto|intruder");

    await expect(
      OfficerInvitationAccess.accept(ctxFrom(db) as never, {
        id: INVITE_ID,
        logtoId: "logto|intruder",
        authToken,
      }),
    ).rejects.toThrow(OfficerInvitationAccess.EMAIL_MISMATCH);
    expect(db._tables.officerInvitations[0]?.status).toBe("pending");
    expect(db._tables.users[0]?.role).toBe("Member");
  });

  it("rejects a forged HMAC token before granting the role", async () => {
    const db = createMockDb({
      invitations: [invitation()],
      users: [memberUser()],
    });

    await expect(
      OfficerInvitationAccess.accept(ctxFrom(db) as never, {
        id: INVITE_ID,
        logtoId: "logto|alex",
        authToken: "forged.payload",
      }),
    ).rejects.toThrow();
    expect(db._tables.officerInvitations[0]?.status).toBe("pending");
    expect(db._tables.users[0]?.role).toBe("Member");
  });

  it("lets the invited member accept and receive the offered role", async () => {
    const db = createMockDb({
      invitations: [invitation()],
      users: [memberUser()],
    });
    const authToken = await mintSessionToken("logto|alex");

    const result = await OfficerInvitationAccess.accept(ctxFrom(db) as never, {
      id: INVITE_ID,
      logtoId: "logto|alex",
      authToken,
    });

    expect(result.status).toBe("accepted");
    expect(result.roleGranted).toBe(true);
    expect(result.position).toBe("Project Lead");
    expect(db._tables.officerInvitations[0]?.status).toBe("accepted");
    expect(db._tables.users[0]?.role).toBe("General Officer");
    expect(db._tables.users[0]?.position).toBe("Project Lead");
  });

  it("lets a Convex-native identity with the invitation email accept", async () => {
    const db = createMockDb({
      invitations: [invitation()],
    });

    const result = await OfficerInvitationAccess.accept(
      ctxFrom(db, {
        subject: "logto|alex",
        email: "Alex@UCSD.edu",
      }) as never,
      {
        id: INVITE_ID,
        logtoId: "logto|alex",
        authToken: "unused-when-native",
        selectedPosition: "Project Lead",
      },
    );

    expect(result.status).toBe("accepted");
    expect(result.roleGranted).toBe(true);
    expect(db._tables.users[0]?.email).toBe("alex@ucsd.edu");
    expect(db._tables.users[0]?.role).toBe("General Officer");
  });

  it("creates a user for a first-time invitee whose session email matches", async () => {
    const db = createMockDb({
      invitations: [invitation()],
    });
    const authToken = await mintSessionToken("logto|alex", "Alex@UCSD.edu");

    const result = await OfficerInvitationAccess.accept(ctxFrom(db) as never, {
      id: INVITE_ID,
      logtoId: "logto|alex",
      authToken,
    });

    expect(result.status).toBe("accepted");
    expect(result.roleGranted).toBe(true);
    expect(result.userCreatedOrUpdated).toBe(true);
    expect(db._tables.users).toHaveLength(1);
    expect(db._tables.users[0]?.email).toBe("alex@ucsd.edu");
    expect(db._tables.users[0]?.logtoId).toBe("logto|alex");
    expect(db._tables.users[0]?.role).toBe("General Officer");
  });

  it("accepts an invitation sent to a newly verified email when the stored email is stale", async () => {
    const db = createMockDb({
      invitations: [invitation({ email: "alex.new@ucsd.edu" })],
      users: [memberUser({ email: "alex.old@ucsd.edu" })],
    });
    const authToken = await mintSessionToken("logto|alex", "alex.new@ucsd.edu");

    const result = await OfficerInvitationAccess.accept(ctxFrom(db) as never, {
      id: INVITE_ID,
      logtoId: "logto|alex",
      authToken,
    });

    expect(result.status).toBe("accepted");
    expect(result.roleGranted).toBe(true);
    expect(db._tables.users).toHaveLength(1);
    expect(db._tables.users[0]?._id).toBe("users_alex");
    expect(db._tables.users[0]?.email).toBe("alex.new@ucsd.edu");
    expect(db._tables.users[0]?.logtoId).toBe("logto|alex");
    expect(db._tables.users[0]?.role).toBe("General Officer");
    expect(db._tables.users[0]?.position).toBe("Project Lead");
    expect(db._tables.officerInvitations[0]?.status).toBe("accepted");
  });

  it("rejects a first-time invitee whose session has no matching email", async () => {
    const db = createMockDb({
      invitations: [invitation()],
    });
    const authToken = await mintSessionToken("logto|alex");

    await expect(
      OfficerInvitationAccess.accept(ctxFrom(db) as never, {
        id: INVITE_ID,
        logtoId: "logto|alex",
        authToken,
      }),
    ).rejects.toThrow(OfficerInvitationAccess.EMAIL_MISMATCH);
    expect(db._tables.officerInvitations[0]?.status).toBe("pending");
    expect(db._tables.users).toHaveLength(0);
  });

  it("rejects a native identity whose email does not match", async () => {
    const db = createMockDb({ invitations: [invitation()] });

    await expect(
      OfficerInvitationAccess.accept(
        ctxFrom(db, {
          subject: "logto|alex",
          email: "other@ucsd.edu",
        }) as never,
        {
          id: INVITE_ID,
          logtoId: "logto|alex",
          authToken: "unused-when-native",
        },
      ),
    ).rejects.toThrow(OfficerInvitationAccess.EMAIL_MISMATCH);
    expect(db._tables.officerInvitations[0]?.status).toBe("pending");
    expect(db._tables.users).toHaveLength(0);
  });
});

describe("OfficerInvitationAccess.decline", () => {
  beforeEach(() => {
    process.env.CONVEX_SESSION_SECRET = SESSION_SECRET;
  });

  afterEach(() => {
    delete process.env.CONVEX_SESSION_SECRET;
  });

  it("rejects decline without a matching authenticated email", async () => {
    const db = createMockDb({
      invitations: [invitation()],
      users: [
        memberUser({
          logtoId: "logto|intruder",
          email: "intruder@ucsd.edu",
        }),
      ],
    });
    const authToken = await mintSessionToken("logto|intruder");

    await expect(
      OfficerInvitationAccess.decline(ctxFrom(db) as never, {
        id: INVITE_ID,
        logtoId: "logto|intruder",
        authToken,
      }),
    ).rejects.toThrow(OfficerInvitationAccess.EMAIL_MISMATCH);
    expect(db._tables.officerInvitations[0]?.status).toBe("pending");
  });

  it("declines an invitation sent to a newly verified email when the stored email is stale", async () => {
    const db = createMockDb({
      invitations: [invitation({ email: "alex.new@ucsd.edu" })],
      users: [memberUser({ email: "alex.old@ucsd.edu" })],
    });
    const authToken = await mintSessionToken("logto|alex", "alex.new@ucsd.edu");

    const result = await OfficerInvitationAccess.decline(ctxFrom(db) as never, {
      id: INVITE_ID,
      logtoId: "logto|alex",
      authToken,
    });

    expect(result.status).toBe("declined");
    expect(db._tables.officerInvitations[0]?.status).toBe("declined");
    expect(db._tables.users).toHaveLength(1);
    expect(db._tables.users[0]?.email).toBe("alex.old@ucsd.edu");
    expect(db._tables.users[0]?.role).toBe("Member");
  });

  it("lets the invited member decline", async () => {
    const db = createMockDb({
      invitations: [invitation()],
      users: [memberUser()],
    });
    const authToken = await mintSessionToken("logto|alex");

    const result = await OfficerInvitationAccess.decline(ctxFrom(db) as never, {
      id: INVITE_ID,
      logtoId: "logto|alex",
      authToken,
    });

    expect(result.status).toBe("declined");
    expect(db._tables.officerInvitations[0]?.status).toBe("declined");
    expect(db._tables.users[0]?.role).toBe("Member");
  });
});
