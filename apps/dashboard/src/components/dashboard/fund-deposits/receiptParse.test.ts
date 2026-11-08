import { describe, expect, it } from "vitest";
import { createRequestGate, mergeParsedReceipt } from "./receiptParse";

const TODAY = "2026-11-08";

const blank = {
	title: "",
	amount: "",
	depositDate: TODAY,
	description: "",
	purpose: "Event Revenue",
};

describe("mergeParsedReceipt", () => {
	it("fills empty fields from the parsed receipt", () => {
		const merged = mergeParsedReceipt(
			blank,
			{
				vendorName: "Costco",
				dateOfPurchase: "2026-11-01T12:00:00Z",
				total: 42.5,
				lineItems: [
					{ description: "Chips", amount: 10 },
					{ description: "Soda" },
					{ amount: 3 },
				],
			},
			TODAY,
		);

		expect(merged).toEqual({
			title: "Costco Deposit",
			amount: "42.50",
			depositDate: "2026-11-01",
			description: "Chips ($10.00), Soda",
			purpose: "Event Revenue",
		});
	});

	it("never overwrites values the user entered", () => {
		const filled = {
			...blank,
			title: "Bake sale",
			amount: "12.00",
			depositDate: "2026-10-30",
			description: "Cash box",
		};

		expect(
			mergeParsedReceipt(
				filled,
				{
					vendorName: "Costco",
					dateOfPurchase: "2026-11-01",
					total: 99,
					lineItems: [{ description: "Chips" }],
				},
				TODAY,
			),
		).toEqual(filled);
	});

	it("ignores non-positive totals and invalid dates", () => {
		const merged = mergeParsedReceipt(
			blank,
			{ total: 0, dateOfPurchase: "not a date" },
			TODAY,
		);

		expect(merged.amount).toBe("");
		expect(merged.depositDate).toBe(TODAY);
		expect(merged.title).toBe("");
	});

	it("keeps only the first five line items", () => {
		const merged = mergeParsedReceipt(
			blank,
			{
				lineItems: ["a", "b", "c", "d", "e", "f"].map((description) => ({
					description,
				})),
			},
			TODAY,
		);

		expect(merged.description).toBe("a, b, c, d, e");
	});
});

describe("createRequestGate", () => {
	it("treats only the latest request as current", () => {
		const gate = createRequestGate();
		const first = gate.begin();
		const second = gate.begin();

		expect(gate.isCurrent(first)).toBe(false);
		expect(gate.isCurrent(second)).toBe(true);
	});

	it("drops the in-flight request after invalidate", () => {
		const gate = createRequestGate();
		const token = gate.begin();

		gate.invalidate();

		expect(gate.isCurrent(token)).toBe(false);
		expect(gate.isCurrent(gate.begin())).toBe(true);
	});

	it("keeps separate gates independent", () => {
		const a = createRequestGate();
		const b = createRequestGate();
		const token = a.begin();

		b.invalidate();

		expect(a.isCurrent(token)).toBe(true);
	});
});
