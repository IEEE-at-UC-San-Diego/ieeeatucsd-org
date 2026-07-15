/**
 * Theme-aware status / semantic tones.
 * Soft = tinted surface + readable label (badges, chips).
 * Solid = filled accent (dots, progress, primary-ish status marks).
 * Always uses Geist `ds-*` tokens.
 */

export const tone = {
	neutral: "bg-muted text-foreground border-border",
	info: "bg-ds-blue-100 text-ds-blue-700 border-ds-blue-100",
	success: "bg-ds-green-100 text-ds-green-700 border-ds-green-100",
	warning: "bg-ds-amber-100 text-ds-amber-900 border-ds-amber-100",
	danger: "bg-ds-red-100 text-ds-red-800 border-ds-red-100",
	purple: "bg-ds-purple-100 text-ds-purple-700 border-ds-purple-100",
	pink: "bg-ds-pink-100 text-ds-pink-700 border-ds-pink-100",
	teal: "bg-ds-teal-100 text-ds-teal-700 border-ds-teal-100",
} as const;

export const softFill = {
	info: "bg-ds-blue-100/60 text-ds-blue-700",
	success: "bg-ds-green-100/60 text-ds-green-700",
	warning: "bg-ds-amber-100/60 text-ds-amber-900",
	danger: "bg-ds-red-100/60 text-ds-red-800",
	purple: "bg-ds-purple-100/60 text-ds-purple-700",
} as const;

export const solid = {
	neutral: "bg-ds-gray-600",
	info: "bg-ds-blue-700",
	success: "bg-ds-green-700",
	warning: "bg-ds-amber-700",
	danger: "bg-ds-red-800",
	purple: "bg-ds-purple-700",
	pink: "bg-ds-pink-700",
	teal: "bg-ds-teal-700",
} as const;

export const solidOnAccent = {
	info: "bg-ds-blue-700 text-white hover:bg-ds-blue-800",
	success: "bg-ds-green-700 text-white hover:bg-ds-green-800",
	warning: "bg-ds-amber-700 text-white hover:bg-ds-amber-800",
	danger: "bg-ds-red-800 text-white hover:bg-ds-red-900",
	purple: "bg-ds-purple-700 text-white hover:bg-ds-purple-800",
} as const;

export const textTone = {
	neutral: "text-muted-foreground",
	info: "text-ds-blue-700",
	success: "text-ds-green-700",
	warning: "text-ds-amber-900",
	danger: "text-ds-red-800",
	purple: "text-ds-purple-700",
	pink: "text-ds-pink-700",
	teal: "text-ds-teal-700",
} as const;

export const panel = {
	info: "border-ds-blue-100 bg-ds-blue-100/50",
	success: "border-ds-green-100 bg-ds-green-100/50",
	warning: "border-ds-amber-100 bg-ds-amber-100/50",
	danger: "border-ds-red-100 bg-ds-red-100/50",
	purple: "border-ds-purple-100 bg-ds-purple-100/50",
} as const;

/** Fund-request / shared workflow statuses */
export const fundRequestStatusTone = {
	draft: tone.neutral,
	submitted: tone.info,
	needs_info: tone.warning,
	approved: tone.success,
	denied: tone.danger,
	completed: tone.purple,
} as const;

/** Reimbursement workflow statuses */
export const reimbursementStatusTone = {
	draft: tone.neutral,
	submitted: tone.info,
	approved: tone.success,
	declined: tone.danger,
	paid: tone.purple,
} as const;

/** Event management statuses */
export const eventStatusTone = {
	draft: tone.neutral,
	submitted: tone.info,
	pending: tone.warning,
	needs_review: tone.warning,
	approved: tone.success,
	declined: tone.danger,
	published: tone.pink,
} as const;

/** Fund deposit statuses */
export const fundDepositStatusTone = {
	pending: tone.warning,
	verified: tone.info,
	rejected: tone.danger,
} as const;
