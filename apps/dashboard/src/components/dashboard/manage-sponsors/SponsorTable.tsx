import { ChevronUp, ChevronDown, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SponsorDomain, SortConfig, SponsorTier } from "./types";

interface SponsorTableProps {
  sponsors: SponsorDomain[];
  sortConfig: SortConfig;
  onSort: (field: string) => void;
  onRowClick?: (sponsor: SponsorDomain) => void;
}

const tierColors: Record<SponsorTier, string> = {
  Bronze: "bg-orange-100 text-orange-800",
  Silver: "bg-gray-100 text-gray-800",
  Gold: "bg-yellow-100 text-yellow-800",
  Platinum: "bg-purple-100 text-purple-800",
  Diamond: "bg-blue-100 text-blue-800",
};

export function SponsorTable({
  sponsors,
  sortConfig,
  onSort,
  onRowClick,
}: SponsorTableProps) {
  const getSortIcon = (field: string) => {
    if (sortConfig.field === field) {
      return sortConfig.direction === "asc" ? (
        <ChevronUp className="w-3.5 h-3.5" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5" />
      );
    }
    return null;
  };

  if (sponsors.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <div className="text-gray-400 mb-4">
          <Building2 className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No sponsor domains found</h3>
        <p className="text-gray-500">
          Add a sponsor domain to automatically assign sponsor status to users with matching email addresses.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/50">
              <th className="text-left p-4 font-medium text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort("organizationName")}>
                <span className="flex items-center gap-1">Organization {getSortIcon("organizationName")}</span>
              </th>
              <th className="text-left p-4 font-medium text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort("domain")}>
                <span className="flex items-center gap-1">Domain {getSortIcon("domain")}</span>
              </th>
              <th className="text-left p-4 font-medium text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort("sponsorTier")}>
                <span className="flex items-center gap-1">Tier {getSortIcon("sponsorTier")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sponsors.map((sponsor, idx) => (
              <tr
                key={sponsor._id}
                className={`border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer ${idx % 2 === 1 ? "bg-gray-50/30" : ""}`}
                onClick={() => onRowClick?.(sponsor)}
              >
                <td className="p-4">
                  <div className="text-sm font-medium text-gray-900">
                    {sponsor.organizationName}
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm font-mono text-gray-900">
                    {sponsor.domain}
                  </div>
                </td>
                <td className="p-4">
                  <Badge className={`text-xs ${tierColors[sponsor.sponsorTier]}`}>
                    {sponsor.sponsorTier}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
