export type ConstitutionStatus = "draft" | "published" | "archived";

export type ConstitutionStatusEvent =
  | { kind: "update"; to: ConstitutionStatus }
  | { kind: "supersede" };

export type ConstitutionStatusTransition = {
  status: ConstitutionStatus;
  archiveOtherPublished: boolean;
};

function allowedConstitutionTargets(
  from: ConstitutionStatus,
): readonly ConstitutionStatus[] {
  switch (from) {
    case "draft":
      return ["published", "archived"];
    case "published":
      return ["archived"];
    case "archived":
      return ["draft"];
    default: {
      const unreachable: never = from;
      throw new Error(`Unknown constitution status: ${String(unreachable)}`);
    }
  }
}

function moveConstitution(
  from: ConstitutionStatus,
  to: ConstitutionStatus,
  illegal: string,
): ConstitutionStatusTransition {
  if (from === to) return { status: from, archiveOtherPublished: false };
  if (!allowedConstitutionTargets(from).includes(to)) {
    throw new Error(illegal);
  }
  return { status: to, archiveOtherPublished: to === "published" };
}

export function transitionConstitutionStatus(
  from: ConstitutionStatus,
  event: ConstitutionStatusEvent,
): ConstitutionStatusTransition {
  switch (event.kind) {
    case "update":
      return moveConstitution(
        from,
        event.to,
        `Cannot move a constitution from ${from} to ${event.to}`,
      );
    case "supersede":
      if (from !== "published") {
        throw new Error(
          `Only a published constitution can be superseded, not a ${from} one`,
        );
      }
      return moveConstitution(
        from,
        "archived",
        `Cannot archive a superseded ${from} constitution`,
      );
    default: {
      const unreachable: never = event;
      throw new Error(
        `Unknown constitution status event: ${JSON.stringify(unreachable)}`,
      );
    }
  }
}
