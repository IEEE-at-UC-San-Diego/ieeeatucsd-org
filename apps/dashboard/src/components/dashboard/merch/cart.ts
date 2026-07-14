import type { CartLine, MerchProduct } from "./types";
import { variantLabel, variantPrice, variantStock } from "./types";

export const MERCH_CART_KEY = "ieee-merch-cart:v1";

export function mergeCartLine(lines: CartLine[], next: CartLine): CartLine[] {
	if (!Number.isSafeInteger(next.quantity) || next.quantity < 1) return lines;
	const existing = lines.find((line) => line.variantId === next.variantId);
	const max = Math.min(
		next.availableStock,
		next.purchaseLimit ?? Number.MAX_SAFE_INTEGER,
	);
	if (max < 1) return lines;
	if (!existing)
		return [...lines, { ...next, quantity: Math.min(next.quantity, max) }];
	return lines.map((line) =>
		line.variantId === next.variantId
			? {
					...line,
					...next,
					quantity: Math.min(line.quantity + next.quantity, max),
				}
			: line,
	);
}

export function updateCartQuantity(
	lines: CartLine[],
	variantId: CartLine["variantId"],
	quantity: number,
) {
	if (quantity <= 0)
		return lines.filter((line) => line.variantId !== variantId);
	if (!Number.isSafeInteger(quantity)) return lines;
	return lines.map((line) =>
		line.variantId === variantId
			? {
					...line,
					quantity: Math.min(
						quantity,
						line.availableStock,
						line.purchaseLimit ?? Number.MAX_SAFE_INTEGER,
					),
				}
			: line,
	);
}

export function cartTotal(lines: CartLine[]) {
	let total = 0;
	for (const line of lines) {
		const lineTotal = line.unitPrice * line.quantity;
		if (
			!Number.isSafeInteger(lineTotal) ||
			!Number.isSafeInteger(total + lineTotal)
		) {
			throw new RangeError("Cart total exceeds the safe integer range");
		}
		total += lineTotal;
	}
	return total;
}

export function loadCart(storage: Pick<Storage, "getItem">): CartLine[] {
	try {
		const value = JSON.parse(storage.getItem(MERCH_CART_KEY) ?? "[]");
		if (!Array.isArray(value)) return [];
		return value.flatMap((line): CartLine[] => {
			if (
				typeof line?.productId !== "string" ||
				!line.productId ||
				typeof line?.variantId !== "string" ||
				!line.variantId ||
				typeof line?.productName !== "string" ||
				!line.productName ||
				typeof line?.variantName !== "string" ||
				!line.variantName ||
				typeof line?.sku !== "string" ||
				!line.sku ||
				!Number.isSafeInteger(line?.quantity) ||
				line.quantity < 1 ||
				!Number.isSafeInteger(line?.unitPrice) ||
				line.unitPrice < 1 ||
				!Number.isSafeInteger(line?.productRevision) ||
				line.productRevision < 0 ||
				!Number.isSafeInteger(line?.variantRevision) ||
				line.variantRevision < 0 ||
				!Number.isSafeInteger(line?.availableStock) ||
				line.availableStock < 1 ||
				(line.purchaseLimit != null &&
					(!Number.isSafeInteger(line.purchaseLimit) || line.purchaseLimit < 1))
			)
				return [];
			const max = Math.min(
				line.availableStock,
				line.purchaseLimit ?? Number.MAX_SAFE_INTEGER,
			);
			return [{ ...line, quantity: Math.min(line.quantity, max) } as CartLine];
		});
	} catch {
		return [];
	}
}

/** Rebuilds checkout-sensitive snapshots from the live catalog after a conflict. */
export function refreshCartFromCatalog(
	lines: CartLine[],
	products: MerchProduct[],
) {
	return lines.flatMap((line): CartLine[] => {
		const product = products.find((entry) => entry._id === line.productId);
		const variant = product?.variants.find(
			(entry) => entry._id === line.variantId && entry.active !== false,
		);
		if (
			!product ||
			!variant ||
			variantStock(variant) < 1 ||
			variantPrice(variant) < 1
		)
			return [];
		return [
			{
				...line,
				productName: product.name,
				variantName: variantLabel(variant),
				sku: variant.sku,
				imageUrl: product.imageUrl,
				unitPrice: variantPrice(variant),
				productRevision: product.revision ?? 0,
				variantRevision: variant.revision ?? 0,
				availableStock: variantStock(variant),
				purchaseLimit: product.purchaseLimit,
				quantity: Math.min(
					line.quantity,
					variantStock(variant),
					product.purchaseLimit ?? Number.MAX_SAFE_INTEGER,
				),
			},
		];
	});
}
