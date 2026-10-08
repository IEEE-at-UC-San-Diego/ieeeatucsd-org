export interface StableValue<T> {
	value: T | null | undefined;
	lastResolved: T | null | undefined;
}

/**
 * Keeps the most recently resolved query value when the query momentarily
 * returns `undefined` — for example while an authed query re-subscribes after
 * the auth session token rotates (the token is part of the query args, so a
 * rotation starts a fresh subscription that reports `undefined` until it
 * resolves).
 *
 * `undefined` means "not resolved yet". Every other value — including `null`
 * and an empty array — counts as resolved and is remembered.
 */
export function resolveStableValue<T>(
	value: T | null | undefined,
	lastResolved: T | null | undefined,
): StableValue<T> {
	if (value !== undefined) {
		return { value, lastResolved: value };
	}

	return { value: lastResolved, lastResolved };
}

interface ConstitutionDataLoadingInput {
	isAuthenticated: boolean;
	logtoId: string | null;
	/** Stabilized constitution value (may be an object, `null`, or `undefined`). */
	constitution: unknown;
	/** Stabilized sections value (may be an array or `undefined`). */
	sections: unknown;
	ensuringDefault: boolean;
	initialized: boolean;
}

/**
 * Mirrors the constitution builder's loading gate.
 *
 * Once a constitution (or its sections) has resolved, a transient `undefined`
 * from a query re-subscription must NOT flip this back to `true`. If it does,
 * `ConstitutionBuilderContent` swaps the document editor for a skeleton, which
 * unmounts the Tiptap editor and discards the user's unsaved edits.
 */
export function isConstitutionDataLoading({
	isAuthenticated,
	logtoId,
	constitution,
	sections,
	ensuringDefault,
	initialized,
}: ConstitutionDataLoadingInput): boolean {
	const authed = Boolean(isAuthenticated && logtoId);
	const constitutionLoading = authed && constitution === undefined;
	const sectionsLoading = Boolean(constitution) && sections === undefined;
	const needsInitialization = authed && !initialized;

	return (
		constitutionLoading ||
		sectionsLoading ||
		ensuringDefault ||
		needsInitialization ||
		constitution === null
	);
}
