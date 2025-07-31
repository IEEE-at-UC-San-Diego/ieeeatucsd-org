import { useState, useMemo } from "react";
import type { ConstitutionSection } from "../types/firestore";
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

// Function to find which page a section appears on
const findSectionPage = (
  sectionId: string,
  sections: ConstitutionSection[],
  showTOC: boolean = true,
): number | null => {
  const contentPages = generateContentPages(sections);

  // Calculate TOC pages
  const tableOfContents = generateTableOfContents(sections);
  const tocPagesNeeded = Math.ceil(tableOfContents.length / 25);

  // Content starts after cover page (1) and TOC pages
  const contentStartPage = showTOC ? 2 + tocPagesNeeded : 2;

  // Find which content page contains the section
  for (let pageIndex = 0; pageIndex < contentPages.length; pageIndex++) {
    const page = contentPages[pageIndex];
    if (page.some((section) => section.id === sectionId)) {
      return contentStartPage + pageIndex;
    }
  }

  return null;
};

export const useConstitutionSearch = (sections: ConstitutionSection[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return [];
    }

    const query = searchQuery.toLowerCase().trim();
    const results: SearchResult[] = [];

    sections.forEach((section) => {
      const displayTitle = getSectionDisplayTitle(section, sections);
      const pageNumber = findSectionPage(section.id, sections);

      // Search in title
      if (section.title.toLowerCase().includes(query)) {
        results.push({
          section,
          matchType: "title",
          matchText: section.title,
          displayTitle,
          pageNumber,
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
          pageNumber,
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
  }, [searchQuery, sections]);

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
