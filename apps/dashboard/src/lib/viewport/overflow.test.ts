/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import {
	AUDITED_MOBILE_WIDTHS,
	assertNoDocumentHorizontalOverflow,
	hasDocumentHorizontalOverflow,
	OVERFLOW_SMOKE_ROUTES,
} from "./overflow";

function setViewportWidth(width: number) {
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		writable: true,
		value: width,
	});
	document.documentElement.style.width = `${width}px`;
	document.body.style.width = `${width}px`;
	document.body.style.margin = "0";
	document.body.style.overflowX = "hidden";
}

function mountFixture(html: string) {
	document.body.innerHTML = html;
}

afterEach(() => {
	document.body.innerHTML = "";
	document.documentElement.removeAttribute("style");
});

describe("viewport overflow contract", () => {
	it("lists the audited mobile widths", () => {
		expect([...AUDITED_MOBILE_WIDTHS]).toEqual([320, 375, 390, 430]);
	});

	it("covers the key audited dashboard routes", () => {
		expect(OVERFLOW_SMOKE_ROUTES.length).toBeGreaterThanOrEqual(20);
		expect(OVERFLOW_SMOKE_ROUTES).toContain("/overview");
		expect(OVERFLOW_SMOKE_ROUTES).toContain("/events");
		expect(OVERFLOW_SMOKE_ROUTES).toContain("/reimbursement");
		expect(OVERFLOW_SMOKE_ROUTES).toContain("/manage-events");
	});

	it.each([...AUDITED_MOBILE_WIDTHS])(
		"passes for a constrained mobile shell at %ipx",
		(width) => {
			setViewportWidth(width);
			mountFixture(`
				<div data-dashboard-scroll style="max-width:100vw;overflow-x:hidden;width:100%;">
					<header style="display:flex;gap:8px;width:100%;min-width:0;">
						<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
							Overview
						</span>
						<button type="button" style="width:44px;height:44px;flex-shrink:0;">···</button>
					</header>
					<main style="width:100%;min-width:0;padding:16px;box-sizing:border-box;">
						<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
							<div style="min-width:0;border:1px solid #ccc;padding:12px;">Points</div>
							<div style="min-width:0;border:1px solid #ccc;padding:12px;">Rank</div>
						</div>
						<ul style="margin:16px 0;padding:0;list-style:none;">
							<li style="min-width:0;overflow-wrap:anywhere;padding:12px 0;border-bottom:1px solid #eee;">
								Very long reimbursement title that must wrap instead of widening the document
							</li>
						</ul>
						<div style="overflow-x:auto;max-width:100%;">
							<table style="width:640px;border-collapse:collapse;">
								<tr><td>Local table scroller only</td></tr>
							</table>
						</div>
					</main>
				</div>
			`);

			expect(hasDocumentHorizontalOverflow(document, width)).toBe(false);
			expect(() =>
				assertNoDocumentHorizontalOverflow(document, width),
			).not.toThrow();
		},
	);

	it.each([...AUDITED_MOBILE_WIDTHS])(
		"fails when document scrollWidth exceeds the viewport at %ipx",
		(width) => {
			setViewportWidth(width);
			mountFixture(`<div style="width:100%">content</div>`);

			Object.defineProperty(document.documentElement, "scrollWidth", {
				configurable: true,
				get: () => width + 64,
			});

			expect(hasDocumentHorizontalOverflow(document, width)).toBe(true);
			expect(() => assertNoDocumentHorizontalOverflow(document, width)).toThrow(
				/Document horizontal overflow/,
			);
		},
	);

	it("documents the historic w-fit stepper anti-pattern in the fixture catalog", () => {
		// Real browsers widen for w-fit steppers; jsdom does not layout.
		// Keep the HTML as a regression catalog for future playwright checks.
		const antiPattern = `
			<div style="width:fit-content;display:flex;gap:24px;white-space:nowrap;">
				${Array.from({ length: 6 }, (_, i) => `<span style="padding:8px 24px;">Step ${i + 1}</span>`).join("")}
			</div>
		`;
		expect(antiPattern).toContain("width:fit-content");
		expect(antiPattern).toContain("Step 6");
	});
});
