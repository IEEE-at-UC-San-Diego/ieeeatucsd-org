import { ConstitutionSection } from "../types";

export const toRomanNumeral = (num: number): string => {
  const romanNumerals = [
    { value: 1000, symbol: "M" },
    { value: 900, symbol: "CM" },
    { value: 500, symbol: "D" },
    { value: 400, symbol: "CD" },
    { value: 100, symbol: "C" },
    { value: 90, symbol: "XC" },
    { value: 50, symbol: "L" },
    { value: 40, symbol: "XL" },
    { value: 10, symbol: "X" },
    { value: 9, symbol: "IX" },
    { value: 5, symbol: "V" },
    { value: 4, symbol: "IV" },
    { value: 1, symbol: "I" },
  ];

  let result = "";
  for (const { value, symbol } of romanNumerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
};

export const getSectionHierarchy = (sections: ConstitutionSection[]) => {
  const hierarchy: ConstitutionSection[] = [];
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  sortedSections.forEach((section) => {
    hierarchy.push(section);
  });

  return hierarchy;
};

export const getSectionDisplayTitle = (
  section: ConstitutionSection,
  allSections: ConstitutionSection[],
) => {
  switch (section.type) {
    case "preamble":
      return "Preamble";
    case "article": {
      const articles = allSections
        .filter((s) => s.type === "article")
        .sort((a, b) => a.order - b.order);
      const articleIndex = articles.findIndex((a) => a.id === section.id) + 1;
      return section.title
        ? `Article ${toRomanNumeral(articleIndex)} - ${section.title}`
        : `Article ${toRomanNumeral(articleIndex)}`;
    }
    case "section": {
      const siblingSections = allSections
        .filter(
          (s) => s.parentId === section.parentId && s.type === "section",
        )
        .sort((a, b) => a.order - b.order);
      const sectionIndex =
        siblingSections.findIndex((s) => s.id === section.id) + 1;
      return section.title
        ? `Section ${sectionIndex} - ${section.title}`
        : `Section ${sectionIndex}`;
    }
    case "subsection":
      return getSubsectionDisplayTitle(section, allSections);
    case "amendment": {
      const amendments = allSections
        .filter((s) => s.type === "amendment")
        .sort((a, b) => a.order - b.order);
      const amendmentIndex =
        amendments.findIndex((a) => a.id === section.id) + 1;
      return section.title
        ? `Amendment ${amendmentIndex} - ${section.title}`
        : `Amendment ${amendmentIndex}`;
    }
    default:
      return section.title || "Untitled Section";
  }
};

export const getSubsectionDisplayTitle = (
  section: ConstitutionSection,
  allSections: ConstitutionSection[],
): string => {
  const findRootSection = (
    currentSection: ConstitutionSection,
  ): ConstitutionSection | null => {
    if (currentSection.type === "section") {
      return currentSection;
    }

    if (currentSection.parentId) {
      const parent = allSections.find((s) => s.id === currentSection.parentId);
      if (parent) {
        return findRootSection(parent);
      }
    }

    return null;
  };

  const rootSection = findRootSection(section);
  if (!rootSection) return `Subsection - ${section.title}`;

  const articleSections = allSections
    .filter(
      (s) =>
        s.parentId === rootSection.parentId && s.type === "section",
    )
    .sort((a, b) => a.order - b.order);
  const sectionNumber =
    articleSections.findIndex((s) => s.id === rootSection.id) + 1;

  const buildHierarchy = (currentSection: ConstitutionSection): string => {
    const parent = allSections.find((s) => s.id === currentSection.parentId);
    if (!parent) return "";

    const siblings = allSections
      .filter(
        (s) =>
          s.parentId === currentSection.parentId && s.type === "subsection",
      )
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((s) => s.id === currentSection.id) + 1;

    if (parent.type === "section") {
      return `${sectionNumber}.${index}`;
    } else if (parent.type === "subsection") {
      const parentNumber = buildHierarchy(parent);
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      return `${parentNumber}${letters[index - 1] || index}`;
    }

    return "";
  };

  const subsectionNumber = buildHierarchy(section);
  return section.title
    ? `Subsection ${subsectionNumber} - ${section.title}`
    : `Subsection ${subsectionNumber}`;
};

/**
 * Returns just the auto-generated prefix for a section (e.g., "Article I", "Section 1",
 * "Subsection 1.2") without the user's title. Used by the document editor to render
 * non-editable prefix decorations on headings.
 */
export const getSectionPrefix = (
  section: ConstitutionSection,
  allSections: ConstitutionSection[],
): string => {
  switch (section.type) {
    case "preamble":
      return "Preamble";
    case "article": {
      const articles = allSections
        .filter((s) => s.type === "article")
        .sort((a, b) => a.order - b.order);
      const articleIndex = articles.findIndex((a) => a.id === section.id) + 1;
      return `Article ${toRomanNumeral(articleIndex)}`;
    }
    case "section": {
      const siblingSections = allSections
        .filter(
          (s) => s.parentId === section.parentId && s.type === "section",
        )
        .sort((a, b) => a.order - b.order);
      const sectionIndex =
        siblingSections.findIndex((s) => s.id === section.id) + 1;
      return `Section ${sectionIndex}`;
    }
    case "subsection":
      return getSubsectionPrefix(section, allSections);
    case "amendment": {
      const amendments = allSections
        .filter((s) => s.type === "amendment")
        .sort((a, b) => a.order - b.order);
      const amendmentIndex =
        amendments.findIndex((a) => a.id === section.id) + 1;
      return `Amendment ${amendmentIndex}`;
    }
    default:
      return "";
  }
};

const getSubsectionPrefix = (
  section: ConstitutionSection,
  allSections: ConstitutionSection[],
): string => {
  const findRootSection = (
    currentSection: ConstitutionSection,
  ): ConstitutionSection | null => {
    if (currentSection.type === "section") {
      return currentSection;
    }
    if (currentSection.parentId) {
      const parent = allSections.find((s) => s.id === currentSection.parentId);
      if (parent) {
        return findRootSection(parent);
      }
    }
    return null;
  };

  const rootSection = findRootSection(section);
  if (!rootSection) return "Subsection";

  const articleSections = allSections
    .filter(
      (s) =>
        s.parentId === rootSection.parentId && s.type === "section",
    )
    .sort((a, b) => a.order - b.order);
  const sectionNumber =
    articleSections.findIndex((s) => s.id === rootSection.id) + 1;

  const buildHierarchy = (currentSection: ConstitutionSection): string => {
    const parent = allSections.find((s) => s.id === currentSection.parentId);
    if (!parent) return "";

    const siblings = allSections
      .filter(
        (s) =>
          s.parentId === currentSection.parentId && s.type === "subsection",
      )
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((s) => s.id === currentSection.id) + 1;

    if (parent.type === "section") {
      return `${sectionNumber}.${index}`;
    } else if (parent.type === "subsection") {
      const parentNumber = buildHierarchy(parent);
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      return `${parentNumber}${letters[index - 1] || index}`;
    }

    return "";
  };

  const subsectionNumber = buildHierarchy(section);
  return `Subsection ${subsectionNumber}`;
};

export const getSubsectionIndentLevel = (
  section: ConstitutionSection,
  allSections: ConstitutionSection[],
): number => {
  if (section.type === "preamble") return 0;
  if (section.type === "article") return 0;
  if (section.type === "amendment") return 0;
  if (section.type === "section") return 1;

  if (section.type === "subsection") {
    // Calculate nesting depth for subsections
    let depth = 2;
    let currentParentId = section.parentId;

    while (currentParentId) {
      const parent = allSections.find((s) => s.id === currentParentId);
      if (parent && parent.type === "subsection") {
        depth++;
        currentParentId = parent.parentId;
      } else {
        break;
      }
    }
    return depth;
  }

  return 0;
};
