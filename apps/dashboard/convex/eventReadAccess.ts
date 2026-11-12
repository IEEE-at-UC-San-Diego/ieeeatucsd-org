import {
  hasOfficerAccess,
  hasVcoViewAccess,
  type UserRole,
} from "./permissions";
import {
  PublicPublishedEvent,
  type PublicPublishedEventSource,
} from "./publicPublishedEvent";

export type EventDocumentViewer = {
  role: UserRole;
  position?: string | null;
  logtoId?: string | null;
  authUserId?: string | null;
};

type RequestedEvent = {
  requestedUser?: string | null;
};

/**
 * Read gate for `events.get` and `events.getByCode`.
 *
 * Published ids and check-in codes are already shared, so those queries
 * cannot return the stored document to every signed-in user. Invoices and
 * VCO funding fields stay on the document for the requester and for officers
 * or admins who can already view or manage funding.
 */
export class EventReadAccess {
  static isRequester(
    user: EventDocumentViewer,
    event: RequestedEvent,
  ): boolean {
    const requestedUser = event.requestedUser;
    if (!requestedUser) return false;
    if (user.logtoId && user.logtoId === requestedUser) return true;
    return Boolean(user.authUserId && user.authUserId === requestedUser);
  }

  /**
   * Full document: the event requester, VCO funding viewers
   * (`hasVcoViewAccess`), and officers/admins who manage funding tools
   * (`hasOfficerAccess`: fund requests, deposits, and event invoices).
   */
  static canReadFullDocument(
    user: EventDocumentViewer,
    event: RequestedEvent,
  ): boolean {
    if (EventReadAccess.isRequester(user, event)) return true;
    if (hasVcoViewAccess(user.role, user.position)) return true;
    return hasOfficerAccess(user.role);
  }

  static forViewer<T extends PublicPublishedEventSource & RequestedEvent>(
    user: EventDocumentViewer,
    event: T | null,
  ): T | PublicPublishedEventSource | null {
    if (!event) return null;
    if (EventReadAccess.canReadFullDocument(user, event)) return event;
    return PublicPublishedEvent.publicFields(event);
  }
}
