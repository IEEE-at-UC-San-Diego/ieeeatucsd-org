import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import ConstitutionBuilderContent from "@/components/constitution-builder/ConstitutionBuilderContent";
import { usePermissions } from "@/hooks/usePermissions";

const searchSchema = z.object({
	view: z.enum(["editor", "audit", "versions"]).catch("editor"),
});

export const Route = createFileRoute("/_dashboard/constitution-builder")({
	validateSearch: searchSchema,
	component: ConstitutionBuilderPage,
});

function ConstitutionBuilderPage() {
	const { hasAdminAccess, isLoading } = usePermissions();

	if (isLoading) {
		return (
			<output
				aria-live="polite"
				className="flex items-center justify-center min-h-[60vh]"
			>
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				<span className="sr-only">Loading…</span>
			</output>
		);
	}

	if (!hasAdminAccess) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				You don’t have permission to access this page.
			</div>
		);
	}

	return <ConstitutionBuilderContent />;
}
