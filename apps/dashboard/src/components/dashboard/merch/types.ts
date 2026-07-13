import type { Id } from "@convex/_generated/dataModel";

export type MerchVariant = {
	_id: Id<"merchVariants">;
	productId?: Id<"merchProducts">;
	sku: string;
	name?: string;
	optionName?: string;
	optionValue?: string;
	options?: Record<string, string>;
	optionValues?: Array<{ name: string; value: string }>;
	price?: number;
	pointPrice?: number;
	stock?: number;
	availableStock?: number;
	stockOnHand?: number;
	active?: boolean;
	revision?: number;
};

export type MerchProduct = {
	_id: Id<"merchProducts">;
	name: string;
	description?: string;
	imageUrl?: string;
	status?: "draft" | "active" | "archived";
	purchaseLimit?: number;
	displayOrder?: number;
	revision?: number;
	availableFrom?: number;
	availableUntil?: number;
	variants: MerchVariant[];
};

export type CartLine = {
	productId: Id<"merchProducts">;
	variantId: Id<"merchVariants">;
	productName: string;
	variantName: string;
	sku: string;
	imageUrl?: string;
	unitPrice: number;
	quantity: number;
	productRevision: number;
	variantRevision: number;
	availableStock: number;
	purchaseLimit?: number;
};

export type PickupOption = {
	_id: Id<"merchPickupEvents"> | Id<"merchPickupSlots">;
	type: "event" | "slot";
	name: string;
	location: string;
	startAt: number;
	endAt?: number;
	cutoffAt?: number;
	capacity?: number;
	bookedCount?: number;
	remainingCapacity?: number;
	notes?: string;
};

export type OrderLine = {
	productName: string;
	variantName?: string;
	variantLabel?: string;
	sku: string;
	imageUrl?: string;
	unitPrice?: number;
	quantity: number;
	lineTotal?: number;
};

export type MerchOrder = {
	_id: Id<"merchOrders">;
	orderNumber: string;
	status: "pending" | "fulfilled" | "canceled";
	pickupHealth?: "scheduled" | "overdue" | "action_required";
	total?: number;
	totalPoints?: number;
	createdAt?: number;
	updatedAt?: number;
	memberName?: string;
	memberEmail?: string;
	userName?: string;
	ownerName?: string;
	ownerEmail?: string;
	lines: OrderLine[];
	pickup?: {
		type?: "event" | "slot";
		name?: string;
		label?: string;
		location?: string;
		address?: string;
		startAt: number;
		endAt?: number;
	};
	pickupSnapshot?: MerchOrder["pickup"];
	qrToken?: string;
	fallbackCode?: string;
	canCancel?: boolean;
	fulfilledAt?: number;
	fulfilledByName?: string;
	canceledAt?: number;
	cancelReason?: string;
	events?: Array<{
		_id?: string;
		action?: string;
		type?: string;
		label?: string;
		createdAt: number;
		actorName?: string;
		reason?: string;
	}>;
};

export const points = (value: number) =>
	`${new Intl.NumberFormat("en-US").format(value)} pts`;

export const pacificDateTime = (value?: number) =>
	value
		? new Intl.DateTimeFormat("en-US", {
				dateStyle: "medium",
				timeStyle: "short",
				timeZone: "America/Los_Angeles",
			}).format(value)
		: "Not scheduled";

export const variantLabel = (variant: MerchVariant) =>
	variant.name ||
	variant.optionValue ||
	variant.optionValues?.map((option) => option.value).join(" / ") ||
	Object.values(variant.options ?? {}).join(" / ") ||
	variant.sku;

export const variantPrice = (variant: MerchVariant) =>
	variant.pointPrice ?? variant.price ?? 0;

export const variantStock = (variant: MerchVariant) =>
	variant.stockOnHand ?? variant.availableStock ?? variant.stock ?? 0;
