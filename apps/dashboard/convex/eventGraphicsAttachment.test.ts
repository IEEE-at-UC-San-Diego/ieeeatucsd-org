import { describe, expect, it } from "vitest";
import {
  EventGraphicsAttachment,
  GRAPHICS_ATTACH_DENIED,
  STORAGE_UPLOAD_GRANT_TTL_MS,
  StorageUploadClaim,
} from "./eventGraphicsAttachment";
import {
  EventStorageAccess,
  type EventStorageSource,
} from "./eventStorageAccess";
import type { EventDocumentViewer } from "./eventReadAccess";
import type { UserRole } from "./permissions";

const FOREIGN_ID = "storage_foreign";
const OWN_UPLOAD_ID = "storage_uploaded";
const OWN_INVOICE_ID = "storage_invoice";

function viewer(
  role: UserRole,
  overrides: Partial<EventDocumentViewer> = {},
): EventDocumentViewer {
  return { role, logtoId: `logto|${role}`, ...overrides };
}

const member = viewer("Member", { logtoId: "logto|member" });

const hiddenEvent: EventStorageSource = {
  requestedUser: "logto|someone-else",
  graphicsFiles: [FOREIGN_ID],
};

const ownEvent: EventStorageSource = {
  requestedUser: "logto|member",
  graphicsFiles: [],
  invoices: [{ invoiceFile: OWN_INVOICE_ID, additionalFiles: [] }],
};

describe("EventGraphicsAttachment", () => {
  it("rejects a foreign id on append and leaves getStorageUrl denied", () => {
    expect(() =>
      EventGraphicsAttachment.assertCanAppend(
        member,
        { requestedUser: "logto|member", status: "draft" },
        [hiddenEvent, ownEvent],
        ownEvent.graphicsFiles,
        FOREIGN_ID,
        new Set(),
      ),
    ).toThrow(GRAPHICS_ATTACH_DENIED);

    expect(
      EventStorageAccess.canReadStorageId(member, [ownEvent], FOREIGN_ID),
    ).toBe(false);
  });

  it("rejects a foreign id on update.graphicsFiles and leaves getStorageUrl denied", () => {
    expect(() => {
      const added = EventGraphicsAttachment.addedIds(ownEvent.graphicsFiles, [
        FOREIGN_ID,
      ]);
      for (const storageId of added) {
        EventGraphicsAttachment.assertCanAttach(
          member,
          [hiddenEvent, ownEvent],
          storageId,
          new Set(),
        );
      }
    }).toThrow(GRAPHICS_ATTACH_DENIED);

    expect(
      EventStorageAccess.canReadStorageId(member, [ownEvent], FOREIGN_ID),
    ).toBe(false);
    expect(
      EventStorageAccess.canReadStorageId(
        member,
        [{ ...ownEvent, graphicsFiles: [FOREIGN_ID] }],
        FOREIGN_ID,
      ),
    ).toBe(true);
  });

  it("does not let a member claim a foreign file and then attach it", () => {
    const foreignChecksum = "a".repeat(64);
    expect(
      StorageUploadClaim.allow({
        callerId: "logto|member",
        metadataSha256: foreignChecksum,
        grantSha256: null,
        existingOwnerId: "logto|someone-else",
        attachedWhereCallerCannotRead: true,
      }),
    ).toBe(false);
    expect(
      StorageUploadClaim.allow({
        callerId: "logto|member",
        metadataSha256: foreignChecksum,
        grantSha256: foreignChecksum,
        existingOwnerId: null,
        attachedWhereCallerCannotRead: true,
      }),
    ).toBe(false);

    expect(
      EventGraphicsAttachment.canAttach(
        member,
        [hiddenEvent, ownEvent],
        FOREIGN_ID,
        new Set(),
      ),
    ).toBe(false);
    expect(
      EventStorageAccess.canReadStorageId(member, [ownEvent], FOREIGN_ID),
    ).toBe(false);
  });

  it("lets a member attach a file they uploaded and then resolve it", () => {
    expect(
      StorageUploadClaim.allow({
        callerId: "logto|member",
        metadataSha256: "b".repeat(64),
        grantSha256: "b".repeat(64),
        grantCreatedAt: 1_000,
        now: 1_000,
        existingOwnerId: null,
        attachedWhereCallerCannotRead: false,
      }),
    ).toBe(true);

    EventGraphicsAttachment.assertCanAppend(
      member,
      { requestedUser: "logto|member", status: "submitted" },
      [hiddenEvent, ownEvent],
      [],
      OWN_UPLOAD_ID,
      new Set([OWN_UPLOAD_ID]),
    );

    const added = EventGraphicsAttachment.addedIds([], [OWN_UPLOAD_ID]);
    for (const storageId of added) {
      EventGraphicsAttachment.assertCanAttach(
        member,
        [hiddenEvent, ownEvent],
        storageId,
        new Set([OWN_UPLOAD_ID]),
      );
    }

    expect(
      EventStorageAccess.canReadStorageId(
        member,
        [{ ...ownEvent, graphicsFiles: [OWN_UPLOAD_ID] }],
        OWN_UPLOAD_ID,
      ),
    ).toBe(true);
  });

  it("lets a member attach a file they can already view", () => {
    EventGraphicsAttachment.assertCanAttach(
      member,
      [ownEvent],
      OWN_INVOICE_ID,
      new Set(),
    );
    expect(
      EventStorageAccess.canReadStorageId(member, [ownEvent], OWN_INVOICE_ID),
    ).toBe(true);
  });

  it("still blocks a member from appending onto someone else's event", () => {
    expect(() =>
      EventGraphicsAttachment.assertCanAppend(
        member,
        { requestedUser: "logto|someone-else", status: "draft" },
        [hiddenEvent, ownEvent],
        [],
        OWN_UPLOAD_ID,
        new Set([OWN_UPLOAD_ID]),
      ),
    ).toThrow("You can only edit your own events");
    expect(
      EventStorageAccess.canReadStorageId(member, [ownEvent], FOREIGN_ID),
    ).toBe(false);
  });

  it("rejects an upload grant after it expires", () => {
    const createdAt = 5_000;
    expect(
      StorageUploadClaim.allow({
        callerId: "logto|member",
        metadataSha256: "c".repeat(64),
        grantSha256: "c".repeat(64),
        grantCreatedAt: createdAt,
        now: createdAt + STORAGE_UPLOAD_GRANT_TTL_MS,
        existingOwnerId: null,
        attachedWhereCallerCannotRead: false,
      }),
    ).toBe(true);
    expect(
      StorageUploadClaim.allow({
        callerId: "logto|member",
        metadataSha256: "c".repeat(64),
        grantSha256: "c".repeat(64),
        grantCreatedAt: createdAt,
        now: createdAt + STORAGE_UPLOAD_GRANT_TTL_MS + 1,
        existingOwnerId: null,
        attachedWhereCallerCannotRead: false,
      }),
    ).toBe(false);
  });

  it("rejects an unattached id the caller did not upload", () => {
    expect(
      EventGraphicsAttachment.canAttach(
        member,
        [ownEvent],
        "storage_loose",
        new Set(),
      ),
    ).toBe(false);
    expect(
      EventGraphicsAttachment.canAttach(
        viewer("General Officer"),
        [hiddenEvent],
        "storage_loose",
        new Set(),
      ),
    ).toBe(false);
  });
});
