import { useState, useMemo, useEffect } from "react";
import type { ConstitutionSection } from "../../../shared/types/firestore";
import { getSectionDisplayTitle } from "../utils/constitutionUtils";
import {
  generateContentPages,
  generateTableOfContents,
} from "../utils/printUtils";

export interface SearchResult {
  section: ConstitutionSection;
  matchType: "title" | "content";
  matchText: string;
  displayTitle: string;
  pageNumber?: number;
}

// Memoized function to create section-to-page mapping
const createSectionPageMap = (
  sections: ConstitutionSection[],
): Map<string, number> => {
  const contentPages = generateContentPages(sections);
  const tableOfContents = generateTableOfContents(sections);
  const tocPagesNeeded = Math.ceil(tableOfContents.length / 25);
  const contentStartPage = 2 + tocPagesNeeded; // Content starts after cover page (1) and TOC pages

  const sectionPageMap = new Map<string, number>();

  contentPages.forEach((page, pageIndex) => {
    const actualPageNum = contentStartPage + pageIndex;
    page.forEach((section) => {
      if (!sectionPageMap.has(section.id)) {
        sectionPageMap.set(section.id, actualPageNum);
      }
    });
  });

  return sectionPageMap;
};

export const useConstitutionSearch = (sections: ConstitutionSection[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Debounce search query for results calculation
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150); // 150ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Memoize the section page map to avoid recalculating on every search
  const sectionPageMap = useMemo(
    () => createSectionPageMap(sections),
    [sections],
  );

  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
      return [];
    }

    const query = debouncedQuery.toLowerCase().trim();
    const results: SearchResult[] = [];

    sections.forEach((section) => {
      const displayTitle = getSectionDisplayTitle(section, sections);
      const pageNumber = sectionPageMap.get(section.id) || null;

      // Search in title
      if (section.title.toLowerCase().includes(query)) {
        results.push({
          section,
          matchType: "title",
          matchText: section.title,
          displayTitle,
          pageNumber: pageNumber ?? undefined,
        });
      }
      // Search in content (only if not already matched by title)
      else if (
        section.content &&
        section.content.toLowerCase().includes(query)
      ) {
        // Get a snippet of the content around the match
        const contentLower = section.content.toLowerCase();
        const matchIndex = contentLower.indexOf(query);
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(
          section.content.length,
          matchIndex + query.length + 50,
        );
        let snippet = section.content.substring(start, end);

        // Add ellipsis if we truncated
        if (start > 0) snippet = "..." + snippet;
        if (end < section.content.length) snippet = snippet + "...";

        results.push({
          section,
          matchType: "content",
          matchText: snippet,
          displayTitle,
          pageNumber: pageNumber ?? undefined,
        });
      }
    });

    // Sort results: title matches first, then by section order
    return results.sort((a, b) => {
      if (a.matchType !== b.matchType) {
        return a.matchType === "title" ? -1 : 1;
      }
      return a.section.order - b.section.order;
    });
  }, [debouncedQuery, sections]);

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchOpen(false);
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearchOpen,
    setIsSearchOpen,
    clearSearch,
    hasResults: searchResults.length > 0,
  };
};
