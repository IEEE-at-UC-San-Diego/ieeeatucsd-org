import { formatCurrencyUSD } from "@/lib/formatters";

export type ReceiptParseState =
	| { status: "idle" }
	| { status: "parsing" }
	| { status: "done"; message: string };

export interface ParsedReceipt {
	vendorName?: string;
	dateOfPurchase?: string;
	total?: number;
	lineItems?: Array<{ description?: string; amount?: number }>;
}

interface ReceiptFields {
	title: string;
	amount: string;
	depositDate: string;
	description: string;
}

/** Fills only fields the user hasn't set (date counts as unset while it is still today). */
export function mergeParsedReceipt<T extends ReceiptFields>(
	prev: T,
	parsed: ParsedReceipt,
	todayDate: string,
): T {
	const detectedAmount =
		parsed.total && parsed.total > 0 ? parsed.total : undefined;
	const parsedDate = parsed.dateOfPurchase
		? new Date(parsed.dateOfPurchase)
		: null;
	const hasValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());
	const aiDescription = Array.isArray(parsed.lineItems)
		? parsed.lineItems
				.filter((item) => item.description)
				.slice(0, 5)
				.map(
					(item) =>
						`${item.description}${item.amount ? ` (${formatCurrencyUSD(Number(item.amount))})` : ""}`,
				)
				.join(", ")
		: "";

	return {
		...prev,
		title:
			prev.title.trim() ||
			(parsed.vendorName ? `${parsed.vendorName} Deposit` : prev.title),
		amount:
			detectedAmount && !prev.amount ? detectedAmount.toFixed(2) : prev.amount,
		depositDate:
			hasValidDate && prev.depositDate === todayDate
				? parsedDate.toISOString().split("T")[0]
				: prev.depositDate,
		description: prev.description.trim() || aiDescription || prev.description,
	};
}

export interface RequestGate {
	/** Starts a request and supersedes any earlier one. */
	begin: () => number;
	isCurrent: (token: number) => boolean;
	/** Supersedes the in-flight request without starting a new one. */
	invalidate: () => void;
}

export function createRequestGate(): RequestGate {
	let current = 0;
	return {
		begin: () => {
			current += 1;
			return current;
		},
		isCurrent: (token) => token === current,
		invalidate: () => {
			current += 1;
		},
	};
}
