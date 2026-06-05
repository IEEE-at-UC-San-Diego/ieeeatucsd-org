import React, { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { History, RotateCcw, User, CalendarClock, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { ConstitutionVersion } from "./types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConstitutionVersionHistoryProps {
  versions: ConstitutionVersion[];
  currentVersion?: number;
  onRestoreVersion: (
    versionId: string,
  ) => Promise<{ restoredVersionNumber: number; backupVersionNumber: number } | null>;
}

const ConstitutionVersionHistory: React.FC<ConstitutionVersionHistoryProps> = ({
  versions,
  currentVersion,
  onRestoreVersion,
}) => {
  const [versionToRestore, setVersionToRestore] = useState<ConstitutionVersion | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.versionNumber - a.versionNumber),
    [versions],
  );

  const handleRestore = async () => {
    if (!versionToRestore) return;

    setIsRestoring(true);
    try {
      const result = await onRestoreVersion(versionToRestore._id);
      if (!result) {
        toast.error("Failed to restore version");
        return;
      }

      toast.success(
        `Restored V${result.restoredVersionNumber} (backup saved as V${result.backupVersionNumber})`,
      );
      setVersionToRestore(null);
    } catch (error) {
      console.error("Failed to restore version:", error);
      toast.error("Failed to restore version");
    } finally {
      setIsRestoring(false);
    }
  };

  if (sortedVersions.length === 0) {
    return (
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-gray-400" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-400">
            <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No manual versions saved yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-gray-400" />
            Version History
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Manual checkpoints you can restore at any time.
          </p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-2">
            <div className="space-y-3">
              {sortedVersions.map((version) => {
                const isCurrent = currentVersion === version.versionNumber;
                return (
                  <div
                    key={version._id}
                    className="rounded-lg border border-gray-200 bg-white p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {version.label}
                        </span>
                        {isCurrent && (
                          <Badge variant="outline" className="text-xs">
                            Current
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            version.source === "manual"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          {version.source === "manual" ? "Manual" : "Auto Backup"}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isRestoring}
                        onClick={() => setVersionToRestore(version)}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Restore
                      </Button>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        <span>{version.createdByName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        <span title={format(new Date(version.createdAt), "MMM d, yyyy 'at' h:mm a")}>
                          {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      {version.note && (
                        <div className="flex items-start gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 mt-0.5" />
                          <span>{version.note}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(versionToRestore)}
        onOpenChange={(open) => {
          if (!open && !isRestoring) {
            setVersionToRestore(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore {versionToRestore?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current constitution with that snapshot. A new auto-backup
              version of your current state will be saved first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? "Restoring..." : "Restore Version"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ConstitutionVersionHistory;
