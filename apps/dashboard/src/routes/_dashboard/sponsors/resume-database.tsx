import { createFileRoute } from "@tanstack/react-router";
import { usePermissions } from "@/hooks/usePermissions";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ResumeDatabaseContent from "@/components/dashboard/sponsors/ResumeDatabaseContent";

export const Route = createFileRoute("/_dashboard/sponsors/resume-database")({
	component: ResumeDatabasePage,
});

function ResumeDatabasePage() {
	const { isSponsor, canAccessResumeDatabase, isAdmin, user } = usePermissions();

	if (!isSponsor && !isAdmin) {
		return (
			<div className="flex-1 overflow-auto p-6">
				<Card className="border-destructive/50 bg-destructive/5">
					<CardContent className="p-6 flex items-start gap-4">
						<AlertCircle className="h-8 w-8 text-destructive flex-shrink-0 mt-0.5" />
						<div className="flex-1">
							<h2 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h2>
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
							<h2 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h2>
							<p className="text-muted-foreground">
								{user?.sponsorTier === "Bronze"
									? "Bronze tier sponsors do not have access to the resume database. Please upgrade to Silver tier or above."
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
