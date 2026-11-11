import { useBlocker } from "@tanstack/react-router";
import { useCallback } from "react";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";

const DISCARD_OPTIONS = {
	title: "Discard Unsaved Changes?",
	description: "Your edits haven’t been saved and will be lost.",
	confirmLabel: "Discard Changes",
	cancelLabel: "Keep Editing",
	destructive: true,
} as const;

/**
 * Warns before route navigation or tab close while `isDirty`.
 * Returns `confirmDiscard()` for in-page exits (closing a modal, "Back" buttons)
 * that the router can't see: `if (!(await confirmDiscard())) return;`
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
	const confirm = useConfirm();

	useBlocker({
		shouldBlockFn: async () => !(await confirm(DISCARD_OPTIONS)),
		enableBeforeUnload: () => isDirty,
		disabled: !isDirty,
	});

	return useCallback(
		async () => (isDirty ? confirm(DISCARD_OPTIONS) : true),
		[confirm, isDirty],
	);
}
