import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowRight,
	Award,
	Building2,
	Check,
	Loader2,
	Mail,
	Sparkles,
	X,
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
				return "bg-muted text-foreground border-border";
			case "Gold":
				return "bg-ds-amber-100 text-ds-amber-900 border-ds-amber-100";
			case "Silver":
				return "bg-muted text-foreground border-zinc-300";
			case "Bronze":
				return "bg-ds-amber-100 text-ds-amber-900 border-ds-amber-100";
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
			return <Check className="w-4 h-4 text-ds-green-700" />;
		}
		if (value === false) {
			return <X className="w-4 h-4 text-muted-foreground" />;
		}
		return <ArrowRight className="w-4 h-4 text-ds-blue-700" />;
	};

	return (
		<div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6 bg-muted min-h-full">
			<Card className="border-border bg-gradient-to-r from-white to-ds-blue-100 shadow-sm">
				<CardContent className="p-6 md:p-8">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div className="space-y-2">
							<div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-background px-3 py-1 text-xs text-ds-blue-700">
								<Sparkles className="h-3.5 w-3.5" />
								Sponsor Workspace
							</div>
							<h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
								{sponsorData?.sponsorOrganization || "Sponsor"}
							</h1>
							<p className="text-sm md:text-base text-muted-foreground">
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
				<Card className="border-border shadow-sm bg-background">
					<CardHeader className="pb-3">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-md bg-ds-blue-100 text-ds-blue-700">
								<Building2 className="h-5 w-5" />
							</div>
							<CardTitle className="text-lg text-foreground">
								Organization Details
							</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="rounded-md border border-border bg-muted p-4">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">
								Organization
							</p>
							<p className="mt-1 text-base font-medium text-foreground">
								{sponsorData?.sponsorOrganization || "Not specified"}
							</p>
						</div>
						<div className="rounded-md border border-border bg-muted p-4">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">
								Contact Email
							</p>
							<p className="mt-1 text-base font-medium text-foreground">
								{sponsorData?.email || "Not specified"}
							</p>
						</div>
					</CardContent>
				</Card>

				<Card className="border-border shadow-sm bg-background">
					<CardHeader className="pb-3">
						<div className="flex items-center gap-3">
							<div className="p-2 rounded-md bg-ds-amber-100 text-ds-amber-900">
								<Award className="h-5 w-5" />
							</div>
							<CardTitle className="text-lg text-foreground">
								Tier Snapshot
							</CardTitle>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="rounded-md border border-border p-4">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">
								Current Tier
							</p>
							<p className="mt-1 text-xl font-semibold text-foreground">
								{sponsorData?.sponsorTier || "Not assigned"}
							</p>
							<p className="text-sm text-muted-foreground mt-1">
								Suggested contribution:{" "}
								{getTierAmount(sponsorData?.sponsorTier)}
							</p>
						</div>
						{sponsorData?.autoAssignedSponsor && (
							<div className="rounded-md border border-ds-blue-100 bg-ds-blue-100 px-3 py-2 text-sm text-ds-blue-700">
								Auto-assigned from your company email domain.
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<Card className="border-border shadow-sm bg-background overflow-hidden">
				<CardHeader className="border-b border-border">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-md bg-ds-purple-100 text-ds-purple-700">
							<Award className="h-5 w-5" />
						</div>
						<div>
							<CardTitle className="text-lg text-foreground">
								Benefits by Tier
							</CardTitle>
							<CardDescription className="text-muted-foreground">
								Compare included opportunities across sponsorship levels.
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted">
								<TableHead className="text-muted-foreground">Benefit</TableHead>
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
												<span className="text-xs text-muted-foreground">
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
								<TableRow key={benefit.name} className="hover:bg-muted/70">
									<TableCell className="font-medium text-foreground">
										{benefit.name}
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-center gap-2">
											{renderBenefitIcon(benefit.bronze)}
											{typeof benefit.bronze === "string" && (
												<span className="text-xs font-medium text-ds-blue-700">
													{benefit.bronze}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-center gap-2">
											{renderBenefitIcon(benefit.silver)}
											{typeof benefit.silver === "string" && (
												<span className="text-xs font-medium text-ds-blue-700">
													{benefit.silver}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-center gap-2">
											{renderBenefitIcon(benefit.gold)}
											{typeof benefit.gold === "string" && (
												<span className="text-xs font-medium text-ds-blue-700">
													{benefit.gold}
												</span>
											)}
										</div>
									</TableCell>
									<TableCell>
										<div className="flex items-center justify-center gap-2">
											{renderBenefitIcon(benefit.diamond)}
											{typeof benefit.diamond === "string" && (
												<span className="text-xs font-medium text-ds-blue-700">
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
					<CardFooter className="border-t border-ds-blue-100 bg-ds-blue-100 text-sm text-ds-blue-1000">
						Your tier is{" "}
						<strong className="mx-1">{sponsorData.sponsorTier}</strong>. Access
						includes everything marked with ✓ and any tier-specific limits
						listed in your column.
					</CardFooter>
				)}
			</Card>

			<Card className="border-border shadow-sm bg-background">
				<CardHeader className="pb-2">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-md bg-ds-green-100 text-ds-green-700">
							<Mail className="w-5 h-5" />
						</div>
						<CardTitle className="text-lg text-foreground">Support</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<CardDescription className="text-base leading-relaxed text-muted-foreground">
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
