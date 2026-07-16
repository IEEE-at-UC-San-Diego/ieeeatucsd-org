/**
 * Theme-aware status / semantic tones.
 * Soft = tinted surface + soft label (badges, chips).
 * Solid = filled accent (dots, progress, primary-ish status marks).
 *
 * Soft labels use `tone-*` CSS vars so dark mode gets pastel *-1000
 * foregrounds instead of neon mid-scale 700/900 text on black.
 */

export const tone = {
	neutral: "bg-muted text-foreground border-border",
	info: "bg-ds-blue-100 text-tone-info border-ds-blue-100",
	success: "bg-ds-green-100 text-tone-success border-ds-green-100",
	warning: "bg-ds-amber-100 text-tone-warning border-ds-amber-100",
	danger: "bg-ds-red-100 text-tone-danger border-ds-red-100",
	purple: "bg-ds-purple-100 text-tone-purple border-ds-purple-100",
	pink: "bg-ds-pink-100 text-tone-pink border-ds-pink-100",
	teal: "bg-ds-teal-100 text-tone-teal border-ds-teal-100",
} as const;

export const softFill = {
	info: "bg-ds-blue-100/60 text-tone-info",
	success: "bg-ds-green-100/60 text-tone-success",
	warning: "bg-ds-amber-100/60 text-tone-warning",
	danger: "bg-ds-red-100/60 text-tone-danger",
	purple: "bg-ds-purple-100/60 text-tone-purple",
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
	info: "bg-ds-blue-700 text-on-accent hover:bg-ds-blue-800",
	success: "bg-ds-green-700 text-on-accent hover:bg-ds-green-800",
	warning: "bg-ds-amber-700 text-on-accent hover:bg-ds-amber-800",
	danger: "bg-ds-red-800 text-on-accent hover:bg-ds-red-900",
	purple: "bg-ds-purple-700 text-on-accent hover:bg-ds-purple-800",
} as const;

export const textTone = {
	neutral: "text-muted-foreground",
	info: "text-tone-info",
	success: "text-tone-success",
	warning: "text-tone-warning",
	danger: "text-tone-danger",
	purple: "text-tone-purple",
	pink: "text-tone-pink",
	teal: "text-tone-teal",
	link: "text-tone-link",
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
