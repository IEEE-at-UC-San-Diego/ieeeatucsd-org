export type PaymentReviewForm = {
	confirmationNumber: string;
	paymentDate: string;
	amount: string;
	memo: string;
};

export type ExtractedPaymentDetails = {
	confirmationNumber?: string;
	paymentDate?: string;
	amountPaid?: number;
	memo?: string;
};

export type OpenPaidModalState =
	| { status: "selectingProof"; reimbursementId: string; file: File | null }
	| {
			status: "extracting";
			reimbursementId: string;
			file: File;
			attempt: number;
	  }
	| {
			status: "reviewing";
			reimbursementId: string;
			proofUrl: string | null;
			form: PaymentReviewForm;
	  }
	| {
			status: "submitting";
			reimbursementId: string;
			proofUrl: string | null;
			form: PaymentReviewForm;
	  };

/**
 * `previous` keeps the last open phase so the overlay can keep rendering it
 * while its exit animation plays; it is never acted on.
 */
export type PaidModalState =
	| { status: "closed"; previous: OpenPaidModalState | null }
	| OpenPaidModalState;

export type PaidModalAction =
	| { type: "open"; reimbursementId: string }
	| { type: "close" }
	| { type: "proofSelected"; file: File | null }
	| { type: "extractionStarted"; attempt: number }
	| {
			type: "extractionFinished";
			attempt: number;
			proofUrl: string | null;
			form: PaymentReviewForm;
	  }
	| { type: "fieldChanged"; field: keyof PaymentReviewForm; value: string }
	| { type: "submitStarted" }
	| { type: "submitFailed" };

export const initialPaidModalState: PaidModalState = {
	status: "closed",
	previous: null,
};

export function paidModalReducer(
	state: PaidModalState,
	action: PaidModalAction,
): PaidModalState {
	switch (action.type) {
		case "open":
			return {
				status: "selectingProof",
				reimbursementId: action.reimbursementId,
				file: null,
			};
		case "close":
			return state.status === "closed"
				? state
				: { status: "closed", previous: state };
		case "proofSelected":
			if (state.status !== "selectingProof") return state;
			return { ...state, file: action.file };
		case "extractionStarted":
			if (state.status !== "selectingProof" || !state.file) return state;
			return {
				status: "extracting",
				reimbursementId: state.reimbursementId,
				file: state.file,
				attempt: action.attempt,
			};
		case "extractionFinished":
			if (state.status !== "extracting" || state.attempt !== action.attempt) {
				return state;
			}
			return {
				status: "reviewing",
				reimbursementId: state.reimbursementId,
				proofUrl: action.proofUrl,
				form: action.form,
			};
		case "fieldChanged":
			if (state.status !== "reviewing") return state;
			return {
				...state,
				form: { ...state.form, [action.field]: action.value },
			};
		case "submitStarted":
			if (state.status !== "reviewing") return state;
			return { ...state, status: "submitting" };
		case "submitFailed":
			if (state.status !== "submitting") return state;
			return { ...state, status: "reviewing" };
		default: {
			const unhandled: never = action;
			return unhandled;
		}
	}
}

export function isPaidModalOpenFor(
	state: PaidModalState,
	reimbursementId: string | undefined,
): boolean {
	return state.status !== "closed" && state.reimbursementId === reimbursementId;
}

export function hasUnsavedPaymentProgress(state: PaidModalState): boolean {
	switch (state.status) {
		case "closed":
			return false;
		case "selectingProof":
			return state.file !== null;
		case "extracting":
		case "reviewing":
		case "submitting":
			return true;
		default: {
			const unhandled: never = state;
			return unhandled;
		}
	}
}

export function buildPaymentReviewForm(
	extracted: ExtractedPaymentDetails | null,
	defaults: { today: string; fallbackAmount: string },
): PaymentReviewForm {
	return {
		confirmationNumber: extracted?.confirmationNumber || "",
		paymentDate: extracted?.paymentDate || defaults.today,
		amount:
			typeof extracted?.amountPaid === "number" && extracted.amountPaid > 0
				? extracted.amountPaid.toString()
				: defaults.fallbackAmount,
		memo: extracted?.memo || "",
	};
}

export function toPaymentDetails(
	form: PaymentReviewForm,
	options: { proofUrl: string | null; fallbackAmount: number; now: number },
) {
	return {
		confirmationNumber: form.confirmationNumber.trim(),
		paymentDate: new Date(form.paymentDate || options.now).getTime(),
		amountPaid: Number.parseFloat(form.amount) || options.fallbackAmount,
		proofFileUrl: options.proofUrl || undefined,
		memo: form.memo || undefined,
	};
}
