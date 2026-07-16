import { format, formatDistanceToNow } from "date-fns";
import {
	CalendarClock,
	History,
	MessageSquare,
	RotateCcw,
	User,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ResponsiveOverlay } from "@/components/mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ConstitutionVersion } from "./types";

interface ConstitutionVersionHistoryProps {
	versions: ConstitutionVersion[];
	currentVersion?: number;
	onRestoreVersion: (versionId: string) => Promise<{
		restoredVersionNumber: number;
		backupVersionNumber: number;
	} | null>;
}

const ConstitutionVersionHistory: React.FC<ConstitutionVersionHistoryProps> = ({
	versions,
	currentVersion,
	onRestoreVersion,
}) => {
	const [versionToRestore, setVersionToRestore] =
		useState<ConstitutionVersion | null>(null);
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
						<History className="h-5 w-5 text-muted-foreground" />
						Version History
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-12 text-muted-foreground">
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
						<History className="h-5 w-5 text-muted-foreground" />
						Version History
					</CardTitle>
					<p className="text-sm text-muted-foreground mt-1">
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
										className="rounded-lg border border-border bg-background p-4 space-y-3"
									>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<div className="flex items-center gap-2">
												<span className="text-sm font-semibold text-foreground">
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
															? "border-ds-blue-100 bg-ds-blue-100 text-ds-blue-700"
															: "border-ds-amber-100 bg-ds-amber-100 text-ds-amber-900"
													}`}
												>
													{version.source === "manual"
														? "Manual"
														: "Auto Backup"}
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

										<div className="space-y-1.5 text-xs text-muted-foreground">
											<div className="flex items-center gap-1.5">
												<User className="h-3.5 w-3.5" />
												<span>{version.createdByName}</span>
											</div>
											<div className="flex items-center gap-1.5">
												<CalendarClock className="h-3.5 w-3.5" />
												<span
													title={format(
														new Date(version.createdAt),
														"MMM d, yyyy 'at' h:mm a",
													)}
												>
													{formatDistanceToNow(new Date(version.createdAt), {
														addSuffix: true,
													})}
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

			<ResponsiveOverlay
				open={Boolean(versionToRestore)}
				onOpenChange={(open) => {
					if (!open && !isRestoring) {
						setVersionToRestore(null);
					}
				}}
				title={`Restore ${versionToRestore?.label}?`}
				description="This will replace the current constitution with that snapshot. A new auto-backup version of your current state will be saved first."
				variant="sheet"
				footer={
					<div className="flex w-full gap-2">
						<Button
							variant="outline"
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							disabled={isRestoring}
							onClick={() => setVersionToRestore(null)}
						>
							Cancel
						</Button>
						<Button
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							onClick={handleRestore}
							disabled={isRestoring}
						>
							{isRestoring ? "Restoring..." : "Restore Version"}
						</Button>
					</div>
				}
			>
				<p className="text-sm text-muted-foreground pb-2">
					Confirm you want to restore this version. Your current draft will be
					backed up automatically.
				</p>
			</ResponsiveOverlay>
		</>
	);
};

export default ConstitutionVersionHistory;
