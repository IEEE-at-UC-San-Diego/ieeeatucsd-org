import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, Check, Edit3, ExternalLink, History, RotateCcw } from "lucide-react";
import type { SaveStatus } from "./types";
import { useConstitutionData } from "./hooks/useConstitutionData";
import ConstitutionDocumentEditor from "./ConstitutionDocumentEditor";
import { ConstitutionAuditLog } from "./ConstitutionAuditLog";
import ConstitutionVersionHistory from "./ConstitutionVersionHistory";
import ConstitutionSearch from "./ConstitutionSearch";
import { Button } from "@/components/ui/button";

type BuilderView = "editor" | "audit" | "versions";

const ConstitutionBuilderContent = () => {
  const {
    sections,
    versions,
    isLoading,
    saveDocumentSections,
    saveVersion,
    restoreVersion,
    initializeConstitution,
    constitution,
    constitutionId,
  } = useConstitutionData();

  const [currentView, setCurrentView] = useState<BuilderView>("editor");

  const saveStatus: SaveStatus = isLoading ? "idle" : "saved";

  useEffect(() => {
    initializeConstitution();
  }, [initializeConstitution]);

  if (isLoading) {
    return (
      <div className="w-full max-w-none p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
            <div className="h-64 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header — full layout on lg+; below lg the desktop block is hidden, so we show a compact bar with Preview + tabs */}
        <div className="mb-4 md:mb-6 lg:mb-8">
          <div className="lg:hidden space-y-3 mb-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 min-w-0">
                <FileText className="h-6 w-6 text-blue-600 shrink-0" />
                <span className="truncate">Constitution Builder</span>
              </h1>
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <Link to="/constitution-preview" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Preview
                </Link>
              </Button>
            </div>
            <div className="max-w-md">
              <ConstitutionSearch
                sections={sections}
                onSelectSection={() => {
                  setCurrentView("editor");
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-gray-600 shrink-0">
                {saveStatus === "saved" && (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-green-600">Saved</span>
                  </>
                )}
                {saveStatus === "idle" && (
                  <>
                    <FileText className="h-3.5 w-3.5 text-gray-500" />
                    <span>Ready</span>
                  </>
                )}
              </div>
              <div className="flex flex-1 min-w-0 bg-gray-100 rounded-xl p-1">
                <Button
                  onClick={() => setCurrentView("editor")}
                  className={`flex-1 px-2 py-2 rounded-md text-xs font-medium min-h-[44px] ${
                    currentView === "editor"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  variant="ghost"
                >
                  <Edit3 className="h-4 w-4 inline mr-1" />
                  Editor
                </Button>
                <Button
                  onClick={() => setCurrentView("versions")}
                  className={`flex-1 px-2 py-2 rounded-md text-xs font-medium min-h-[44px] ${
                    currentView === "versions"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  variant="ghost"
                >
                  <RotateCcw className="h-4 w-4 inline mr-1" />
                  Versions
                </Button>
                <Button
                  onClick={() => setCurrentView("audit")}
                  className={`flex-1 px-2 py-2 rounded-md text-xs font-medium min-h-[44px] ${
                    currentView === "audit"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  variant="ghost"
                >
                  <History className="h-4 w-4 inline mr-1" />
                  Audit
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center justify-between">
            <div className="flex-1 mr-8">
              <h1 className="text-2xl xl:text-3xl font-bold text-gray-900 flex items-center gap-3">
                <FileText className="h-7 w-7 xl:h-8 xl:w-8 text-blue-600" />
                Constitution Builder
              </h1>
              <p className="text-gray-600 mt-2 mb-4">
                Collaboratively build and manage the organization's constitution
              </p>
              <div className="max-w-md">
                <ConstitutionSearch
                  sections={sections}
                  onSelectSection={() => {
                    setCurrentView("editor");
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                {saveStatus === "saved" && (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Changes saved</span>
                  </>
                )}
                {saveStatus === "idle" && (
                  <>
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">Ready to edit</span>
                  </>
                )}
              </div>

              <Button variant="outline" className="inline-flex items-center gap-2 text-sm font-medium" asChild>
                <Link to="/constitution-preview" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Live Preview
                </Link>
              </Button>

              <div className="flex bg-gray-100 rounded-xl p-1">
                <Button
                  onClick={() => setCurrentView("editor")}
                  className={`px-3 py-2 rounded-md text-sm font-medium min-h-[44px] ${
                    currentView === "editor"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  variant="ghost"
                >
                  <Edit3 className="h-4 w-4 inline mr-2" />
                  Editor
                </Button>
                <Button
                  onClick={() => setCurrentView("versions")}
                  className={`px-3 py-2 rounded-md text-sm font-medium min-h-[44px] ${
                    currentView === "versions"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  variant="ghost"
                >
                  <RotateCcw className="h-4 w-4 inline mr-2" />
                  Versions
                </Button>
                <Button
                  onClick={() => setCurrentView("audit")}
                  className={`px-3 py-2 rounded-md text-sm font-medium min-h-[44px] ${
                    currentView === "audit"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                  variant="ghost"
                >
                  <History className="h-4 w-4 inline mr-2" />
                  Audit Log
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {currentView === "editor" ? (
          <ConstitutionDocumentEditor
            sections={sections}
            onSaveDocument={saveDocumentSections}
            onSaveVersion={saveVersion}
          />
        ) : currentView === "versions" ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
            <ConstitutionVersionHistory
              versions={versions}
              currentVersion={constitution?.version}
              onRestoreVersion={restoreVersion}
            />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-6">
            <ConstitutionAuditLog constitutionId={constitutionId || ""} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstitutionBuilderContent;
