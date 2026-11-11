import { describe, expect, it } from "vitest";
import {
  hasAdminAccess,
  hasOfficerAccess,
  hasVcoViewAccess,
  isVcoPosition,
  type UserRole,
} from "./permissions";

const ROLES: UserRole[] = [
  "Member",
  "General Officer",
  "Executive Officer",
  "Member at Large",
  "Past Officer",
  "Sponsor",
  "Administrator",
];

describe("existing role gates", () => {
  it("keeps admin access limited to Administrator and Executive Officer", () => {
    expect(ROLES.filter((role) => hasAdminAccess(role))).toEqual([
      "Executive Officer",
      "Administrator",
    ]);
  });

  it("keeps officer access limited to admin plus General Officer", () => {
    expect(ROLES.filter((role) => hasOfficerAccess(role))).toEqual([
      "General Officer",
      "Executive Officer",
      "Administrator",
    ]);
  });
});

describe("VCO view access", () => {
  it("recognizes Vice Chair Operations titles", () => {
    expect(isVcoPosition("Vice Chair Operations")).toBe(true);
    expect(isVcoPosition("VCO")).toBe(true);
    expect(isVcoPosition("vice chair operations (events)")).toBe(true);
    expect(isVcoPosition("Vice Chair Events")).toBe(false);
    expect(isVcoPosition("")).toBe(false);
  });

  it("allows admins, execs, and VCO-titled officers", () => {
    expect(hasVcoViewAccess("Administrator")).toBe(true);
    expect(hasVcoViewAccess("Executive Officer")).toBe(true);
    expect(hasVcoViewAccess("General Officer", "Vice Chair Operations")).toBe(
      true,
    );
    expect(hasVcoViewAccess("General Officer")).toBe(false);
    expect(hasVcoViewAccess("Member", "Vice Chair Operations")).toBe(false);
  });
});
