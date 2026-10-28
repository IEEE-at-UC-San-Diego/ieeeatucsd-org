import { describe, expect, it } from "vitest";
import {
  canEditVcoPipelineFields,
  hasAdminAccess,
  hasOfficerAccess,
  hasVcoViewAccess,
  isVcoPosition,
  VCO_PIPELINE_EDIT_FIELDS,
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

describe("VCO pipeline field edits", () => {
  it("uses the same gate as funded, FIN-ID, and T-Res owner for done timestamps", () => {
    expect(VCO_PIPELINE_EDIT_FIELDS).toEqual(
      expect.arrayContaining([
        "funded",
        "finId",
        "tresOwner",
        "progAppDoneAt",
        "tresStartDoneAt",
        "tresFinishDoneAt",
      ]),
    );
    expect(canEditVcoPipelineFields("Administrator")).toBe(
      hasVcoViewAccess("Administrator"),
    );
    expect(canEditVcoPipelineFields("Executive Officer")).toBe(true);
    expect(
      canEditVcoPipelineFields("General Officer", "Vice Chair Operations"),
    ).toBe(true);
    expect(canEditVcoPipelineFields("General Officer")).toBe(false);
    expect(
      canEditVcoPipelineFields("General Officer", "Vice Chair Events"),
    ).toBe(false);
    expect(canEditVcoPipelineFields("Member", "Vice Chair Operations")).toBe(
      false,
    );
  });
});
