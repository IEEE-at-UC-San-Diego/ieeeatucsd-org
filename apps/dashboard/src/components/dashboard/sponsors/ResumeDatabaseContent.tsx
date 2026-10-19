import { api } from "@convex/_generated/api";
import {
	ArrowLeft,
	CheckSquare,
	ChevronLeft,
	ChevronRight,
	Download,
	ExternalLink,
	FileText,
	Search,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { DotLabel, type DotTone } from "@/components/dashboard/DotLabel";
import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import { UserAvatarFallback } from "@/components/dashboard/UserAvatarFallback";
import {
	MobileDataList,
	MobileDataListItem,
	type MobileFilterChip,
	MobileFilters,
	ResponsiveOverlay,
	useMobileShell,
} from "@/components/mobile";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import {
	getMajorNormalizationMap,
	getUniqueNormalizedMajors,
	normalizeMajorName,
} from "@/lib/majorNormalization";
import { downloadFileFromUrl } from "@/lib/resumeUpload";
import type { UserWithResume } from "./types";

const ROLE_TONE: Record<string, DotTone> = {
	Member: "gray",
	"General Officer": "blue",
	"Executive Officer": "purple",
	"Member at Large": "teal",
	"Past Officer": "amber",
	Administrator: "red",
};

function RoleChip({ role, label }: { role: string; label?: string }) {
	return <DotLabel tone={ROLE_TONE[role] ?? "gray"}>{label ?? role}</DotLabel>;
}

function CandidateAvatar({
	name,
	className,
}: {
	name: string;
	className?: string;
}) {
	return (
		<Avatar className={className}>
			<AvatarFallback>
				<UserAvatarFallback name={name} className="size-full text-xs" />
			</AvatarFallback>
		</Avatar>
	);
}

export default function ResumeDatabaseContent() {
	const isMobile = useIsMobile();
	const { setHideTabBar } = useMobileShell();
	const { logtoId } = useAuth();
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedMajors, setSelectedMajors] = useState<Set<string>>(new Set());
	const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set());
	const [selectedOfficerStatus, setSelectedOfficerStatus] =
		useState<string>("all");
	const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
	const [selectionMode, setSelectionMode] = useState(false);
	const [view, setView] = useState<"list" | "detail">("list");
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);

	useEffect(() => {
		setHideTabBar(isMobile && view === "detail");
		return () => setHideTabBar(false);
	}, [isMobile, view, setHideTabBar]);

	const resumeUsers = useAuthedQuery(
		api.users.listResumes,
		logtoId ? { logtoId } : "skip",
	);

	const loading = resumeUsers === undefined;
	const users = useMemo(
		() => (resumeUsers ?? []).filter((u) => u.resume),
		[resumeUsers],
	);

	const majorNormalizationMap = useMemo(() => {
		const allMajors = users.map((u) => u.major).filter((m): m is string => !!m);
		return getMajorNormalizationMap(allMajors, 0.8);
	}, [users]);

	const getNormalizedMajor = useCallback(
		(major: string | undefined): string => {
			if (!major) return "";
			const normalized = normalizeMajorName(major);
			return majorNormalizationMap.get(normalized) || normalized;
		},
		[majorNormalizationMap],
	);

	const filteredUsers = useMemo(() => {
		let filtered = [...users];

		if (searchTerm) {
			filtered = filtered.filter((u) => {
				const normalizedMajor = getNormalizedMajor(u.major);
				return (
					u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
					normalizedMajor.toLowerCase().includes(searchTerm.toLowerCase())
				);
			});
		}

		if (selectedMajors.size > 0) {
			filtered = filtered.filter((u) => {
				const normalizedMajor = getNormalizedMajor(u.major);
				return selectedMajors.has(normalizedMajor);
			});
		}

		if (selectedYears.size > 0) {
			filtered = filtered.filter((u) => {
				return (
					u.graduationYear && selectedYears.has(u.graduationYear.toString())
				);
			});
		}

		if (selectedOfficerStatus === "officers") {
			filtered = filtered.filter(
				(u) => u.role !== "Member" && u.role !== "Sponsor",
			);
		} else if (selectedOfficerStatus === "members") {
			filtered = filtered.filter((u) => u.role === "Member");
		}

		return filtered;
	}, [
		searchTerm,
		selectedMajors,
		selectedYears,
		selectedOfficerStatus,
		users,
		getNormalizedMajor,
	]);

	const uniqueMajors = useMemo(() => {
		return getUniqueNormalizedMajors(
			users.map((u) => u.major),
			0.8,
		);
	}, [users]);

	const uniqueYears = useMemo(() => {
		const years = users
			.map((u) => u.graduationYear)
			.filter((year): year is number => !!year)
			.sort((a, b) => b - a);
		return Array.from(new Set(years));
	}, [users]);

	const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
	const startIndex = (currentPage - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

	const selectedUser = users.find((u) => u.id === selectedUserId) || null;

	useEffect(() => {
		if (selectedUserId && !users.some((u) => u.id === selectedUserId)) {
			setSelectedUserId(null);
			setView("list");
		}
	}, [users, selectedUserId]);

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const handleItemsPerPageChange = (value: string) => {
		setItemsPerPage(Number(value));
		setCurrentPage(1);
	};

	const handleSelectAll = (isSelected: boolean) => {
		if (isSelected) {
			const newSelected = new Set(selectedUsers);
			paginatedUsers.forEach((u) => {
				newSelected.add(u.id);
			});
			setSelectedUsers(newSelected);
		} else {
			const newSelected = new Set(selectedUsers);
			paginatedUsers.forEach((u) => {
				newSelected.delete(u.id);
			});
			setSelectedUsers(newSelected);
		}
	};

	const handleSelectUser = (userId: string) => {
		const newSelected = new Set(selectedUsers);
		if (newSelected.has(userId)) {
			newSelected.delete(userId);
		} else {
			newSelected.add(userId);
		}
		setSelectedUsers(newSelected);
	};

	const handleRowClick = (user: UserWithResume) => {
		setSelectedUserId(user.id);
		setView("detail");
	};

	const handleBackToList = () => {
		setView("list");
		setSelectedUserId(null);
	};

	const exitSelectionMode = () => {
		setSelectionMode(false);
		setSelectedUsers(new Set());
	};

	const activeFilterChips: MobileFilterChip[] = [];
	if (selectedMajors.size > 0) {
		for (const major of selectedMajors) {
			activeFilterChips.push({
				id: `major-${major}`,
				label: major,
				onClear: () => {
					const next = new Set(selectedMajors);
					next.delete(major);
					setSelectedMajors(next);
					setCurrentPage(1);
				},
			});
		}
	}
	if (selectedYears.size > 0) {
		for (const year of selectedYears) {
			activeFilterChips.push({
				id: `year-${year}`,
				label: `Class of ${year}`,
				onClear: () => {
					const next = new Set(selectedYears);
					next.delete(year);
					setSelectedYears(next);
					setCurrentPage(1);
				},
			});
		}
	}
	if (selectedOfficerStatus !== "all") {
		activeFilterChips.push({
			id: "role",
			label:
				selectedOfficerStatus === "officers" ? "Officers only" : "Members only",
			onClear: () => {
				setSelectedOfficerStatus("all");
				setCurrentPage(1);
			},
		});
	}

	const selectedIndex = selectedUser
		? filteredUsers.findIndex((u) => u.id === selectedUser.id)
		: -1;

	const generateCSV = (usersToExport: UserWithResume[]): string => {
		const headers = [
			"Name",
			"Email",
			"Major",
			"Year Graduating",
			"Resume File",
			"Resume URL",
		];

		const csvData = usersToExport.map((user) => {
			const name = user.name || "";
			const email = user.email || "";
			const major = getNormalizedMajor(user.major) || "";
			const year = user.graduationYear?.toString() || "";
			const resumeFile =
				user.fileName ?? `${user.name.replace(/\s+/g, "_")}_Resume.pdf`;
			const resumeUrl = user.resume || "";

			const escapeField = (field: string): string => {
				if (
					field.includes(",") ||
					field.includes('"') ||
					field.includes("\n")
				) {
					return `"${field.replace(/"/g, '""')}"`;
				}
				return field;
			};

			return [
				escapeField(name),
				escapeField(email),
				escapeField(major),
				escapeField(year),
				escapeField(resumeFile),
				escapeField(resumeUrl),
			].join(",");
		});

		return [headers.join(","), ...csvData].join("\n");
	};

	const downloadCSV = (csvContent: string, filename: string) => {
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
		const link = document.createElement("a");
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		link.setAttribute("download", filename);
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	};

	const handleDownloadSelected = async () => {
		const selectedUsersList = filteredUsers.filter((u) =>
			selectedUsers.has(u.id),
		);

		if (selectedUsersList.length === 0) return;

		if (selectedUsersList.length === 1) {
			const user = selectedUsersList[0];
			if (user.resume) {
				try {
					await downloadFileFromUrl(
						user.resume,
						user.fileName ?? `${user.name.replace(/\s+/g, "_")}_Resume.pdf`,
					);
				} catch (err) {
					console.error("Failed to download resume:", err);
					toast.error("Failed to download resume");
				}
			}
		} else {
			try {
				const csvContent = generateCSV(selectedUsersList);
				const filename = `Resume_Database_${selectedUsersList.length}_users.csv`;
				downloadCSV(csvContent, filename);
			} catch (err) {
				console.error("Failed to generate CSV:", err);
			}
		}
	};

	const clearFilters = () => {
		setSearchTerm("");
		setSelectedMajors(new Set());
		setSelectedYears(new Set());
		setSelectedOfficerStatus("all");
		setCurrentPage(1);
	};

	const getRoleBadgeVariant = (
		role: string,
	): "default" | "secondary" | "destructive" | "outline" => {
		switch (role) {
			case "Member":
				return "secondary";
			case "General Officer":
				return "default";
			case "Executive Officer":
				return "outline";
			case "Administrator":
				return "destructive";
			default:
				return "secondary";
		}
	};

	const currentYear = new Date().getFullYear();
	const graduatingSoonCount = users.filter(
		(u) => (u.graduationYear || Number.POSITIVE_INFINITY) <= currentYear + 1,
	).length;
	const officerCount = users.filter(
		(u) => u.role !== "Member" && u.role !== "Sponsor",
	).length;

	if (view === "detail" && selectedUser && !isMobile) {
		const prevUser =
			selectedIndex > 0 ? filteredUsers[selectedIndex - 1] : null;
		const nextUser =
			selectedIndex >= 0 && selectedIndex < filteredUsers.length - 1
				? filteredUsers[selectedIndex + 1]
				: null;
		const resumeFileName =
			selectedUser.fileName ??
			`${selectedUser.name.replace(/\s+/g, "_")}_Resume.pdf`;

		return (
			<DashboardPage>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Button variant="ghost" size="sm" onClick={handleBackToList}>
						<ArrowLeft className="mr-1 h-4 w-4" />
						All resumes
					</Button>
					<div className="flex items-center gap-2">
						<span className="text-xs tabular-nums text-muted-foreground">
							{selectedIndex + 1} of {filteredUsers.length}
						</span>
						<Button
							variant="outline"
							size="icon-sm"
							aria-label="Previous candidate"
							disabled={!prevUser}
							onClick={() => prevUser && setSelectedUserId(prevUser.id)}
						>
							<ChevronLeft />
						</Button>
						<Button
							variant="outline"
							size="icon-sm"
							aria-label="Next candidate"
							disabled={!nextUser}
							onClick={() => nextUser && setSelectedUserId(nextUser.id)}
						>
							<ChevronRight />
						</Button>
					</div>
				</div>

				<section className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
					<div className="flex items-center gap-4">
						<CandidateAvatar name={selectedUser.name} className="size-14" />
						<div className="min-w-0">
							<h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em] text-foreground">
								{selectedUser.name}
							</h1>
							<p className="mt-0.5 text-sm text-muted-foreground">
								{[
									getNormalizedMajor(selectedUser.major) || "Major not listed",
									selectedUser.graduationYear
										? `Class of ${selectedUser.graduationYear}`
										: null,
								]
									.filter(Boolean)
									.join(" · ")}
							</p>
							<div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
								<RoleChip
									role={selectedUser.role}
									label={selectedUser.position || selectedUser.role}
								/>
								<a
									href={`mailto:${selectedUser.email}`}
									className="text-sm text-tone-link hover:underline"
								>
									{selectedUser.email}
								</a>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={async () => {
								if (!selectedUser.resume) return;
								try {
									await downloadFileFromUrl(
										selectedUser.resume,
										resumeFileName,
									);
								} catch (err) {
									console.error("Failed to download resume:", err);
									toast.error("Failed to download resume");
								}
							}}
						>
							<Download className="h-4 w-4" />
							Download
						</Button>
						<Button asChild>
							<a
								href={selectedUser.resume}
								target="_blank"
								rel="noopener noreferrer"
							>
								<ExternalLink className="h-4 w-4" />
								Open in New Tab
							</a>
						</Button>
					</div>
				</section>

				<section className="overflow-hidden rounded-md border">
					<div className="flex items-center gap-2 border-b px-4 py-2.5">
						<FileText className="size-4 text-muted-foreground" />
						<span className="truncate text-sm font-medium text-foreground">
							{resumeFileName}
						</span>
					</div>
					<iframe
						src={selectedUser.resume}
						className="h-[74vh] w-full bg-muted"
						title={`${selectedUser.name}'s Resume`}
					/>
				</section>
			</DashboardPage>
		);
	}

	return (
		<DashboardPage>
			<PageHeader
				hideTitleOnMobile
				title="Resume Database"
				description="Search and review member resumes by major, graduation year and role."
			/>

			<SummaryStrip
				loading={loading}
				items={[
					{ label: "resumes", value: users.length },
					{ label: "officers", value: officerCount },
					{
						label: `graduating by ${currentYear + 1}`,
						value: graduatingSoonCount,
					},
					...(filteredUsers.length !== users.length
						? [{ label: "match your filters", value: filteredUsers.length }]
						: []),
				]}
			/>

			{isMobile ? (
				<div className="space-y-3">
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs text-muted-foreground">
							{selectionMode
								? "Tap checkboxes to select resumes"
								: "Tap a candidate to open their resume"}
						</p>
						<Button
							variant={selectionMode ? "secondary" : "outline"}
							size="sm"
							className="h-11 gap-1.5"
							onClick={() => {
								if (selectionMode) exitSelectionMode();
								else setSelectionMode(true);
							}}
						>
							{selectionMode ? (
								<>
									<X className="h-4 w-4" />
									Cancel
								</>
							) : (
								<>
									<CheckSquare className="h-4 w-4" />
									Select
								</>
							)}
						</Button>
					</div>
					<MobileFilters
						searchValue={searchTerm}
						onSearchChange={(value) => {
							setSearchTerm(value);
							setCurrentPage(1);
						}}
						searchPlaceholder="Search name, email, major"
						activeChips={activeFilterChips}
						onClearAll={clearFilters}
						activeFilterCount={activeFilterChips.length}
						sheetContent={
							<div className="space-y-4">
								<div className="space-y-2">
									<Label>Major</Label>
									<Select
										value={Array.from(selectedMajors)[0] || "all_majors"}
										onValueChange={(value) => {
											if (value === "all_majors") {
												setSelectedMajors(new Set());
											} else {
												setSelectedMajors(new Set([value]));
											}
											setCurrentPage(1);
										}}
									>
										<SelectTrigger className="h-11">
											<SelectValue placeholder="All majors" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all_majors">All majors</SelectItem>
											{uniqueMajors.map((major) => (
												<SelectItem key={major} value={major}>
													{major}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Graduation year</Label>
									<Select
										value={Array.from(selectedYears)[0] || "all_years"}
										onValueChange={(value) => {
											if (value === "all_years") {
												setSelectedYears(new Set());
											} else {
												setSelectedYears(new Set([value]));
											}
											setCurrentPage(1);
										}}
									>
										<SelectTrigger className="h-11">
											<SelectValue placeholder="All years" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all_years">All years</SelectItem>
											{uniqueYears.map((year) => (
												<SelectItem
													key={year.toString()}
													value={year.toString()}
												>
													Class of {year}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label>Role</Label>
									<Select
										value={selectedOfficerStatus}
										onValueChange={(value) => {
											setSelectedOfficerStatus(value);
											setCurrentPage(1);
										}}
									>
										<SelectTrigger className="h-11">
											<SelectValue placeholder="All members" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All members</SelectItem>
											<SelectItem value="officers">Officers only</SelectItem>
											<SelectItem value="members">General members</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>
						}
						onReset={clearFilters}
					/>
				</div>
			) : (
				<section className="flex flex-wrap items-center gap-2">
					<div className="relative min-w-[240px] flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search name, email, or major"
							aria-label="Search resumes"
							value={searchTerm}
							onChange={(e) => {
								setSearchTerm(e.target.value);
								setCurrentPage(1);
							}}
							className="pl-9"
						/>
					</div>
					<Select
						value={Array.from(selectedMajors)[0] || "all_majors"}
						onValueChange={(value) => {
							setSelectedMajors(
								value === "all_majors" ? new Set() : new Set([value]),
							);
							setCurrentPage(1);
						}}
					>
						<SelectTrigger className="w-[200px]" aria-label="Major">
							<SelectValue placeholder="All majors" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all_majors">All majors</SelectItem>
							{uniqueMajors.map((major) => (
								<SelectItem key={major} value={major}>
									{major}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={Array.from(selectedYears)[0] || "all_years"}
						onValueChange={(value) => {
							setSelectedYears(
								value === "all_years" ? new Set() : new Set([value]),
							);
							setCurrentPage(1);
						}}
					>
						<SelectTrigger className="w-[150px]" aria-label="Graduation year">
							<SelectValue placeholder="All years" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all_years">All years</SelectItem>
							{uniqueYears.map((year) => (
								<SelectItem key={year.toString()} value={year.toString()}>
									Class of {year}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={selectedOfficerStatus}
						onValueChange={(value) => {
							setSelectedOfficerStatus(value);
							setCurrentPage(1);
						}}
					>
						<SelectTrigger className="w-[160px]" aria-label="Role">
							<SelectValue placeholder="All members" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All members</SelectItem>
							<SelectItem value="officers">Officers only</SelectItem>
							<SelectItem value="members">General members</SelectItem>
						</SelectContent>
					</Select>
					{(searchTerm ||
						selectedMajors.size > 0 ||
						selectedYears.size > 0 ||
						selectedOfficerStatus !== "all") && (
						<Button variant="ghost" onClick={clearFilters}>
							Clear
						</Button>
					)}
				</section>
			)}

			{loading ? (
				<div className="space-y-3 rounded-md border p-12 text-center">
					<div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-foreground" />
					<p className="text-sm text-muted-foreground">Loading resumes…</p>
				</div>
			) : filteredUsers.length === 0 ? (
				<div className="flex flex-col items-center rounded-md border border-dashed px-6 py-14 text-center">
					<h3 className="text-sm font-semibold text-foreground">
						No resumes found
					</h3>
					<p className="mt-1 max-w-md text-sm text-muted-foreground">
						{searchTerm ||
						selectedMajors.size > 0 ||
						selectedYears.size > 0 ||
						selectedOfficerStatus !== "all"
							? "Try adjusting your filters."
							: "No members have uploaded resumes yet. Ask members to add one from Settings."}
					</p>
				</div>
			) : (
				<>
					{selectedUsers.size > 0 && (
						<div
							className={
								isMobile
									? "sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 border-y border-ds-blue-100 bg-ds-blue-100 px-4 py-3 sm:-mx-6 sm:px-6 md:static md:mx-0 md:rounded-md md:border"
									: undefined
							}
						>
							<Card
								className={
									isMobile
										? "border-0 bg-transparent shadow-none"
										: "rounded-md border-0 bg-ds-blue-100 shadow-none"
								}
							>
								<CardContent className="flex flex-col gap-3 p-0 sm:flex-row sm:items-center sm:justify-between md:p-4">
									<p className="text-sm text-tone-info">
										<strong>{selectedUsers.size}</strong> user
										{selectedUsers.size !== 1 ? "s" : ""} selected
									</p>
									<div className="flex items-center gap-2">
										<Button
											onClick={handleDownloadSelected}
											size="sm"
											className="h-11 flex-1 gap-2 sm:flex-none"
										>
											<Download className="w-4 h-4" />
											Download {selectedUsers.size === 1 ? "Resume" : "as CSV"}
										</Button>
										<Button
											variant="outline"
											size="sm"
											className="h-11"
											onClick={() => setSelectedUsers(new Set())}
										>
											Clear
										</Button>
									</div>
								</CardContent>
							</Card>
						</div>
					)}

					{isMobile ? (
						<div className="space-y-3">
							<MobileDataList>
								{paginatedUsers.map((user) => (
									<MobileDataListItem
										key={user.id}
										title={user.name}
										subtitle={getNormalizedMajor(user.major) || "Major N/A"}
										meta={
											user.graduationYear
												? `Class of ${user.graduationYear}`
												: undefined
										}
										status={
											<Badge variant={getRoleBadgeVariant(user.role)}>
												{user.position || user.role}
											</Badge>
										}
										leading={
											selectionMode ? (
												<Checkbox
													checked={selectedUsers.has(user.id)}
													onCheckedChange={() => handleSelectUser(user.id)}
													aria-label={`Select ${user.name}`}
													className="size-5"
												/>
											) : undefined
										}
										onClick={() => {
											if (selectionMode) {
												handleSelectUser(user.id);
												return;
											}
											handleRowClick(user);
										}}
										showChevron={!selectionMode}
									/>
								))}
							</MobileDataList>
							{totalPages > 1 && (
								<div className="flex items-center justify-between gap-3 px-1">
									<Button
										variant="outline"
										className="h-11 flex-1"
										disabled={currentPage === 1}
										onClick={() => handlePageChange(currentPage - 1)}
									>
										Previous
									</Button>
									<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
										Page {currentPage} of {totalPages}
									</span>
									<Button
										variant="outline"
										className="h-11 flex-1"
										disabled={currentPage === totalPages}
										onClick={() => handlePageChange(currentPage + 1)}
									>
										Next
									</Button>
								</div>
							)}
						</div>
					) : (
						<section className="overflow-hidden rounded-md border">
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow className="hover:bg-transparent">
											<TableHead className="w-12 px-4 py-2.5">
												<Checkbox
													checked={
														paginatedUsers.length > 0 &&
														paginatedUsers.every((u) => selectedUsers.has(u.id))
													}
													onCheckedChange={(checked) =>
														handleSelectAll(Boolean(checked))
													}
													aria-label="Select all users"
												/>
											</TableHead>
											{["Candidate", "Major", "Class", "Role"].map((label) => (
												<TableHead
													key={label}
													className="px-4 py-2.5 text-xs font-medium text-muted-foreground"
												>
													{label}
												</TableHead>
											))}
											<TableHead className="w-24 px-4 py-2.5">
												<span className="sr-only">Resume</span>
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{paginatedUsers.map((user) => (
											<TableRow
												key={user.id}
												data-state={
													selectedUsers.has(user.id) ? "selected" : undefined
												}
												className="group cursor-pointer transition-colors hover:bg-muted/50 data-[state=selected]:bg-ds-blue-100/50"
											>
												<TableCell
													className="px-4 py-3"
													onClick={(e) => {
														e.stopPropagation();
														handleSelectUser(user.id);
													}}
												>
													<Checkbox
														checked={selectedUsers.has(user.id)}
														onCheckedChange={() => handleSelectUser(user.id)}
														aria-label={`Select ${user.name}`}
													/>
												</TableCell>
												<TableCell
													className="px-4 py-3"
													onClick={() => handleRowClick(user)}
												>
													<div className="flex items-center gap-3">
														<CandidateAvatar name={user.name} />
														<div className="min-w-0">
															<div className="truncate text-sm font-medium text-foreground">
																{user.name}
															</div>
															<div className="truncate text-xs text-muted-foreground">
																{user.email}
															</div>
														</div>
													</div>
												</TableCell>
												<TableCell
													className="px-4 py-3"
													onClick={() => handleRowClick(user)}
												>
													<div
														className="max-w-[240px] truncate text-sm text-foreground"
														title={getNormalizedMajor(user.major) || "N/A"}
													>
														{getNormalizedMajor(user.major) || "N/A"}
													</div>
												</TableCell>
												<TableCell
													className="px-4 py-3"
													onClick={() => handleRowClick(user)}
												>
													<span className="text-sm tabular-nums text-foreground">
														{user.graduationYear || "N/A"}
													</span>
												</TableCell>
												<TableCell
													className="px-4 py-3"
													onClick={() => handleRowClick(user)}
												>
													<RoleChip
														role={user.role}
														label={user.position || user.role}
													/>
												</TableCell>
												<TableCell
													className="px-4 py-3 text-right"
													onClick={() => handleRowClick(user)}
												>
													<ChevronRight className="ml-auto size-4 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							{totalPages > 1 && (
								<div className="border-t px-4 py-3">
									<div className="flex flex-col items-center justify-between gap-3 lg:flex-row">
										<div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
											<p className="text-xs text-muted-foreground">
												Showing{" "}
												<span className="font-semibold text-foreground">
													{startIndex + 1}
												</span>{" "}
												to{" "}
												<span className="font-semibold text-foreground">
													{Math.min(endIndex, filteredUsers.length)}
												</span>{" "}
												of{" "}
												<span className="font-semibold text-foreground">
													{filteredUsers.length}
												</span>
											</p>
											<div className="flex items-center gap-2">
												<span className="text-xs text-muted-foreground">
													Per page
												</span>
												<Select
													value={itemsPerPage.toString()}
													onValueChange={handleItemsPerPageChange}
												>
													<SelectTrigger className="h-8 w-20 bg-background">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="10">10</SelectItem>
														<SelectItem value="25">25</SelectItem>
														<SelectItem value="50">50</SelectItem>
														<SelectItem value="100">100</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>

										<div className="flex items-center gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => handlePageChange(currentPage - 1)}
												disabled={currentPage === 1}
											>
												Previous
											</Button>
											<span className="text-xs tabular-nums text-muted-foreground">
												Page {currentPage} of {totalPages}
											</span>
											<Button
												variant="outline"
												size="sm"
												onClick={() => handlePageChange(currentPage + 1)}
												disabled={currentPage === totalPages}
											>
												Next
											</Button>
										</div>
									</div>
								</div>
							)}
						</section>
					)}
				</>
			)}

			{isMobile && selectedUser && (
				<ResponsiveOverlay
					open={view === "detail"}
					onOpenChange={(open) => {
						if (!open) handleBackToList();
					}}
					title={selectedUser.name}
					description={`${selectedUser.email} · ${getNormalizedMajor(selectedUser.major) || "Major N/A"} · Class of ${selectedUser.graduationYear || "N/A"}`}
					variant="fullscreen"
					footer={
						<div className="flex w-full gap-2">
							<Button
								variant="outline"
								className="h-11 flex-1"
								disabled={selectedIndex <= 0}
								onClick={() => {
									const prev = filteredUsers[selectedIndex - 1];
									if (prev) setSelectedUserId(prev.id);
								}}
							>
								Previous
							</Button>
							<Button variant="outline" className="h-11 flex-1" asChild>
								<a
									href={selectedUser.resume}
									target="_blank"
									rel="noopener noreferrer"
								>
									Download
								</a>
							</Button>
							<Button
								className="h-11 flex-1"
								disabled={
									selectedIndex < 0 || selectedIndex >= filteredUsers.length - 1
								}
								onClick={() => {
									const next = filteredUsers[selectedIndex + 1];
									if (next) setSelectedUserId(next.id);
								}}
							>
								Next
							</Button>
						</div>
					}
				>
					<iframe
						src={selectedUser.resume}
						className="h-[calc(100dvh-12rem)] w-full min-w-0 rounded-md border"
						title={`${selectedUser.name}'s Resume`}
					/>
				</ResponsiveOverlay>
			)}
		</DashboardPage>
	);
}
