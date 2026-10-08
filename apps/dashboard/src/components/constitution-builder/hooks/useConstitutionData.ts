import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import type {
	ConstitutionDocumentSaveResult,
	ConstitutionDocumentSectionInput,
	ConstitutionSection,
	ConstitutionVersion,
} from "../types";
import {
	isConstitutionDataLoading,
	resolveStableValue,
	retryWithBackoff,
} from "./constitutionDataState";

type ConstitutionDoc = Doc<"constitutions">;

const MAX_ENSURE_ATTEMPTS = 3;
const ENSURE_RETRY_DELAY_MS = 1_000;

function ensureErrorMessage(error: unknown): string {
	return error instanceof Error && error.message
		? error.message
		: "Failed to initialize the constitution";
}

export function useConstitutionData() {
	const { isAuthenticated, logtoId } = useAuth();
	const [initialized, setInitialized] = useState(false);
	const [ensuringDefault, setEnsuringDefault] = useState(false);
	const [ensureError, setEnsureError] = useState<string | null>(null);

	// Remember the last successfully resolved values so a transient `undefined`
	// (e.g. an authed query re-subscribing after the auth session token rotates)
	// does not drop the builder back into its loading state. Doing so would
	// replace the document editor with a skeleton, unmount the Tiptap editor,
	// and discard the user's unsaved edits.
	const lastConstitutionRef = useRef<ConstitutionDoc | null | undefined>(
		undefined,
	);
	const lastSectionsRef = useRef<
		ConstitutionDoc["sections"] | null | undefined
	>(undefined);
	const ensuringDefaultRef = useRef(false);

	// Get or ensure constitution exists
	const rawConstitution = useAuthedQuery(
		api.constitutions.getDefault,
		logtoId ? { logtoId } : "skip",
	);
	const ensureConstitution = useAuthedMutation(
		api.constitutions.ensureDefaultConstitution,
	);
	const ensureConstitutionRef = useRef(ensureConstitution);
	ensureConstitutionRef.current = ensureConstitution;

	const stableConstitution = resolveStableValue(
		rawConstitution,
		lastConstitutionRef.current,
	);
	lastConstitutionRef.current = stableConstitution.lastResolved;
	const constitution = stableConstitution.value;

	// Get sections - only when we have a valid constitution ID.
	// getSections is a public query with no auth args, so once the constitution
	// has resolved it keeps receiving updates while the authed query above
	// re-subscribes.
	const rawSections = useQuery(
		api.constitutions.getSections,
		constitution ? { constitutionId: constitution._id } : "skip",
	);
	const stableSections = resolveStableValue(
		rawSections,
		lastSectionsRef.current,
	);
	lastSectionsRef.current = stableSections.lastResolved;
	const sections = stableSections.value;

	const versions = useAuthedQuery(
		api.constitutions.listVersions,
		constitution && logtoId
			? { constitutionId: constitution._id, logtoId }
			: "skip",
	);

	// Mutations
	const addSection = useAuthedMutation(api.constitutions.addSection);
	const updateSection = useAuthedMutation(api.constitutions.updateSection);
	const deleteSection = useAuthedMutation(api.constitutions.deleteSection);
	const reorderSection = useAuthedMutation(api.constitutions.reorderSection);
	const syncDocumentSections = useAuthedMutation(
		api.constitutions.syncDocumentSections,
	);
	const saveVersionMutation = useAuthedMutation(api.constitutions.saveVersion);
	const restoreVersionMutation = useAuthedMutation(
		api.constitutions.restoreVersion,
	);

	const isLoading = isConstitutionDataLoading({
		isAuthenticated,
		logtoId,
		constitution,
		sections,
		ensuringDefault,
		initialized,
	});

	const initializeConstitution = useCallback(async () => {
		if (!isAuthenticated || !logtoId) return;
		if (constitution) {
			setInitialized(true);
			setEnsureError(null);
			return;
		}
		if (ensuringDefaultRef.current) return;

		ensuringDefaultRef.current = true;
		setEnsuringDefault(true);
		setEnsureError(null);

		try {
			await retryWithBackoff(() => ensureConstitutionRef.current({ logtoId }), {
				maxAttempts: MAX_ENSURE_ATTEMPTS,
				baseDelayMs: ENSURE_RETRY_DELAY_MS,
			});
			setInitialized(true);
		} catch (error) {
			setEnsureError(ensureErrorMessage(error));
		} finally {
			ensuringDefaultRef.current = false;
			setEnsuringDefault(false);
		}
	}, [isAuthenticated, logtoId, constitution]);

	const retryInitialize = useCallback(() => {
		setEnsureError(null);
		void initializeConstitution();
	}, [initializeConstitution]);

	// Auto-initialize the default constitution when authenticated and none
	// exists yet. Failures surface `ensureError` (with `retryInitialize`)
	// instead of leaving the builder stuck on its loading skeleton.
	useEffect(() => {
		if (!isAuthenticated || !logtoId) {
			setInitialized(false);
			setEnsuringDefault(false);
			setEnsureError(null);
			ensuringDefaultRef.current = false;
			return;
		}

		if (constitution) {
			setInitialized(true);
			setEnsureError(null);
			return;
		}

		if (constitution === null && !ensureError) {
			void initializeConstitution();
		}
	}, [
		isAuthenticated,
		logtoId,
		constitution,
		ensureError,
		initializeConstitution,
	]);

	const handleAddSection = async (
		type: ConstitutionSection["type"],
		parentId?: string,
		title?: string,
		content?: string,
	) => {
		if (!constitution || !logtoId) return;

		// Validate parent requirements
		if (type === "section" && !parentId) return;
		if (type === "subsection" && !parentId) return;

		const existingSections = sections || [];

		// Compute order scoped to siblings (same parentId), not global
		const siblings = existingSections.filter((s) =>
			parentId ? s.parentId === parentId : !s.parentId,
		);
		const newOrder =
			siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 1;

		let articleNumber: number | undefined;
		let sectionNumber: number | undefined;
		let amendmentNumber: number | undefined;

		const existingArticles = existingSections.filter(
			(s) => s.type === "article",
		);
		const existingAmendments = existingSections.filter(
			(s) => s.type === "amendment",
		);

		switch (type) {
			case "article":
				articleNumber = existingArticles.length + 1;
				break;
			case "section":
				if (parentId) {
					const parentSections = existingSections.filter(
						(s) => s.parentId === parentId && s.type === "section",
					);
					sectionNumber = parentSections.length + 1;
				}
				break;
			case "amendment":
				amendmentNumber = existingAmendments.length + 1;
				break;
		}

		await addSection({
			logtoId,
			constitutionId: constitution._id,
			type,
			title,
			content,
			parentId,
			articleNumber,
			sectionNumber,
			amendmentNumber,
			order: newOrder,
		});
	};

	const handleUpdateSection = async (
		sectionId: string,
		updates: Partial<ConstitutionSection>,
	) => {
		if (!constitution || !logtoId) return;

		await updateSection({
			logtoId,
			constitutionId: constitution._id,
			sectionId,
			title: updates.title,
			content: updates.content,
			order: updates.order,
			parentId: updates.parentId,
		});
	};

	const handleDeleteSection = async (sectionId: string) => {
		if (!constitution || !logtoId) return;

		await deleteSection({
			logtoId,
			constitutionId: constitution._id,
			sectionId,
		});
	};

	const handleReorderSection = async (sectionId: string, newOrder: number) => {
		if (!constitution || !logtoId) return;

		await reorderSection({
			logtoId,
			constitutionId: constitution._id,
			sectionId,
			newOrder,
		});
	};

	const handleSaveDocumentSections = useCallback(
		async (
			parsedSections: ConstitutionDocumentSectionInput[],
		): Promise<ConstitutionDocumentSaveResult> => {
			if (!constitution || !logtoId) {
				return {
					created: 0,
					updated: 0,
					deleted: 0,
					reordered: 0,
					total: 0,
				};
			}

			return await syncDocumentSections({
				logtoId,
				constitutionId: constitution._id,
				sections: parsedSections,
			});
		},
		[constitution, logtoId, syncDocumentSections],
	);

	const handleSaveVersion = useCallback(
		async (note?: string) => {
			if (!constitution || !logtoId) {
				return null;
			}

			const result = await saveVersionMutation({
				logtoId,
				constitutionId: constitution._id,
				note,
			});
			return {
				...result,
				versionId: result.versionId as string,
			};
		},
		[constitution, logtoId, saveVersionMutation],
	);

	const handleRestoreVersion = useCallback(
		async (versionId: string) => {
			if (!constitution || !logtoId) {
				return null;
			}

			return await restoreVersionMutation({
				logtoId,
				constitutionId: constitution._id,
				versionId: versionId as any,
			});
		},
		[constitution, logtoId, restoreVersionMutation],
	);

	return {
		constitution,
		sections: sections || [],
		versions: (versions || []) as ConstitutionVersion[],
		isLoading,
		addSection: handleAddSection,
		updateSection: handleUpdateSection,
		deleteSection: handleDeleteSection,
		reorderSection: handleReorderSection,
		saveDocumentSections: handleSaveDocumentSections,
		saveVersion: handleSaveVersion,
		restoreVersion: handleRestoreVersion,
		initializeConstitution,
		retryInitialize,
		ensureError,
		constitutionId: constitution?._id,
	};
}
