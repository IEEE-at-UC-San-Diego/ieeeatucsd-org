import { describe, expect, it } from "vitest";
import type { UserRole } from "@/types/roles";
import { hasVcoViewAccess } from "../../../convex/permissions";
import { canEditVcoPipelineFields } from "../../../convex/vcoPipeline";
import { canViewVcoPipeline, isVcoPosition } from "./vcoAccess";

const ROLES: UserRole[] = [
	"Member",
	"General Officer",
	"Executive Officer",
	"Member at Large",
	"Past Officer",
	"Sponsor",
	"Administrator",
];

describe("client VCO access matches Convex helpers", () => {
	it("agrees for every role with and without a VCO title", () => {
		for (const role of ROLES) {
			expect(canViewVcoPipeline(role)).toBe(hasVcoViewAccess(role));
			expect(canViewVcoPipeline(role, "Vice Chair Operations")).toBe(
				hasVcoViewAccess(role, "Vice Chair Operations"),
			);
		}
	});

	it("recognizes VCO titles the same way", () => {
		expect(isVcoPosition("Vice Chair Operations")).toBe(true);
		expect(isVcoPosition("VCO")).toBe(true);
		expect(isVcoPosition("Vice Chair Events")).toBe(false);
	});

	it("uses the same gate for pipeline field writes as for the VCO tab", () => {
		expect(canEditVcoPipelineFields("General Officer")).toBe(false);
		expect(
			canEditVcoPipelineFields("General Officer", "Vice Chair Operations"),
		).toBe(true);
		expect(canEditVcoPipelineFields("Administrator")).toBe(
			canViewVcoPipeline("Administrator"),
		);
	});
});
