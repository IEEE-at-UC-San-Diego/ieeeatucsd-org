import { describe, expect, it } from "vitest";
import {
	cartTotal,
	loadCart,
	mergeCartLine,
	refreshCartFromCatalog,
	updateCartQuantity,
} from "./cart";
import type { CartLine } from "./types";

const line: CartLine = {
	productId: "product" as CartLine["productId"],
	variantId: "variant" as CartLine["variantId"],
	productName: "Shirt",
	variantName: "Medium",
	sku: "SHIRT-M",
	unitPrice: 25,
	quantity: 1,
	productRevision: 1,
	variantRevision: 1,
	availableStock: 3,
	purchaseLimit: 2,
};

describe("merch cart", () => {
	it("merges variants and respects the tightest limit", () => {
		expect(mergeCartLine([line], { ...line, quantity: 3 })[0].quantity).toBe(2);
		expect(mergeCartLine([], { ...line, quantity: 2 })).toHaveLength(1);
		expect(mergeCartLine([], { ...line, availableStock: 0 })).toEqual([]);
	});

	it("removes zero quantities and calculates totals", () => {
		expect(updateCartQuantity([line], line.variantId, 0)).toEqual([]);
		expect(cartTotal([{ ...line, quantity: 2 }])).toBe(50);
	});

	it("discards malformed persisted values", () => {
		expect(loadCart({ getItem: () => "not-json" })).toEqual([]);
		expect(
			loadCart({ getItem: () => JSON.stringify([{ quantity: -1 }]) }),
		).toEqual([]);
		expect(
			loadCart({
				getItem: () => JSON.stringify([{ ...line, sku: "", quantity: 1 }]),
			}),
		).toEqual([]);
		expect(
			loadCart({
				getItem: () => JSON.stringify([{ ...line, quantity: 99 }]),
			})[0].quantity,
		).toBe(2);
	});

	it("rejects unsafe totals", () => {
		expect(() =>
			cartTotal([{ ...line, unitPrice: Number.MAX_SAFE_INTEGER, quantity: 2 }]),
		).toThrow(RangeError);
	});

	it("refreshes all checkout-sensitive snapshots", () => {
		const refreshed = refreshCartFromCatalog(
			[line],
			[
				{
					_id: "product" as CartLine["productId"],
					name: "New Shirt",
					revision: 2,
					purchaseLimit: 1,
					variants: [
						{
							_id: "variant" as CartLine["variantId"],
							sku: "NEW-M",
							name: "M",
							pointPrice: 30,
							availableStock: 4,
							revision: 3,
						},
					],
				},
			],
		);
		expect(refreshed[0]).toMatchObject({
			productName: "New Shirt",
			sku: "NEW-M",
			unitPrice: 30,
			quantity: 1,
			productRevision: 2,
			variantRevision: 3,
		});
	});
});
