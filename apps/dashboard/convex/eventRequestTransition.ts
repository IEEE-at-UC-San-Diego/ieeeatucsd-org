export const EVENT_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "pending",
  "completed",
  "approved",
  "declined",
  "needs_review",
] as const;

export type EventRequestStatus = (typeof EVENT_REQUEST_STATUSES)[number];

export type EventListing = {
  status: EventRequestStatus;
  published: boolean;
  isDraft: boolean;
};

export type EventUiStatus =
  | "draft"
  | "submitted"
  | "pending"
  | "needs_review"
  | "approved"
  | "declined"
  | "published";

type CreateAction = {
  kind: "create";
  isDraft: boolean;
  published: boolean;
  canPublish: boolean;
};

type UpdateAction = {
  kind: "update";
  published: boolean | undefined;
  canPublish: boolean;
};

type SetStatusAction = {
  kind: "setStatus";
  status: EventRequestStatus;
  canReview: boolean;
  canSubmitOwnDraft: boolean;
};

export type EventRequestAction = CreateAction | UpdateAction | SetStatusAction;

const REVIEW_EDGES = new Set<string>([
  "draft->submitted",
  "draft->pending",
  "draft->needs_review",
  "draft->approved",
  "draft->declined",
  "submitted->pending",
  "submitted->needs_review",
  "submitted->approved",
  "submitted->declined",
  "submitted->draft",
  "pending->submitted",
  "pending->needs_review",
  "pending->approved",
  "pending->declined",
  "pending->draft",
  "needs_review->submitted",
  "needs_review->pending",
  "needs_review->approved",
  "needs_review->declined",
  "needs_review->draft",
  "approved->needs_review",
  "approved->declined",
  "approved->draft",
  "approved->completed",
  "completed->approved",
  "completed->declined",
  "completed->draft",
  "declined->draft",
  "declined->submitted",
]);

export function listingForStatus(status: EventRequestStatus): EventListing {
  if (status === "completed") {
    return { status, published: true, isDraft: false };
  }
  if (status === "draft") {
    return { status, published: false, isDraft: true };
  }
  return { status, published: false, isDraft: false };
}

function storedStatus(status: string | undefined): EventRequestStatus {
  if (
    status === "draft" ||
    status === "submitted" ||
    status === "pending" ||
    status === "completed" ||
    status === "approved" ||
    status === "declined" ||
    status === "needs_review"
  ) {
    return status;
  }
  return "draft";
}

export function eventRequestLabel(
  status: string | undefined,
  published: boolean | undefined,
): EventUiStatus {
  if (status === "completed") return "published";
  if (published && (status === undefined || status === "approved")) {
    return "published";
  }
  if (
    status === "draft" ||
    status === "submitted" ||
    status === "pending" ||
    status === "needs_review" ||
    status === "approved" ||
    status === "declined" ||
    status === "published"
  ) {
    return status;
  }
  return "draft";
}

function assertPublishAllowed(canPublish: boolean, listing: EventListing) {
  if (!canPublish) {
    throw new Error("A member cannot publish an event");
  }
  if (listing.status === "draft" || listing.isDraft) {
    throw new Error("A draft cannot be published");
  }
  if (listing.status !== "approved" && listing.status !== "completed") {
    throw new Error("Cannot publish an event from this status");
  }
}

export function transitionEventRequest(
  current: EventListing | null,
  action: EventRequestAction,
): EventListing {
  switch (action.kind) {
    case "create": {
      if (action.published && !action.canPublish) {
        throw new Error("A member cannot publish an event");
      }
      if (action.isDraft && action.published) {
        throw new Error("A draft cannot be published");
      }
      if (action.isDraft) return listingForStatus("draft");
      if (action.published) return listingForStatus("completed");
      return listingForStatus("submitted");
    }
    case "update": {
      if (!current) throw new Error("Event not found");
      if (action.published === undefined) return current;
      if (action.published) {
        assertPublishAllowed(action.canPublish, current);
        return listingForStatus("completed");
      }
      if (current.status === "completed") return listingForStatus("approved");
      if (current.status === "draft" || current.isDraft) {
        return listingForStatus("draft");
      }
      return { ...current, published: false, isDraft: false };
    }
    case "setStatus": {
      if (!current) throw new Error("Event not found");
      const from = storedStatus(current.status);
      const sameStatus = from === action.status;
      const edge = `${from}->${action.status}`;
      const allowed =
        (action.canReview && (sameStatus || REVIEW_EDGES.has(edge))) ||
        (!sameStatus &&
          action.canSubmitOwnDraft &&
          edge === "draft->submitted");
      if (!allowed) {
        throw new Error(
          `Cannot move an event request from ${from} to ${action.status}`,
        );
      }
      if (sameStatus) return current;
      return listingForStatus(action.status);
    }
    default: {
      const unreachable: never = action;
      throw new Error(`Unknown event request action: ${JSON.stringify(unreachable)}`);
    }
  }
}
