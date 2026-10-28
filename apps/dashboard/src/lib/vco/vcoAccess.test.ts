import { describe, expect, it } from "vitest";
import type { UserRole } from "@/types/roles";
import {
	canEditVcoPipelineFields as canEditVcoPipelineFieldsConvex,
	hasVcoViewAccess,
} from "../../../convex/permissions";
import {
	canEditVcoPipelineFields,
	canViewVcoPipeline,
	isVcoPosition,
} from "./vcoAccess";

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
			expect(canEditVcoPipelineFields(role)).toBe(
				canEditVcoPipelineFieldsConvex(role),
			);
			expect(canEditVcoPipelineFields(role, "Vice Chair Operations")).toBe(
				canEditVcoPipelineFieldsConvex(role, "Vice Chair Operations"),
			);
		}
	});

	it("blocks non-VCO officers from editing pipeline done fields", () => {
		expect(canEditVcoPipelineFields("General Officer")).toBe(false);
		expect(
			canEditVcoPipelineFields("General Officer", "Vice Chair Events"),
		).toBe(false);
		expect(
			canEditVcoPipelineFields("General Officer", "Vice Chair Operations"),
		).toBe(true);
	});

	it("recognizes VCO titles the same way", () => {
		expect(isVcoPosition("Vice Chair Operations")).toBe(true);
		expect(isVcoPosition("VCO")).toBe(true);
		expect(isVcoPosition("Vice Chair Events")).toBe(false);
	});
});
