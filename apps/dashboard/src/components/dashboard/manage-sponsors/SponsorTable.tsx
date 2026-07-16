import { Building2, ChevronDown, ChevronUp } from "lucide-react";
import { MobileDataList, MobileDataListItem } from "@/components/mobile";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SortConfig, SponsorDomain, SponsorTier } from "./types";

interface SponsorTableProps {
	sponsors: SponsorDomain[];
	sortConfig: SortConfig;
	onSort: (field: string) => void;
	onRowClick?: (sponsor: SponsorDomain) => void;
}

const tierColors: Record<SponsorTier, string> = {
	Bronze: "bg-ds-amber-100 text-ds-amber-900",
	Silver: "bg-muted text-foreground",
	Gold: "bg-ds-amber-100 text-ds-amber-900",
	Platinum: "bg-ds-blue-100 text-ds-purple-700",
	Diamond: "bg-ds-blue-100 text-ds-blue-700",
};

export function SponsorTable({
	sponsors,
	sortConfig,
	onSort,
	onRowClick,
}: SponsorTableProps) {
	const isMobile = useIsMobile();

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
			<div className="bg-background rounded-md border p-8 text-center">
				<div className="text-muted-foreground mb-4">
					<Building2 className="w-12 h-12 mx-auto" />
				</div>
				<h3 className="text-lg font-medium text-foreground mb-2">
					No sponsor domains found
				</h3>
				<p className="text-muted-foreground">
					Add a sponsor domain to automatically assign sponsor status to users
					with matching email addresses.
				</p>
			</div>
		);
	}

	if (isMobile) {
		return (
			<MobileDataList>
				{sponsors.map((sponsor) => (
					<MobileDataListItem
						key={sponsor._id}
						title={sponsor.organizationName}
						subtitle={
							<span className="font-mono text-xs">{sponsor.domain}</span>
						}
						status={
							<Badge
								className={`text-[10px] ${tierColors[sponsor.sponsorTier]}`}
							>
								{sponsor.sponsorTier}
							</Badge>
						}
						onClick={() => onRowClick?.(sponsor)}
					/>
				))}
			</MobileDataList>
		);
	}

	return (
		<div className="bg-background rounded-md border overflow-hidden">
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/50">
							<th
								className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
								onClick={() => onSort("organizationName")}
							>
								<span className="flex items-center gap-1">
									Organization {getSortIcon("organizationName")}
								</span>
							</th>
							<th
								className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
								onClick={() => onSort("domain")}
							>
								<span className="flex items-center gap-1">
									Domain {getSortIcon("domain")}
								</span>
							</th>
							<th
								className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
								onClick={() => onSort("sponsorTier")}
							>
								<span className="flex items-center gap-1">
									Tier {getSortIcon("sponsorTier")}
								</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{sponsors.map((sponsor, idx) => (
							<tr
								key={sponsor._id}
								className={`border-b last:border-b-0 hover:bg-muted transition-colors cursor-pointer ${idx % 2 === 1 ? "bg-muted/30" : ""}`}
								onClick={() => onRowClick?.(sponsor)}
							>
								<td className="p-4">
									<div className="text-sm font-medium text-foreground">
										{sponsor.organizationName}
									</div>
								</td>
								<td className="p-4">
									<div className="text-sm font-mono text-foreground">
										{sponsor.domain}
									</div>
								</td>
								<td className="p-4">
									<Badge
										className={`text-xs ${tierColors[sponsor.sponsorTier]}`}
									>
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
