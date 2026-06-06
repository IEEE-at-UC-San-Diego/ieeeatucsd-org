import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import ConstitutionBuilderContent from "@/components/constitution-builder/ConstitutionBuilderContent";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_dashboard/constitution-builder")({
	component: ConstitutionBuilderPage,
});

function ConstitutionBuilderPage() {
	const { hasAdminAccess, isLoading } = usePermissions();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!hasAdminAccess) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				You don't have permission to access this page.
			</div>
		);
	}

	return <ConstitutionBuilderContent />;
}
