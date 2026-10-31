import { EventEditAccess, type EventEditor } from "./eventEditAccess";
import type { EventDocumentViewer } from "./eventReadAccess";
import {
  EventStorageAccess,
  type EventStorageSource,
} from "./eventStorageAccess";

export const GRAPHICS_ATTACH_DENIED =
  "You can only attach files you uploaded or can already view";

/**
 * A graphics storage id may be saved only when this caller uploaded it
 * or can already resolve it through `events.getStorageUrl`.
 */
export class EventGraphicsAttachment {
  static addedIds(
    current: readonly string[] | null | undefined,
    next: readonly string[],
  ): string[] {
    const existing = new Set(
      (current ?? []).map((id) => id.trim()).filter((id) => id.length > 0),
    );
    const added: string[] = [];
    for (const raw of next) {
      const id = raw.trim();
      if (!id) {
        throw new Error("Storage file is missing");
      }
      if (!existing.has(id) && !added.includes(id)) added.push(id);
    }
    return added;
  }

  static canAttach(
    user: EventDocumentViewer,
    events: readonly EventStorageSource[],
    storageId: string,
    uploadedStorageIds: ReadonlySet<string>,
  ): boolean {
    const id = storageId.trim();
    if (!id) return false;
    if (EventStorageAccess.canReadStorageId(user, [...events], id)) return true;
    return uploadedStorageIds.has(id);
  }

  static assertCanAttach(
    user: EventDocumentViewer,
    events: readonly EventStorageSource[],
    storageId: string,
    uploadedStorageIds: ReadonlySet<string>,
  ): void {
    if (
      !EventGraphicsAttachment.canAttach(
        user,
        events,
        storageId,
        uploadedStorageIds,
      )
    ) {
      throw new Error(GRAPHICS_ATTACH_DENIED);
    }
  }

  /**
   * Edit permission stays in front of the file check. A failed edit does
   * not attach the id, so `getStorageUrl` cannot start resolving it.
   */
  static assertCanAppend(
    user: EventEditor & EventDocumentViewer,
    event: { requestedUser?: string | null; status?: string | null },
    events: readonly EventStorageSource[],
    currentGraphicsFiles: readonly string[] | null | undefined,
    storageId: string,
    uploadedStorageIds: ReadonlySet<string>,
  ): void {
    EventEditAccess.assertCanEdit(user, event);
    const id = storageId.trim();
    if (!id) throw new Error("Storage file is missing");
    if (
      (currentGraphicsFiles ?? []).some((existing) => existing.trim() === id)
    ) {
      return;
    }
    EventGraphicsAttachment.assertCanAttach(
      user,
      events,
      id,
      uploadedStorageIds,
    );
  }
}

/**
 * Ownership is recorded only for a file whose checksum matches an upload
 * grant this caller created, and never for a file already stored on an
 * event they cannot view.
 */
export class StorageUploadClaim {
  static normalizeSha256(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(normalized)) {
      throw new Error(GRAPHICS_ATTACH_DENIED);
    }
    return normalized;
  }

  static allow(input: {
    callerId: string;
    metadataSha256: string | null;
    grantSha256: string | null;
    existingOwnerId: string | null;
    attachedWhereCallerCannotRead: boolean;
  }): boolean {
    if (!input.callerId || !input.metadataSha256) return false;
    if (input.existingOwnerId && input.existingOwnerId !== input.callerId) {
      return false;
    }
    if (input.existingOwnerId === input.callerId) return true;
    if (input.attachedWhereCallerCannotRead) return false;
    return (
      Boolean(input.grantSha256) && input.grantSha256 === input.metadataSha256
    );
  }
}
