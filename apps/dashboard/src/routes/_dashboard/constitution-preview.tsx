import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/hooks/useAuth";
import ConstitutionPreview from "@/components/constitution-builder/ConstitutionPreview";
import { exportConstitutionToPdf } from "@/components/constitution-builder/utils/pdfExport";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_dashboard/constitution-preview")({
  component: ConstitutionPreviewPage,
});

function ConstitutionPreviewPage() {
  const { hasOfficerAccess, isLoading } = usePermissions();
  const { logtoId } = useAuth();

  const constitution = useAuthedQuery(
    api.constitutions.getDefault,
    logtoId ? { logtoId } : "skip",
  );

  const sectionsFromQuery = useQuery(
    api.constitutions.getSections,
    constitution ? { constitutionId: constitution._id } : "skip",
  );

  const constitutionPending = constitution === undefined;
  const sectionsPending =
    constitution != null && sectionsFromQuery === undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasOfficerAccess) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        You don't have permission to access this page.
      </div>
    );
  }

  if (constitutionPending || sectionsPending) {
    return (
      <div className="w-full p-6">
        <div className="max-w-[8.5in] mx-auto space-y-4">
          <div className="h-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-[11in] bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (constitution === null) {
    return (
      <div className="p-6 text-center text-muted-foreground max-w-lg mx-auto space-y-2">
        <p>No default constitution document was found.</p>
        <p className="text-sm">
          Open the Constitution Builder from the dashboard so the document can be created, then use Live Preview again.
        </p>
      </div>
    );
  }

  const sections = sectionsFromQuery ?? [];

  const handlePrint = () => {
    exportConstitutionToPdf(constitution, sections);
  };

  return (
    <div className="w-full p-4 md:p-6">
      <div className="max-w-[8.5in] mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-auto">
          <ConstitutionPreview
            constitution={constitution}
            sections={sections}
            onPrint={handlePrint}
          />
        </div>
      </div>
    </div>
  );
}
