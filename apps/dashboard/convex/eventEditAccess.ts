import { hasOfficerAccess, type UserRole } from "./permissions";

const EDITABLE_EVENT_STATUSES = [
  "draft",
  "submitted",
  "pending",
  "needs_review",
] as const;

export type EventEditor = {
  role: UserRole;
  logtoId?: string | null;
  authUserId?: string | null;
};

export type EditableEvent = {
  requestedUser?: string | null;
  status?: string | null;
};

/**
 * Edit gate shared by `events.update` and `events.appendGraphicsFile`.
 * Officers can edit any event. Everyone else can edit only their own
 * event, and only while it is still in an editable status.
 */
export class EventEditAccess {
  static editorId(user: EventEditor): string {
    return user.logtoId ?? user.authUserId ?? "";
  }

  static denialReason(user: EventEditor, event: EditableEvent): string | null {
    if (hasOfficerAccess(user.role)) return null;
    if (
      event.requestedUser &&
      event.requestedUser !== EventEditAccess.editorId(user)
    ) {
      return "You can only edit your own events";
    }
    if (
      event.status &&
      !EDITABLE_EVENT_STATUSES.includes(
        event.status as (typeof EDITABLE_EVENT_STATUSES)[number],
      )
    ) {
      return "Cannot edit an event that has already been approved or declined";
    }
    return null;
  }

  static assertCanEdit(user: EventEditor, event: EditableEvent): void {
    const reason = EventEditAccess.denialReason(user, event);
    if (reason) throw new Error(reason);
  }
}
