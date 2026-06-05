import { ConstitutionSection } from "../types";

/**
 * Section Management Utilities
 */

/**
 * Sort sections by their order property
 */
export const sortSectionsByOrder = (
  sections: ConstitutionSection[],
): ConstitutionSection[] => {
  return [...sections].sort((a, b) => a.order - b.order);
};

/**
 * Build a hierarchical tree of sections
 * Returns root sections with nested children
 */
export const buildSectionTree = (
  sections: ConstitutionSection[],
): ConstitutionSection[] => {
  const sortedSections = sortSectionsByOrder(sections);
  const sectionMap = new Map<string, ConstitutionSection>();
  const rootSections: ConstitutionSection[] = [];

  // Initialize map
  sortedSections.forEach((section) => {
    sectionMap.set(section.id, { ...section, children: [] });
  });

  // Build tree
  sortedSections.forEach((section) => {
    const mappedSection = sectionMap.get(section.id)!;
    if (section.parentId && sectionMap.has(section.parentId)) {
      const parent = sectionMap.get(section.parentId)!;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(mappedSection);
    } else {
      rootSections.push(mappedSection);
    }
  });

  return rootSections;
};

/**
 * Get all sections in a flat list with their depth level
 */
export const getSectionsWithDepth = (
  sections: ConstitutionSection[],
): Array<ConstitutionSection & { depth: number }> => {
  const result: Array<ConstitutionSection & { depth: number }> = [];

  const traverse = (
    sectionList: ConstitutionSection[],
    depth = 0,
    parentId?: string,
  ) => {
    const sorted = [...sectionList]
      .filter((s) => s.parentId === parentId)
      .sort((a, b) => a.order - b.order);

    sorted.forEach((section) => {
      result.push({ ...section, depth });
      traverse(sectionList, depth + 1, section.id);
    });
  };

  traverse(sections);
  return result;
};

/**
 * Calculate the maximum order value for sections with a specific parent
 */
export const getMaxOrder = (
  sections: ConstitutionSection[],
  parentId?: string,
): number => {
  const siblings = sections.filter((s) => s.parentId === parentId);
  if (siblings.length === 0) return -1;
  return Math.max(...siblings.map((s) => s.order));
};

/**
 * Reorder sections by moving a section to a new position
 */
export const reorderSections = (
  sections: ConstitutionSection[],
  sectionId: string,
  newOrder: number,
): ConstitutionSection[] => {
  const sectionToMove = sections.find((s) => s.id === sectionId);
  if (!sectionToMove) return sections;

  const parentId = sectionToMove.parentId;
  const siblings = sections.filter((s) => s.parentId === parentId);

  // Remove the section from its current position
  const updatedSections = sections.filter((s) => s.id !== sectionId);

  // Adjust orders of other sections
  const adjustedSiblings = siblings
    .filter((s) => s.id !== sectionId)
    .map((s) => ({
      ...s,
      order: s.order >= newOrder ? s.order + 1 : s.order,
    }));

  // Add the moved section with new order
  const movedSection = { ...sectionToMove, order: newOrder };

  // Merge sections
  const otherSections = updatedSections.filter(
    (s) => !siblings.some((sib) => sib.id === s.id),
  );

  return [...otherSections, ...adjustedSiblings, movedSection];
};

/**
 * Move a section up in order
 */
export const moveSectionUp = (
  sections: ConstitutionSection[],
  sectionId: string,
): ConstitutionSection[] => {
  const sectionToMove = sections.find((s) => s.id === sectionId);
  if (!sectionToMove || sectionToMove.order <= 0) return sections;

  const parentId = sectionToMove.parentId;
  const previousSection = [...sections]
    .filter((s) => s.parentId === parentId && s.order === sectionToMove.order - 1)
    .pop();

  if (!previousSection) return sections;

  return sections.map((s) => {
    if (s.id === sectionId) {
      return { ...s, order: previousSection.order };
    }
    if (s.id === previousSection.id) {
      return { ...s, order: sectionToMove.order };
    }
    return s;
  });
};

/**
 * Move a section down in order
 */
export const moveSectionDown = (
  sections: ConstitutionSection[],
  sectionId: string,
): ConstitutionSection[] => {
  const sectionToMove = sections.find((s) => s.id === sectionId);
  if (!sectionToMove) return sections;

  const parentId = sectionToMove.parentId;
  const nextSection = [...sections]
    .filter((s) => s.parentId === parentId && s.order === sectionToMove.order + 1)
    .pop();

  if (!nextSection) return sections;

  return sections.map((s) => {
    if (s.id === sectionId) {
      return { ...s, order: nextSection.order };
    }
    if (s.id === nextSection.id) {
      return { ...s, order: sectionToMove.order };
    }
    return s;
  });
};

/**
 * Find a section by ID in a nested tree
 */
export const findSectionById = (
  sections: ConstitutionSection[],
  id: string,
): ConstitutionSection | undefined => {
  for (const section of sections) {
    if (section.id === id) return section;
    if (section.children) {
      const found = findSectionById(section.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

/**
 * Get all parent sections up to the root
 */
export const getSectionPath = (
  sections: ConstitutionSection[],
  sectionId: string,
): ConstitutionSection[] => {
  const path: ConstitutionSection[] = [];
  let currentSection = sections.find((s) => s.id === sectionId);

  while (currentSection) {
    path.unshift(currentSection);
    if (currentSection.parentId) {
      const parentSection = sections.find((s) => s.id === currentSection!.parentId);
      if (!parentSection) break;
      currentSection = parentSection;
    } else {
      break;
    }
  }

  return path;
};

/**
 * Validate a section structure
 */
export const validateSection = (section: ConstitutionSection): string[] => {
  const errors: string[] = [];

  if (!section.type) {
    errors.push("Section type is required");
  }

  if (section.type === "article" && typeof section.articleNumber !== "number") {
    errors.push("Article sections require an article number");
  }

  if (section.type === "section" && typeof section.sectionNumber !== "number") {
    errors.push("Section sections require a section number");
  }

  if (
    section.type === "subsection" &&
    typeof section.subsectionLetter !== "string"
  ) {
    errors.push("Subsection sections require a subsection letter");
  }

  if (typeof section.order !== "number") {
    errors.push("Section order is required");
  }

  if (!section.content && section.type !== "article") {
    errors.push("Section content is required");
  }

  return errors;
};

/**
 * Create a deep copy of a section with new IDs for children
 */
export const cloneSection = (
  section: ConstitutionSection,
  newParentId?: string,
): ConstitutionSection => {
  const newSection: ConstitutionSection = {
    ...section,
    id: crypto.randomUUID(),
    parentId: newParentId || section.parentId,
    createdAt: Date.now(),
    lastModified: Date.now(),
  };

  if (section.children && section.children.length > 0) {
    newSection.children = section.children.map((child: ConstitutionSection) =>
      cloneSection(child, newSection.id),
    );
  }

  return newSection;
};

/**
 * Count total sections including nested children
 */
export const countSections = (sections: ConstitutionSection[]): number => {
  let count = 0;

  const traverse = (sectionList: ConstitutionSection[]) => {
    for (const section of sectionList) {
      count++;
      if (section.children) {
        traverse(section.children);
      }
    }
  };

  traverse(sections);
  return count;
};
