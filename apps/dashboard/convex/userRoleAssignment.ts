import { v } from "convex/values";
import type { UserRole } from "./permissions";

export const ASSIGNABLE_USER_ROLES = [
  "Member",
  "General Officer",
  "Executive Officer",
  "Member at Large",
  "Past Officer",
  "Sponsor",
  "Administrator",
] as const satisfies readonly UserRole[];

export const assignableUserRoleValidator = v.union(
  v.literal("Member"),
  v.literal("General Officer"),
  v.literal("Executive Officer"),
  v.literal("Member at Large"),
  v.literal("Past Officer"),
  v.literal("Sponsor"),
  v.literal("Administrator"),
);

export type AssignableUserRole = (typeof ASSIGNABLE_USER_ROLES)[number];

export type RoleAssignmentActor = {
  role: string;
  _id?: string;
};

export type RoleAssignmentTarget = {
  role?: string;
  _id?: string;
};

/**
 * Shared role-assignment rules for `users.updateRole` and
 * `users.createPlaceholder`. Executive Officers may administer members and
 * officers, but they cannot mint or modify Administrator accounts.
 */
export class UserRoleAssignment {
  static assertCanAssign(args: {
    actor: RoleAssignmentActor;
    role: string;
    target?: RoleAssignmentTarget;
  }) {
    if (args.actor.role !== "Executive Officer") {
      return;
    }

    if (args.target?.role === "Administrator") {
      throw new Error("Executive Officers cannot modify Administrator accounts");
    }

    if (args.target?._id && args.actor._id && args.target._id === args.actor._id) {
      throw new Error("Executive Officers cannot change their own role");
    }

    if (args.role === "Administrator") {
      throw new Error("Only Administrators can assign the Administrator role");
    }
  }
}
