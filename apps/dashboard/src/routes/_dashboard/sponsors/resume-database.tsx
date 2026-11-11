import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { z } from "zod";
import ResumeDatabaseContent from "@/components/dashboard/sponsors/ResumeDatabaseContent";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";

const searchSchema = z.object({
	q: z.string().catch(""),
	major: z.string().catch(""),
	year: z.string().catch(""),
	role: z.enum(["all", "officers", "members"]).catch("all"),
	page: z.number().int().min(1).catch(1),
	perPage: z
		.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])
		.catch(10),
	candidate: z.string().optional().catch(undefined),
});

export type ResumeDatabaseSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_dashboard/sponsors/resume-database")({
	validateSearch: searchSchema,
	component: ResumeDatabasePage,
});

function ResumeDatabasePage() {
	const { isSponsor, canAccessResumeDatabase, isAdmin, user } =
		usePermissions();

	if (!isSponsor && !isAdmin) {
		return (
			<div className="flex-1 overflow-auto p-6">
				<Card className="border-destructive/50 bg-destructive/5">
					<CardContent className="p-6 flex items-start gap-4">
						<AlertCircle className="h-8 w-8 text-destructive flex-shrink-0 mt-0.5" />
						<div className="flex-1">
							<h2 className="text-lg font-semibold text-balance text-foreground mb-2">
								Access Restricted
							</h2>
							<p className="text-muted-foreground">
								Only Sponsors and Administrators can access the resume database.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!canAccessResumeDatabase) {
		return (
			<div className="flex-1 overflow-auto p-6">
				<Card className="border-destructive/50 bg-destructive/5">
					<CardContent className="p-6 flex items-start gap-4">
						<AlertCircle className="h-8 w-8 text-destructive flex-shrink-0 mt-0.5" />
						<div className="flex-1">
							<h2 className="text-lg font-semibold text-balance text-foreground mb-2">
								Access Restricted
							</h2>
							<p className="text-muted-foreground">
								{user?.sponsorTier === "Bronze"
									? "Bronze tier sponsors don’t have access to the resume database. Upgrade to Silver tier or above to unlock it."
									: "Only Silver tier (or above) Sponsors and Administrators can access the resume database."}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return <ResumeDatabaseContent />;
}
