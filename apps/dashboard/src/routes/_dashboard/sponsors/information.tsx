import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowRight,
	Award,
	Building2,
	Check,
	Mail,
	Sparkles,
	X,
	Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
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

function SponsorInformationPage() {
	const { user, isLoading } = useAuth();
	const { isSponsor, isAdmin } = usePermissions();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!isSponsor && !isAdmin) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				You don't have permission to access this page.
			</div>
		);
	}

	const sponsorData = user;

	const getTierColor = (tier?: string | null) => {
		switch (tier) {
			case "Diamond":
				return "bg-cyan-50 text-cyan-700 border-cyan-200";
			case "Platinum":
				return "bg-slate-100 text-slate-700 border-slate-300";
			case "Gold":
				return "bg-amber-50 text-amber-700 border-amber-200";
			case "Silver":
				return "bg-zinc-100 text-zinc-700 border-zinc-300";
			case "Bronze":
				return "bg-orange-50 text-orange-700 border-orange-200";
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

	const renderBenefitIcon = (value: boolean | string) => {
		if (value === true) {
			return <Check className="w-4 h-4 text-emerald-600" />;
		}
		if (value === false) {
			return <X className="w-4 h-4 text-slate-400" />;
		}
		return <ArrowRight className="w-4 h-4 text-blue-600" />;
	};

	return (
		<div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6 bg-slate-50 min-h-full">
			<Card className="border-slate-200 bg-gradient-to-r from-white to-sky-50 shadow-sm">
				<CardContent className="p-6 md:p-8">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div className="space-y-2">
							<div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs text-sky-700">
								<Sparkles className="h-3.5 w-3.5" />
								Sponsor Workspace
							</div>
							<h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
								{sponsorData?.sponsorOrganization || "Sponsor"}
							</h1>
							<p className="text-sm md:text-base text-slate-600">
								Thank you for supporting IEEE at UC San Diego.
							</p>
						</div>
						<Badge
							variant="outline"
							className={cn(
								"px-4 py-2 text-sm font-semibold border rounded-full",
								getTierColor(sponsorData?.sponsorTier),
							)}
						>
							{sponsorData?.sponsorTier || "Tier not assigned"}
						</Badge>
					</div>
				</CardContent>
			</Card>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
				<Card className="border-slate-200 shadow-sm bg-white">
					<CardHeader className="pb-3">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-xl bg-blue-50 text-blue-700">
								<Building2 className="h-5 w-5" />
							</div>
							<CardTitle className="text-lg text-slate-900">
								Organization Details
							</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">
								Organization
							</p>
							<p className="mt-1 text-base font-medium text-slate-900">
								{sponsorData?.sponsorOrganization || "Not specified"}
							</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">
								Contact Email
							</p>
							<p className="mt-1 text-base font-medium text-slate-900">
								{sponsorData?.email || "Not specified"}
							</p>
						</div>
					</CardContent>
				</Card>

				<Card className="border-slate-200 shadow-sm bg-white">
					<CardHeader className="pb-3">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-xl bg-amber-50 text-amber-700">
								<Award className="h-5 w-5" />
							</div>
							<CardTitle className="text-lg text-slate-900">
								Tier Snapshot
							</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="rounded-xl border border-slate-200 p-4">
							<p className="text-xs uppercase tracking-wide text-slate-500">
								Current Tier
							</p>
							<p className="mt-1 text-xl font-semibold text-slate-900">
								{sponsorData?.sponsorTier || "Not assigned"}
							</p>
							<p className="text-sm text-slate-600 mt-1">
								Suggested contribution:{" "}
								{getTierAmount(sponsorData?.sponsorTier)}
							</p>
						</div>
						{sponsorData?.autoAssignedSponsor && (
							<div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
								Auto-assigned from your company email domain.
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
				<CardHeader className="border-b border-slate-100">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
							<Award className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg text-slate-900">
								Benefits by Tier
							</CardTitle>
							<CardDescription className="text-slate-600">
								Compare included opportunities across sponsorship levels.
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow className="bg-slate-50">
								<TableHead className="text-slate-600">Benefit</TableHead>
								{(["Bronze", "Silver", "Gold", "Diamond"] as const).map(
									(tier) => (
										<TableHead key={tier} className="text-center">
											<div className="flex flex-col items-center gap-1">
												<Badge
													variant="outline"
													className={cn("font-semibold", getTierColor(tier))}
												>
													{tier.toUpperCase()}
												</Badge>
												<span className="text-xs text-slate-500">
													{getTierAmount(tier)}
												</span>
											</div>
										</TableHead>
									),
								)}
							</TableRow>
						</TableHeader>
						<TableBody>
							{benefits.map((benefit) => (
								<TableRow key={benefit.name} className="hover:bg-slate-50/70">
									<TableCell className="font-medium text-slate-800">
										{benefit.name}
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-center gap-2">
											{renderBenefitIcon(benefit.bronze)}
											{typeof benefit.bronze === "string" && (
												<span className="text-xs font-medium text-blue-600">
													{benefit.bronze}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-center gap-2">
											{renderBenefitIcon(benefit.silver)}
											{typeof benefit.silver === "string" && (
												<span className="text-xs font-medium text-blue-600">
													{benefit.silver}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-center gap-2">
											{renderBenefitIcon(benefit.gold)}
											{typeof benefit.gold === "string" && (
												<span className="text-xs font-medium text-blue-600">
													{benefit.gold}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-center gap-2">
											{renderBenefitIcon(benefit.diamond)}
											{typeof benefit.diamond === "string" && (
												<span className="text-xs font-medium text-blue-600">
													{benefit.diamond}
												</span>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
				{sponsorData?.sponsorTier && (
					<CardFooter className="border-t border-blue-100 bg-blue-50 text-sm text-blue-900">
						Your tier is{" "}
						<strong className="mx-1">{sponsorData.sponsorTier}</strong>. Access
						includes everything marked with ✓ and any tier-specific limits
						listed in your column.
					</CardFooter>
				)}
			</Card>

			<Card className="border-slate-200 shadow-sm bg-white">
				<CardHeader className="pb-2">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
							<Mail className="w-5 h-5" />
						</div>
						<CardTitle className="text-lg text-slate-900">Support</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<CardDescription className="text-base leading-relaxed text-slate-600">
						Questions about sponsorship terms, resume access, or activations?
						Reach the IEEE UCSD team directly.
					</CardDescription>
					<Button asChild className="gap-2">
						<a href="mailto:ieee@ucsd.edu">
							<Mail className="w-4 h-4" />
							Contact IEEE UCSD
						</a>
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
