import React, { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ConstitutionSearchProps {
  sections: any[];
  onSelectSection: (id: string) => void;
}

const ConstitutionSearch: React.FC<ConstitutionSearchProps> = ({
  sections,
  onSelectSection,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    return sections.filter((section: any) => {
      return (
        section.title?.toLowerCase().includes(query) ||
        section.content?.toLowerCase().includes(query) ||
        section.type?.toLowerCase().includes(query)
      );
    });
  }, [sections, searchQuery]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setShowResults(!!value.trim());
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search sections..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-10"
          onFocus={() => setShowResults(true)}
        />
      </div>

      {showResults && filteredSections.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 max-h-64 overflow-y-auto">
          {filteredSections.map((section: any) => (
            <button
              key={section.id}
              onClick={() => {
                onSelectSection(section.id);
                setSearchQuery("");
                setShowResults(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700 border-b border-gray-100 last:border-0"
            >
              <div className="font-medium">{section.title || "Untitled"}</div>
              <div className="text-xs text-gray-500 capitalize">{section.type}</div>
            </button>
          ))}
        </div>
      )}

      {showResults && searchQuery && filteredSections.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500 text-center">No sections found</div>
        </div>
      )}
    </div>
  );
};

export default ConstitutionSearch;
