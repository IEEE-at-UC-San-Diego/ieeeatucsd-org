import type { UserRole } from "../../../shared/types/firestore";

interface EventRequest {
  id: string;
  status: string;
  requestedUser: string;
  [key: string]: any;
}

/**
 * Check if the current user can edit a specific event request
 */
export const canEditEvent = (
  request: EventRequest,
  currentUserId: string | undefined,
  currentUserRole: UserRole,
): boolean => {
  if (!currentUserId) return false;

  // Administrators can edit any event
  if (currentUserRole === "Administrator") return true;

  // Executive Officers can edit any event
  if (currentUserRole === "Executive Officer") return true;

  // General Officers can only edit their own events if not approved yet
  if (currentUserRole === "General Officer") {
    return (
      request.requestedUser === currentUserId &&
      ["draft", "submitted", "pending", "needs_review"].includes(request.status)
    );
  }

  // Any user (including Members) can edit their own event requests
  // but only if the status is 'submitted', 'needs_review', or 'draft'
  // This matches the Firestore security rule: allow read, update, delete if request.auth.uid == resource.data.requestedUser
  if (request.requestedUser === currentUserId) {
    return ["draft", "submitted", "needs_review"].includes(request.status);
  }

  return false;
};

/**
 * Check if the current user can delete a specific event request
 */
export const canDeleteEvent = (
  request: EventRequest,
  currentUserId: string | undefined,
  currentUserRole: UserRole,
): boolean => {
  if (!currentUserId) return false;

  // Administrators can delete any event
  if (currentUserRole === "Administrator") return true;

  // Executive Officers can delete any event
  if (currentUserRole === "Executive Officer") return true;

  // General Officers can only delete their own events if not approved yet
  if (currentUserRole === "General Officer") {
    return (
      request.requestedUser === currentUserId &&
      ["draft", "submitted", "pending", "needs_review"].includes(request.status)
    );
  }

  // Any user (including Members) can delete their own event requests
  // but only if the status is 'submitted', 'needs_review', or 'draft'
  // This matches the Firestore security rule: allow read, update, delete if request.auth.uid == resource.data.requestedUser
  if (request.requestedUser === currentUserId) {
    return ["draft", "submitted", "needs_review"].includes(request.status);
  }

  return false;
};

/**
 * Check if the current user can approve or publish events
 */
export const canApproveOrPublish = (currentUserRole: UserRole): boolean => {
  // Only Executive Officers and Administrators can approve, decline, or publish events
  return ["Executive Officer", "Administrator"].includes(currentUserRole);
};

/**
 * Check if the current user can create events
 */
export const canCreateEvent = (currentUserRole: UserRole): boolean => {
  // General Officers, Executive Officers, and Administrators can create events
  return ["General Officer", "Executive Officer", "Administrator"].includes(
    currentUserRole,
  );
};

/**
 * Check if the current user can manage graphics
 */
export const canManageGraphics = (currentUserRole: UserRole): boolean => {
  // Any officer can toggle graphics completion and upload files
  return ["General Officer", "Executive Officer", "Administrator"].includes(
    currentUserRole,
  );
};
