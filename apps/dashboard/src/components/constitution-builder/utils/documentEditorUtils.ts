import {
  ConstitutionDocumentSectionInput,
  ConstitutionSection,
  ConstitutionSectionType,
} from "../types";

interface ParsedHeading {
  start: number;
  end: number;
  level: number;
  text: string;
  sectionId: string | null;
  sectionType: string | null;
  contentHtml: string;
}

/**
 * Builds a sorted, hierarchical list of sections for document rendering.
 * Top-level sections (preamble, article, amendment) come first sorted by order,
 * with children nested immediately after their parent.
 */
export function buildOrderedSections(
  sections: ConstitutionSection[],
): ConstitutionSection[] {
  const sorted = [...sections].sort((a, b) => a.order - b.order);

  const topLevel = sorted.filter(
    (s) => !s.parentId || !sections.find((p) => p.id === s.parentId),
  );

  const result: ConstitutionSection[] = [];

  const addWithChildren = (section: ConstitutionSection) => {
    result.push(section);
    const children = sorted.filter((s) => s.parentId === section.id);
    for (const child of children) {
      addWithChildren(child);
    }
  };

  for (const section of topLevel) {
    addWithChildren(section);
  }

  return result;
}

/**
 * Converts sections array into an HTML string for the Tiptap editor.
 * Each section heading gets data-section-id and data-section-type attributes.
 * Heading text contains ONLY the user's title - the auto-generated prefix
 * (e.g. "Article I", "Section 2") is rendered by a ProseMirror decoration plugin.
 */
export function sectionsToHtml(
  sections: ConstitutionSection[],
  allSections: ConstitutionSection[],
): string {
  const ordered = buildOrderedSections(sections);
  let html = "";

  for (const section of ordered) {
    const headingLevel = getHeadingLevel(section, allSections);
    const titleText = section.type === "preamble" ? "" : (section.title || "");

    html += `<h${headingLevel} data-section-id="${section.id}" data-section-type="${section.type}">${escapeHtml(titleText)}</h${headingLevel}>`;

    if (section.content && section.type !== "article") {
      const contentHtml = isHtmlContent(section.content)
        ? section.content
        : plainTextToHtml(section.content);
      html += contentHtml;
    }
  }

  return html;
}

/**
 * Parse the editor document into a fully normalized section list for atomic save.
 *
 * Rules:
 * - Existing headings with data-section-id preserve their ID when unique.
 * - New/unlinked headings get generated IDs.
 * - Type inference defaults to: h2 => article, h3 => section, h4+ => subsection.
 * - Parent inference uses nearest valid ancestor in heading hierarchy.
 * - Sibling order is re-assigned from document order for each parent.
 */
export function htmlToDocumentSections(
  html: string,
  originalSections: ConstitutionSection[],
): ConstitutionDocumentSectionInput[] {
  const parsedHeadings = parseHeadings(html);
  const existingById = new Map<string, ConstitutionSection>();
  for (const section of originalSections) {
    existingById.set(section.id, section);
  }

  const usedIds = new Set<string>();
  const siblingOrderCounters = new Map<string, number>();
  const stack: Array<{
    id: string;
    level: number;
    type: ConstitutionSectionType;
  }> = [];

  const result: ConstitutionDocumentSectionInput[] = [];

  for (const heading of parsedHeadings) {
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    const existingType = heading.sectionId
      ? existingById.get(heading.sectionId)?.type
      : undefined;
    const sectionType = resolveHeadingType(
      heading.level,
      heading.sectionType,
      existingType,
    );

    const parentId = inferParentId(sectionType, stack);
    const sectionId = resolveSectionId(heading.sectionId, usedIds);

    const orderScopeKey = parentId ?? "__root__";
    const nextOrder = (siblingOrderCounters.get(orderScopeKey) ?? 0) + 1;
    siblingOrderCounters.set(orderScopeKey, nextOrder);

    const title =
      sectionType === "preamble"
        ? ""
        : unescapeHtml(stripHtmlTags(heading.text)).trim();

    result.push({
      id: sectionId,
      type: sectionType,
      title,
      content: sectionType === "article" ? "" : heading.contentHtml.trim(),
      order: nextOrder,
      parentId,
    });

    stack.push({ id: sectionId, level: heading.level, type: sectionType });
  }

  return result;
}

function parseHeadings(html: string): ParsedHeading[] {
  const headingRegex = /<h([2-6])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  const headings: ParsedHeading[] = [];

  let headingMatch: RegExpExecArray | null;
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    const attrs = headingMatch[2];
    headings.push({
      start: headingMatch.index,
      end: headingMatch.index + headingMatch[0].length,
      level: Number(headingMatch[1]),
      text: headingMatch[3],
      sectionId: extractAttr(attrs, "data-section-id"),
      sectionType: extractAttr(attrs, "data-section-type"),
      contentHtml: "",
    });
  }

  for (let i = 0; i < headings.length; i++) {
    const contentStart = headings[i].end;
    const contentEnd = headings[i + 1]?.start ?? html.length;
    headings[i].contentHtml = html.slice(contentStart, contentEnd);
  }

  return headings;
}

function resolveHeadingType(
  level: number,
  attrType: string | null,
  existingType: ConstitutionSectionType | undefined,
): ConstitutionSectionType {
  if (isSectionType(attrType)) {
    return normalizeStructuralTypeForLevel(level, attrType);
  }

  if (existingType) {
    return normalizeStructuralTypeForLevel(level, existingType);
  }

  return headingLevelToType(level);
}

function normalizeStructuralTypeForLevel(
  level: number,
  type: ConstitutionSectionType,
): ConstitutionSectionType {
  if (type === "article" || type === "section" || type === "subsection") {
    return headingLevelToType(level);
  }

  return type;
}

function headingLevelToType(level: number): ConstitutionSectionType {
  if (level === 2) return "article";
  if (level === 3) return "section";
  return "subsection";
}

function resolveSectionId(
  candidateId: string | null,
  usedIds: Set<string>,
): string {
  if (candidateId && !usedIds.has(candidateId)) {
    usedIds.add(candidateId);
    return candidateId;
  }

  let id = createSectionId();
  while (usedIds.has(id)) {
    id = createSectionId();
  }

  usedIds.add(id);
  return id;
}

function inferParentId(
  sectionType: ConstitutionSectionType,
  stack: Array<{ id: string; level: number; type: ConstitutionSectionType }>,
): string | undefined {
  if (sectionType === "section") {
    const parent = findNearestAncestor(stack, (entry) => entry.type === "article");
    return parent?.id;
  }

  if (sectionType === "subsection") {
    const parent = findNearestAncestor(
      stack,
      (entry) => entry.type === "section" || entry.type === "subsection",
    );
    return parent?.id;
  }

  return undefined;
}

function findNearestAncestor<T>(
  stack: T[],
  predicate: (entry: T) => boolean,
): T | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (predicate(stack[i])) {
      return stack[i];
    }
  }
  return undefined;
}

function createSectionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `section-${Math.random().toString(36).slice(2, 11)}`;
}

function isSectionType(value: string | null): value is ConstitutionSectionType {
  return (
    value === "preamble" ||
    value === "article" ||
    value === "section" ||
    value === "subsection" ||
    value === "amendment"
  );
}

function extractAttr(attrs: string, name: string): string | null {
  const regex = new RegExp(`${name}="([^"]*)"`, "i");
  const match = attrs.match(regex);
  return match ? match[1] : null;
}

/**
 * Determines the heading level for a section based on its type and nesting.
 */
function getHeadingLevel(
  section: ConstitutionSection,
  allSections: ConstitutionSection[],
): number {
  switch (section.type) {
    case "preamble":
      return 2;
    case "article":
      return 2;
    case "section":
      return 3;
    case "amendment":
      return 2;
    case "subsection": {
      let depth = 4;
      let currentParentId = section.parentId;
      while (currentParentId) {
        const parent = allSections.find((s) => s.id === currentParentId);
        if (parent && parent.type === "subsection") {
          depth = Math.min(depth + 1, 6);
          currentParentId = parent.parentId;
        } else {
          break;
        }
      }
      return depth;
    }
    default:
      return 3;
  }
}

/**
 * Checks if a string contains HTML tags (vs plain text).
 */
export function isHtmlContent(text: string): boolean {
  if (!text) return false;
  return /<[a-z][\s\S]*>/i.test(text);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainTextToHtml(text: string): string {
  if (!text) return "";

  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (!trimmed) return "";
      const withBreaks = escapeHtml(trimmed).replace(/\n/g, "<br>");
      return `<p>${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/**
 * Normalize HTML for semantic comparison.
 */
export function normalizeHtmlForComparison(html: string): string {
  if (!html) return "";

  return html
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}
