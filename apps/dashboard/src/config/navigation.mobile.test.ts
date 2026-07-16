import { describe, expect, it } from "vitest";
import {
	MOBILE_HIDE_TAB_BAR_PATHS,
	MOBILE_TAB_ITEMS,
	NAVIGATION_PATHS,
	shouldHideMobileTabBar,
} from "@/config/navigation";

describe("mobile navigation contract", () => {
	it("exposes four primary tab destinations including More", () => {
		expect(MOBILE_TAB_ITEMS).toHaveLength(4);
		expect(MOBILE_TAB_ITEMS.map((t) => t.id)).toEqual([
			"overview",
			"events",
			"reimburse",
			"more",
		]);
	});

	it("hides the tab bar on immersive constitution builder", () => {
		expect(shouldHideMobileTabBar(NAVIGATION_PATHS.CONSTITUTION_BUILDER)).toBe(
			true,
		);
		expect(MOBILE_HIDE_TAB_BAR_PATHS.has(NAVIGATION_PATHS.GET_STARTED)).toBe(
			true,
		);
	});

	it("hides the tab bar for reimbursement task modes via search params", () => {
		expect(
			shouldHideMobileTabBar(
				NAVIGATION_PATHS.REIMBURSEMENT,
				new URLSearchParams("mode=create"),
			),
		).toBe(true);
		expect(
			shouldHideMobileTabBar(
				NAVIGATION_PATHS.REIMBURSEMENT,
				new URLSearchParams("mode=detail"),
			),
		).toBe(true);
		expect(shouldHideMobileTabBar(NAVIGATION_PATHS.REIMBURSEMENT)).toBe(false);
	});
});

describe("viewport overflow contract", () => {
	it("documents the audited mobile widths via shared module", async () => {
		const { AUDITED_MOBILE_WIDTHS, OVERFLOW_SMOKE_ROUTES } = await import(
			"@/lib/viewport/overflow"
		);
		expect([...AUDITED_MOBILE_WIDTHS]).toEqual([320, 375, 390, 430]);
		expect(OVERFLOW_SMOKE_ROUTES).toContain("/overview");
		expect(OVERFLOW_SMOKE_ROUTES).toContain("/reimbursement");
	});
});

describe("intentional desktop-only density", () => {
	it("keeps constitution builder and get-started as immersive (no tab bar)", () => {
		expect(shouldHideMobileTabBar(NAVIGATION_PATHS.CONSTITUTION_BUILDER)).toBe(
			true,
		);
		expect(shouldHideMobileTabBar(NAVIGATION_PATHS.GET_STARTED)).toBe(true);
	});
});
