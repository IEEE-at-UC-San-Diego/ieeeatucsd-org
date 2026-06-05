import { useQuery } from "convex/react";
import { useAuthedQuery, useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import {
  ConstitutionDocumentSaveResult,
  ConstitutionDocumentSectionInput,
  ConstitutionSection,
  ConstitutionVersion,
  SaveStatus,
} from "../types";
import { useAuth } from "@/hooks/useAuth";
import { useCallback, useEffect, useState } from "react";

export function useConstitutionData() {
  const { isAuthenticated, logtoId } = useAuth();
  const [initialized, setInitialized] = useState(false);
  const [ensuringDefault, setEnsuringDefault] = useState(false);

  // Get or ensure constitution exists
  const constitution = useAuthedQuery(
    api.constitutions.getDefault,
    logtoId ? { logtoId } : "skip",
  );
  const ensureConstitution = useAuthedMutation(api.constitutions.ensureDefaultConstitution);

  // Get sections - only when we have a valid constitution ID
  // getSections is a public query with no auth args
  const sections = useQuery(
    api.constitutions.getSections,
    constitution ? { constitutionId: constitution._id } : "skip",
  );
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
  const restoreVersionMutation = useAuthedMutation(api.constitutions.restoreVersion);

  const constitutionLoading =
    Boolean(isAuthenticated && logtoId) && constitution === undefined;
  const sectionsLoading = Boolean(constitution) && sections === undefined;
  const needsInitialization = Boolean(
    isAuthenticated && logtoId && !initialized,
  );
  const isLoading =
    constitutionLoading ||
    sectionsLoading ||
    ensuringDefault ||
    needsInitialization ||
    constitution === null;
  const saveStatus: SaveStatus = isLoading ? "idle" : "saved";

  // Auto-initialize constitution when authenticated
  useEffect(() => {
    if (!isAuthenticated || !logtoId) {
      setInitialized(false);
      setEnsuringDefault(false);
      return;
    }

    if (constitution && !initialized) {
      setInitialized(true);
      return;
    }

    if (constitution === null && !ensuringDefault) {
      setEnsuringDefault(true);
      ensureConstitution({ logtoId })
        .then(() => setInitialized(true))
        .finally(() => setEnsuringDefault(false));
    }
  }, [
    isAuthenticated,
    logtoId,
    initialized,
    constitution,
    ensureConstitution,
    ensuringDefault,
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
      siblings.length > 0
        ? Math.max(...siblings.map((s) => s.order)) + 1
        : 1;

    let articleNumber: number | undefined;
    let sectionNumber: number | undefined;
    let amendmentNumber: number | undefined;

    const existingArticles = existingSections.filter((s) => s.type === "article");
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

  const handleReorderSection = async (
    sectionId: string,
    newOrder: number,
  ) => {
    if (!constitution || !logtoId) return;

    await reorderSection({
      logtoId,
      constitutionId: constitution._id,
      sectionId,
      newOrder,
    });
  };

  const initializeConstitution = useCallback(async () => {
    if (!isAuthenticated || !logtoId || ensuringDefault) return;
    if (constitution) {
      setInitialized(true);
      return;
    }
    setEnsuringDefault(true);
    try {
      await ensureConstitution({ logtoId });
      setInitialized(true);
    } finally {
      setEnsuringDefault(false);
    }
  }, [isAuthenticated, logtoId, ensuringDefault, constitution, ensureConstitution]);

  const handleSaveDocumentSections = useCallback(async (
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
  }, [constitution, logtoId, syncDocumentSections]);

  const handleSaveVersion = useCallback(async (note?: string) => {
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
  }, [constitution, logtoId, saveVersionMutation]);

  const handleRestoreVersion = useCallback(async (versionId: string) => {
    if (!constitution || !logtoId) {
      return null;
    }

    return await restoreVersionMutation({
      logtoId,
      constitutionId: constitution._id,
      versionId: versionId as any,
    });
  }, [constitution, logtoId, restoreVersionMutation]);

  return {
    constitution,
    sections: sections || [],
    versions: (versions || []) as ConstitutionVersion[],
    isLoading,
    saveStatus,
    addSection: handleAddSection,
    updateSection: handleUpdateSection,
    deleteSection: handleDeleteSection,
    reorderSection: handleReorderSection,
    saveDocumentSections: handleSaveDocumentSections,
    saveVersion: handleSaveVersion,
    restoreVersion: handleRestoreVersion,
    initializeConstitution,
    constitutionId: constitution?._id,
  };
}
