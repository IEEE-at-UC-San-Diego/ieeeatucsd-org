import { hasOfficerAccess } from "./permissions";
import { EventReadAccess, type EventDocumentViewer } from "./eventReadAccess";

export type EventStorageInvoice = {
  invoiceFile?: string | null;
  additionalFiles?: string[] | null;
};

/**
 * File fields that hold Convex storage ids for an event.
 * Free-text notes and audit logs are not attachments.
 */
export type EventStorageSource = {
  requestedUser?: string | null;
  files?: string[] | null;
  roomBookingFiles?: string[] | null;
  graphicsFiles?: string[] | null;
  invoices?: EventStorageInvoice[] | null;
};

/**
 * `events.getStorageUrl` may only resolve a storage id that is attached to
 * an event the caller may see: the event requester, or an officer
 * (`hasOfficerAccess`).
 */
export class EventStorageAccess {
  static attachedStorageIds(event: EventStorageSource): Set<string> {
    const ids = new Set<string>();
    const add = (value?: string | null) => {
      if (typeof value === "string" && value.length > 0) ids.add(value);
    };
    for (const id of event.files ?? []) add(id);
    for (const id of event.roomBookingFiles ?? []) add(id);
    for (const id of event.graphicsFiles ?? []) add(id);
    for (const invoice of event.invoices ?? []) {
      add(invoice?.invoiceFile);
      for (const id of invoice?.additionalFiles ?? []) add(id);
    }
    return ids;
  }

  static canReadEventFiles(
    user: EventDocumentViewer,
    event: { requestedUser?: string | null },
  ): boolean {
    if (EventReadAccess.isRequester(user, event)) return true;
    return hasOfficerAccess(user.role);
  }

  static canReadStorageId(
    user: EventDocumentViewer,
    events: EventStorageSource[],
    storageId: string,
  ): boolean {
    if (!storageId) return false;
    return events.some(
      (event) =>
        EventStorageAccess.attachedStorageIds(event).has(storageId) &&
        EventStorageAccess.canReadEventFiles(user, event),
    );
  }
}
