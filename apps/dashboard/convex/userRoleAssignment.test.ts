import { describe, expect, it } from "vitest";
import { UserRoleAssignment } from "./userRoleAssignment";

describe("UserRoleAssignment.assertCanAssign", () => {
  it("lets an Administrator assign Administrator", () => {
    expect(() =>
      UserRoleAssignment.assertCanAssign({
        actor: { role: "Administrator", _id: "users_admin" },
        role: "Administrator",
      }),
    ).not.toThrow();
  });

  it("blocks an Executive Officer from creating an Administrator", () => {
    expect(() =>
      UserRoleAssignment.assertCanAssign({
        actor: { role: "Executive Officer", _id: "users_exec" },
        role: "Administrator",
      }),
    ).toThrow("Only Administrators can assign the Administrator role");
  });

  it("blocks an Executive Officer from modifying an Administrator", () => {
    expect(() =>
      UserRoleAssignment.assertCanAssign({
        actor: { role: "Executive Officer", _id: "users_exec" },
        role: "Member",
        target: { role: "Administrator", _id: "users_admin" },
      }),
    ).toThrow("Executive Officers cannot modify Administrator accounts");
  });

  it("blocks an Executive Officer from changing their own role", () => {
    expect(() =>
      UserRoleAssignment.assertCanAssign({
        actor: { role: "Executive Officer", _id: "users_exec" },
        role: "Member",
        target: { role: "Executive Officer", _id: "users_exec" },
      }),
    ).toThrow("Executive Officers cannot change their own role");
  });

  it("lets an Executive Officer assign a non-admin role to someone else", () => {
    expect(() =>
      UserRoleAssignment.assertCanAssign({
        actor: { role: "Executive Officer", _id: "users_exec" },
        role: "General Officer",
        target: { role: "Member", _id: "users_member" },
      }),
    ).not.toThrow();
  });
});
