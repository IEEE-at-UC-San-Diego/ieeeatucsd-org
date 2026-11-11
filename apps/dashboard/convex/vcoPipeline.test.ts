import { describe, expect, it } from "vitest";
import { hasVcoViewAccess, type UserRole } from "./permissions";
import {
  buildVcoPhaseDonePatch,
  canEditVcoPipelineFields,
  VCO_PIPELINE_EDIT_FIELDS,
  vcoPipelineActorId,
} from "./vcoPipeline";

const ROLES: UserRole[] = [
  "Member",
  "General Officer",
  "Executive Officer",
  "Member at Large",
  "Past Officer",
  "Sponsor",
  "Administrator",
];

describe("VCO pipeline field gate", () => {
  it("uses the same check as funded, FIN-ID, and T-Res owner", () => {
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

    for (const role of ROLES) {
      expect(canEditVcoPipelineFields(role)).toBe(hasVcoViewAccess(role));
      expect(canEditVcoPipelineFields(role, "Vice Chair Operations")).toBe(
        hasVcoViewAccess(role, "Vice Chair Operations"),
      );
    }
  });

  it("blocks non-VCO officers from changing done timestamps", () => {
    expect(canEditVcoPipelineFields("General Officer")).toBe(false);
    expect(canEditVcoPipelineFields("General Officer", "Vice Chair Events")).toBe(
      false,
    );
    expect(canEditVcoPipelineFields("Member", "Vice Chair Operations")).toBe(
      false,
    );
  });

  it("allows VCO-titled officers, execs, and admins", () => {
    expect(
      canEditVcoPipelineFields("General Officer", "Vice Chair Operations"),
    ).toBe(true);
    expect(canEditVcoPipelineFields("Executive Officer")).toBe(true);
    expect(canEditVcoPipelineFields("Administrator")).toBe(true);
  });
});

describe("buildVcoPhaseDonePatch", () => {
  const actorId = "user_vco";
  const nowMs = 1_767_000_000_000;

  it("stores the timestamp and actor when a step is marked done", () => {
    expect(
      buildVcoPhaseDonePatch({ progAppDone: true }, actorId, nowMs),
    ).toEqual({
      progAppDoneAt: nowMs,
      progAppDoneBy: actorId,
    });
  });

  it("unsets timestamp and actor when a step is unmarked", () => {
    expect(
      buildVcoPhaseDonePatch({ tresStartDone: false }, actorId, nowMs),
    ).toEqual({
      tresStartDoneAt: undefined,
      tresStartDoneBy: undefined,
    });
  });

  it("leaves omitted steps unchanged", () => {
    expect(buildVcoPhaseDonePatch({}, actorId, nowMs)).toEqual({});
  });

  it("applies all three steps independently", () => {
    expect(
      buildVcoPhaseDonePatch(
        {
          progAppDone: true,
          tresStartDone: false,
          tresFinishDone: true,
        },
        actorId,
        nowMs,
      ),
    ).toEqual({
      progAppDoneAt: nowMs,
      progAppDoneBy: actorId,
      tresStartDoneAt: undefined,
      tresStartDoneBy: undefined,
      tresFinishDoneAt: nowMs,
      tresFinishDoneBy: actorId,
    });
  });
});

describe("vcoPipelineActorId", () => {
  it("prefers logtoId, then authUserId", () => {
    expect(vcoPipelineActorId({ logtoId: "logto_1", authUserId: "auth_1" })).toBe(
      "logto_1",
    );
    expect(vcoPipelineActorId({ authUserId: "auth_1" })).toBe("auth_1");
    expect(vcoPipelineActorId({})).toBe("");
  });
});
