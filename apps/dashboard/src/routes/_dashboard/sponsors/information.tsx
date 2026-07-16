import { createFileRoute } from "@tanstack/react-router";
import {
	Award,
	Building2,
	Check,
	Loader2,
	Mail,
	Sparkles,
	X,
} from "lucide-react";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { Badge } from "@/components/ui/badge";
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

	const getTierColor = (tier?: string | null) => {
		switch (tier) {
			case "Diamond":
				return "bg-cyan-50 text-cyan-700 border-cyan-200";
			case "Platinum":
				return "bg-muted text-foreground border-border";
			case "Gold":
				return "bg-ds-amber-100 text-tone-warning border-ds-amber-100";
			case "Silver":
				return "bg-muted text-foreground border-zinc-300";
			case "Bronze":
				return "bg-ds-amber-100 text-tone-warning border-ds-amber-100";
			default:
				return "bg-muted text-muted-foreground border-border";
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
				eyebrow={
					<span className="inline-flex items-center gap-1.5">
						<Sparkles className="h-3.5 w-3.5" />
						Sponsor Workspace
					</span>
				}
				actions={
					<Badge
						variant="outline"
						className={cn(
							"px-3 py-1.5 text-sm font-semibold",
							getTierColor(sponsorData?.sponsorTier),
						)}
					>
						{sponsorData?.sponsorTier || "Tier not assigned"}
					</Badge>
				}
			/>

			{/* Account details — grouped list on mobile */}
			<section className="space-y-3">
				<h2 className="text-sm font-semibold text-foreground md:sr-only">
					Account
				</h2>
				<ul className="-mx-4 divide-y border-y bg-background md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:divide-y-0 md:border-0 md:bg-transparent">
					<li className="flex min-h-[52px] items-center gap-3 px-4 py-3 md:rounded-md md:border md:px-4">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ds-blue-100 text-tone-info">
							<Building2 className="size-5" />
						</div>
						<div className="min-w-0">
							<p className="text-xs text-muted-foreground">Organization</p>
							<p className="truncate text-sm font-medium">
								{sponsorData?.sponsorOrganization || "Not specified"}
							</p>
						</div>
					</li>
					<li className="min-w-0 md:rounded-md md:border">
						<a
							href={
								sponsorData?.email ? `mailto:${sponsorData.email}` : undefined
							}
							className={cn(
								"flex min-h-[52px] items-center gap-3 px-4 py-3 active:bg-muted/60",
								!sponsorData?.email && "pointer-events-none",
							)}
						>
							<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ds-green-100 text-tone-success">
								<Mail className="size-5" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-xs text-muted-foreground">Contact email</p>
								<p className="truncate text-sm font-medium text-tone-link">
									{sponsorData?.email || "Not specified"}
								</p>
							</div>
						</a>
					</li>
					<li className="flex min-h-[52px] items-center gap-3 px-4 py-3 md:col-span-2 md:rounded-md md:border md:px-4">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ds-amber-100 text-tone-warning">
							<Award className="size-5" />
						</div>
						<div className="min-w-0 flex-1">
							<p className="text-xs text-muted-foreground">Current tier</p>
							<p className="text-sm font-medium">
								{sponsorData?.sponsorTier || "Not assigned"}
								<span className="ml-2 text-muted-foreground">
									· {getTierAmount(sponsorData?.sponsorTier)}
								</span>
							</p>
							{sponsorData?.autoAssignedSponsor && (
								<p className="mt-0.5 text-xs text-tone-info">
									Auto-assigned from your company email domain.
								</p>
							)}
						</div>
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
												"rounded-md border px-2.5 py-2",
												sponsorData?.sponsorTier === tier &&
													"border-ieee-blue bg-ds-blue-100/40",
											)}
										>
											<p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
							<tr className="border-b bg-muted/40">
								<th className="px-4 py-3 text-left font-medium text-muted-foreground">
									Benefit
								</th>
								{(["Bronze", "Silver", "Gold", "Diamond"] as const).map(
									(tier) => (
										<th key={tier} className="px-3 py-3 text-center">
											<div className="flex flex-col items-center gap-1">
												<Badge
													variant="outline"
													className={cn("font-semibold", getTierColor(tier))}
												>
													{tier}
												</Badge>
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
								<tr key={benefit.name} className="border-b last:border-0">
									<td className="px-4 py-3 font-medium">{benefit.name}</td>
									{(
										[
											benefit.bronze,
											benefit.silver,
											benefit.gold,
											benefit.diamond,
										] as const
									).map((value, i) => (
										<td key={i} className="px-3 py-3 text-center">
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
			<section className="space-y-3">
				<h2 className="text-base font-semibold">Support</h2>
				<p className="text-sm text-muted-foreground">
					Questions about sponsorship terms, resume access, or activations?
					Reach the IEEE UCSD team directly.
				</p>
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
