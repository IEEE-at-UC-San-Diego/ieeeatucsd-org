import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, Mail, X } from "lucide-react";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { DotLabel, type DotTone } from "@/components/dashboard/DotLabel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/sponsors/information")({
	component: SponsorInformationPage,
});

interface Benefit {
	name: string;
	bronze: boolean | string;
	silver: boolean | string;
	gold: boolean | string;
	diamond: boolean | string;
}

const benefits: Benefit[] = [
	{
		name: "Prominent Logo Placement on Website & Newsletters",
		bronze: true,
		silver: true,
		gold: true,
		diamond: true,
	},
	{
		name: "Tabling/Swag at Major Events",
		bronze: true,
		silver: true,
		gold: true,
		diamond: true,
	},
	{
		name: "Exclusive Access to Student Resume Database",
		bronze: false,
		silver: true,
		gold: true,
		diamond: true,
	},
	{
		name: "Participation in Professional Development Sessions",
		bronze: false,
		silver: "3 per year",
		gold: "Unlimited",
		diamond: "Unlimited",
	},
	{
		name: "Participation in Technical Workshops",
		bronze: false,
		silver: "1 per year",
		gold: "Unlimited",
		diamond: "Unlimited",
	},
	{
		name: "Unlimited Participation in Quarterly Projects",
		bronze: false,
		silver: false,
		gold: true,
		diamond: true,
	},
	{
		name: "Custom Events & Activations",
		bronze: false,
		silver: false,
		gold: true,
		diamond: true,
	},
];

const TIERS = ["bronze", "silver", "gold", "diamond"] as const;

function SponsorInformationPage() {
	const { user, isLoading } = useAuth();
	const { isSponsor, isAdmin } = usePermissions();

	if (isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!isSponsor && !isAdmin) {
		return (
			<DashboardPage>
				<p className="text-center text-muted-foreground">
					You don't have permission to access this page.
				</p>
			</DashboardPage>
		);
	}

	const sponsorData = user;

	const tierTone = (tier?: string | null): DotTone => {
		switch (tier) {
			case "Diamond":
				return "blue";
			case "Platinum":
				return "purple";
			case "Gold":
			case "Bronze":
				return "amber";
			default:
				return "gray";
		}
	};

	const getTierAmount = (tier?: string | null) => {
		switch (tier) {
			case "Diamond":
				return "$5000+";
			case "Platinum":
				return "$4000";
			case "Gold":
				return "$3000";
			case "Silver":
				return "$1500";
			case "Bronze":
				return "$750";
			default:
				return "N/A";
		}
	};

	const formatBenefitValue = (value: boolean | string) => {
		if (value === true) return "Included";
		if (value === false) return "Not included";
		return value;
	};

	const currentTierKey = (sponsorData?.sponsorTier || "").toLowerCase() as
		| (typeof TIERS)[number]
		| "";

	return (
		<DashboardPage width="wide" variant="list">
			<PageHeader
				title={sponsorData?.sponsorOrganization || "Sponsor"}
				description="Thank you for supporting IEEE at UC San Diego."
				hideTitleOnMobile
				actions={
					<DotLabel tone={tierTone(sponsorData?.sponsorTier)}>
						{sponsorData?.sponsorTier
							? `${sponsorData.sponsorTier} sponsor`
							: "Tier not assigned"}
					</DotLabel>
				}
			/>

			{/* Account details — grouped list on mobile */}
			<section className="space-y-3">
				<h2 className="text-sm font-semibold text-foreground md:sr-only">
					Account
				</h2>
				<ul className="-mx-4 divide-y border-y md:mx-0 md:grid md:grid-cols-3 md:divide-x md:divide-y-0 md:rounded-md md:border">
					<li className="min-h-[52px] px-4 py-3 md:py-4">
						<p className="text-xs text-muted-foreground">Organization</p>
						<p className="mt-0.5 truncate text-sm font-medium">
							{sponsorData?.sponsorOrganization || "Not specified"}
						</p>
					</li>
					<li className="min-w-0">
						<a
							href={
								sponsorData?.email ? `mailto:${sponsorData.email}` : undefined
							}
							className={cn(
								"block min-h-[52px] px-4 py-3 transition-colors hover:bg-muted/40 md:py-4",
								!sponsorData?.email && "pointer-events-none",
							)}
						>
							<p className="text-xs text-muted-foreground">Contact email</p>
							<p className="mt-0.5 truncate text-sm font-medium text-tone-link">
								{sponsorData?.email || "Not specified"}
							</p>
						</a>
					</li>
					<li className="min-h-[52px] px-4 py-3 md:py-4">
						<p className="text-xs text-muted-foreground">Current tier</p>
						<p className="mt-0.5 text-sm font-medium">
							{sponsorData?.sponsorTier || "Not assigned"}
							<span className="ml-2 font-normal text-muted-foreground">
								{getTierAmount(sponsorData?.sponsorTier)}
							</span>
						</p>
						{sponsorData?.autoAssignedSponsor && (
							<p className="mt-0.5 text-xs text-muted-foreground">
								Auto-assigned from your company email domain.
							</p>
						)}
					</li>
				</ul>
			</section>

			{/* Benefits — mobile: stacked cards; desktop: comparison table */}
			<section className="space-y-3">
				<div>
					<h2 className="text-base font-semibold text-foreground">
						Benefits by Tier
					</h2>
					<p className="text-sm text-muted-foreground">
						Compare included opportunities across sponsorship levels.
					</p>
				</div>

				{/* Mobile: one benefit per card with your-tier highlight */}
				<ul className="-mx-4 divide-y border-y md:hidden">
					{benefits.map((benefit) => {
						const yourValue =
							currentTierKey && currentTierKey in benefit
								? benefit[currentTierKey]
								: undefined;
						return (
							<li key={benefit.name} className="space-y-3 px-4 py-4">
								<p className="text-sm font-medium leading-5">{benefit.name}</p>
								{yourValue !== undefined && (
									<div className="flex items-center gap-2 rounded-md bg-ds-blue-100/60 px-3 py-2 text-sm text-tone-info">
										{yourValue === true || typeof yourValue === "string" ? (
											<Check className="size-4 shrink-0" />
										) : (
											<X className="size-4 shrink-0 text-muted-foreground" />
										)}
										<span>Your tier: {formatBenefitValue(yourValue)}</span>
									</div>
								)}
								<div className="grid grid-cols-2 gap-2">
									{(
										[
											["Bronze", benefit.bronze],
											["Silver", benefit.silver],
											["Gold", benefit.gold],
											["Diamond", benefit.diamond],
										] as const
									).map(([tier, value]) => (
										<div
											key={tier}
											className={cn(
												"rounded-sm border px-2.5 py-2",
												sponsorData?.sponsorTier === tier &&
													"border-ieee-blue bg-ds-blue-100/40",
											)}
										>
											<p className="text-xs font-medium text-muted-foreground">
												{tier}
											</p>
											<p className="mt-0.5 flex items-center gap-1 text-xs font-medium">
												{value === true ? (
													<>
														<Check className="size-3.5 text-tone-success" />
														Yes
													</>
												) : value === false ? (
													<>
														<X className="size-3.5 text-muted-foreground" />—
													</>
												) : (
													value
												)}
											</p>
										</div>
									))}
								</div>
							</li>
						);
					})}
				</ul>

				{/* Desktop table */}
				<div className="hidden overflow-x-auto rounded-md border md:block">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b">
								<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
									Benefit
								</th>
								{(["Bronze", "Silver", "Gold", "Diamond"] as const).map(
									(tier) => (
										<th
											key={tier}
											className={cn(
												"px-3 py-3 text-center",
												sponsorData?.sponsorTier === tier &&
													"bg-ds-blue-100/50",
											)}
										>
											<div className="flex flex-col items-center gap-1">
												<span className="text-sm font-semibold text-foreground">
													{tier}
												</span>
												<span className="text-xs text-muted-foreground">
													{getTierAmount(tier)}
												</span>
											</div>
										</th>
									),
								)}
							</tr>
						</thead>
						<tbody>
							{benefits.map((benefit) => (
								<tr
									key={benefit.name}
									className="border-b transition-colors last:border-0 hover:bg-muted/30"
								>
									<td className="px-4 py-3 font-medium">{benefit.name}</td>
									{(
										[
											benefit.bronze,
											benefit.silver,
											benefit.gold,
											benefit.diamond,
										] as const
									).map((value, i) => (
										<td
											key={i}
											className={cn(
												"px-3 py-3 text-center",
												sponsorData?.sponsorTier ===
													(["Bronze", "Silver", "Gold", "Diamond"] as const)[
														i
													] && "bg-ds-blue-100/40",
											)}
										>
											<div className="flex items-center justify-center gap-1.5">
												{value === true ? (
													<Check className="size-4 text-tone-success" />
												) : value === false ? (
													<X className="size-4 text-muted-foreground" />
												) : (
													<span className="text-xs font-medium text-tone-info">
														{value}
													</span>
												)}
											</div>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>

			{/* Support — one-tap contact */}
			<section className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<h2 className="text-base font-semibold">Support</h2>
					<p className="text-sm text-muted-foreground">
						Questions about sponsorship terms, resume access, or activations?
						Reach the IEEE UCSD team directly.
					</p>
				</div>
				<Button asChild className="h-12 w-full gap-2 sm:h-10 sm:w-auto">
					<a href="mailto:ieee@ucsd.edu">
						<Mail className="size-4" />
						Contact IEEE UCSD
					</a>
				</Button>
			</section>
		</DashboardPage>
	);
}
