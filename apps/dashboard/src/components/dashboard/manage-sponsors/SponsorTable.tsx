import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { DotLabel, type DotTone } from "@/components/dashboard/DotLabel";
import { MobileDataList, MobileDataListItem } from "@/components/mobile";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SortConfig, SponsorDomain, SponsorTier } from "./types";

interface SponsorTableProps {
	sponsors: SponsorDomain[];
	sortConfig: SortConfig;
	onSort: (field: string) => void;
	onRowClick?: (sponsor: SponsorDomain) => void;
}

const tierTone: Record<SponsorTier, DotTone> = {
	Bronze: "amber",
	Silver: "gray",
	Gold: "amber",
	Platinum: "purple",
	Diamond: "blue",
};

function TierChip({ tier }: { tier: SponsorTier }) {
	return <DotLabel tone={tierTone[tier]}>{tier}</DotLabel>;
}

export function SponsorTable({
	sponsors,
	sortConfig,
	onSort,
	onRowClick,
}: SponsorTableProps) {
	const isMobile = useIsMobile();

	const getSortIcon = (field: string) => {
		if (sortConfig.field !== field) return null;
		return sortConfig.direction === "asc" ? (
			<ChevronUp className="size-3" />
		) : (
			<ChevronDown className="size-3" />
		);
	};

	const sortableHead = (field: string, label: string) => (
		<th
			scope="col"
			aria-sort={
				sortConfig.field === field
					? sortConfig.direction === "asc"
						? "ascending"
						: "descending"
					: "none"
			}
			className="p-0 text-left"
		>
			<button
				type="button"
				onClick={() => onSort(field)}
				className="flex w-full items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				{label}
				{getSortIcon(field)}
			</button>
		</th>
	);

	if (sponsors.length === 0) {
		return (
			<div className="flex flex-col items-center rounded-md border border-dashed px-6 py-14 text-center">
				<h3 className="text-sm font-semibold text-foreground">
					No sponsor domains found
				</h3>
				<p className="mt-1 max-w-md text-sm text-muted-foreground">
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
						status={<TierChip tier={sponsor.sponsorTier} />}
						onClick={() => onRowClick?.(sponsor)}
					/>
				))}
			</MobileDataList>
		);
	}

	return (
		<div className="overflow-hidden rounded-md border">
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b">
							{sortableHead("organizationName", "Organization")}
							{sortableHead("domain", "Domain")}
							{sortableHead("sponsorTier", "Tier")}
							<th scope="col" className="w-10" />
						</tr>
					</thead>
					<tbody className="divide-y">
						{sponsors.map((sponsor) => (
							<tr
								key={sponsor._id}
								className="group cursor-pointer transition-colors hover:bg-muted/50"
								onClick={() => onRowClick?.(sponsor)}
							>
								<td className="px-4 py-3">
									<span className="font-medium text-foreground">
										{sponsor.organizationName}
									</span>
								</td>
								<td className="px-4 py-3">
									<span className="text-sm text-muted-foreground">
										{sponsor.domain}
									</span>
								</td>
								<td className="px-4 py-3">
									<TierChip tier={sponsor.sponsorTier} />
								</td>
								<td className="px-3 py-3 text-right">
									<ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
