export type ReviewableReimbursement = {
	status: "submitted" | "approved" | "declined" | "paid";
	paymentDetails?: unknown;
};

export type ReimbursementReviewStep = "approveOrDecline" | "markPaid" | "none";

export function getReviewStep(
	reimbursement: ReviewableReimbursement,
): ReimbursementReviewStep {
	switch (reimbursement.status) {
		case "submitted":
			return "approveOrDecline";
		case "approved":
			return reimbursement.paymentDetails ? "none" : "markPaid";
		case "declined":
		case "paid":
			return "none";
		default: {
			const unhandled: never = reimbursement.status;
			return unhandled;
		}
	}
}

export type PendingReviewAction = "approve" | "decline";

export type PendingReviewActions = Readonly<
	Record<string, PendingReviewAction>
>;

export function withPendingAction(
	pending: PendingReviewActions,
	id: string,
	action: PendingReviewAction,
): PendingReviewActions {
	return { ...pending, [id]: action };
}

export function withoutPendingAction(
	pending: PendingReviewActions,
	id: string,
): PendingReviewActions {
	if (!(id in pending)) return pending;
	const { [id]: _settled, ...rest } = pending;
	return rest;
}
