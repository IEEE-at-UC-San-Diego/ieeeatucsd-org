import React from "react";
import { getCategoryColor } from "../utils/linkPermissions";

interface LinkFiltersProps {
  categoryFilter: string;
  onCategoryChange: (category: string) => void;
  linkCounts: Record<string, number>;
}

export default function LinkFilters({
  categoryFilter,
  onCategoryChange,
  linkCounts,
}: LinkFiltersProps) {
  const totalCount = Object.values(linkCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  // Get all unique categories from linkCounts
  const categories = Object.keys(linkCounts).sort();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* All Categories */}
      <button
        onClick={() => onCategoryChange("all")}
        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${categoryFilter === "all"
            ? "bg-gray-900 border-gray-900 text-white shadow-md transform scale-105"
            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
          }`}
      >
        All <span className="ml-1 opacity-60">({totalCount})</span>
      </button>

      <div className="w-px h-8 bg-gray-200 mx-1 hidden sm:block" />

      {/* Individual Categories */}
      {categories.map((category) => {
        const count = linkCounts[category] || 0;
        const info = getCategoryColor(category);
        const isActive = categoryFilter === category;

        return (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${isActive
                ? `${info.bgColor} ${info.borderColor} ${info.color} shadow-sm transform scale-105 ring-1 ring-offset-1 ring-transparent`
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
          >
            {category} <span className="ml-1 opacity-60">({count})</span>
          </button>
        );
      })}
    </div>
  );
}

