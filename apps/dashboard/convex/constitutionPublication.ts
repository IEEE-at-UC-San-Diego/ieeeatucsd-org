import {
  transitionConstitutionStatus,
  type ConstitutionStatus,
} from "./constitutionTransition";

export function constitutionsToArchive<
  T extends { _id: string; status: ConstitutionStatus },
>(
  published: T[],
  publishingId: string,
): Array<{ _id: T["_id"]; status: ConstitutionStatus }> {
  return published
    .filter((row) => row._id !== publishingId)
    .map((row) => ({
      _id: row._id,
      status: transitionConstitutionStatus(row.status, { kind: "supersede" })
        .status,
    }));
}
