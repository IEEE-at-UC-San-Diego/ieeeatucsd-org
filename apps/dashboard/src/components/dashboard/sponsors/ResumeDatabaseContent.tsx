import { api } from "@convex/_generated/api";
import {
	ArrowLeft,
	Briefcase,
	CheckSquare,
	Download,
	FileText,
	Filter,
	GraduationCap,
	Search,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
	MobileDataList,
	MobileDataListItem,
	type MobileFilterChip,
	MobileFilters,
	ResponsiveOverlay,
	useMobileShell,
} from "@/components/mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
		return (
			<div className="w-full bg-muted min-h-full">
				<div className="mx-auto max-w-7xl p-4 md:p-6 space-y-5">
					<div className="flex flex-wrap items-center gap-3">
						<Button variant="ghost" size="sm" onClick={handleBackToList}>
							<ArrowLeft className="h-4 w-4 mr-1" />
							Back to resume list
						</Button>
						<Badge variant={getRoleBadgeVariant(selectedUser.role)}>
							{selectedUser.position || selectedUser.role}
						</Badge>
					</div>

					<Card className="bg-background border-border shadow-sm">
						<CardContent className="p-6 md:p-7">
							<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
								<div className="space-y-2">
									<h1 className="text-2xl font-semibold tracking-tight text-foreground">
										{selectedUser.name}
									</h1>
									<p className="text-sm text-muted-foreground">
										{selectedUser.email}
									</p>
									<div className="flex flex-wrap gap-2 text-sm text-foreground">
										<Badge variant="outline">
											{getNormalizedMajor(selectedUser.major) ||
												"Major not listed"}
										</Badge>
										<Badge variant="outline">
											Class of {selectedUser.graduationYear || "N/A"}
										</Badge>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Button asChild>
										<a
											href={selectedUser.resume}
											target="_blank"
											rel="noopener noreferrer"
										>
											Open in New Tab
										</a>
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-background border-border shadow-sm overflow-hidden">
						<CardHeader className="border-b border-border">
							<CardTitle className="text-base text-foreground">
								Resume Preview
							</CardTitle>
						</CardHeader>
						<CardContent className="p-0">
							<iframe
								src={selectedUser.resume}
								className="w-full h-[72vh]"
								title={`${selectedUser.name}'s Resume`}
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full bg-muted min-h-full">
			<div className="mx-auto max-w-7xl p-4 md:p-6 space-y-5">
				<div className="space-y-1">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						Resume Database
					</h1>
					<p className="text-sm text-muted-foreground">
						Browse member resumes with consistent filters and quick in-page
						review.
					</p>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
					<Card className="bg-background border-border shadow-sm">
						<CardContent className="p-5 flex items-center gap-3">
							<div className="rounded-md p-2.5 bg-ds-blue-100 text-tone-info">
								<FileText className="h-5 w-5" />
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Total Resumes</p>
								<p className="text-2xl font-semibold text-foreground">
									{users.length}
								</p>
							</div>
						</CardContent>
					</Card>
					<Card className="bg-background border-border shadow-sm">
						<CardContent className="p-5 flex items-center gap-3">
							<div className="rounded-md p-2.5 bg-ds-green-100 text-tone-success">
								<Filter className="h-5 w-5" />
							</div>
							<div>
								<p className="text-xs text-muted-foreground">
									Filtered Results
								</p>
								<p className="text-2xl font-semibold text-foreground">
									{filteredUsers.length}
								</p>
							</div>
						</CardContent>
					</Card>
					<Card className="bg-background border-border shadow-sm">
						<CardContent className="p-5 flex items-center gap-3">
							<div className="rounded-md p-2.5 bg-ds-purple-100 text-tone-purple">
								<Briefcase className="h-5 w-5" />
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Officer Resumes</p>
								<p className="text-2xl font-semibold text-foreground">
									{officerCount}
								</p>
							</div>
						</CardContent>
					</Card>
					<Card className="bg-background border-border shadow-sm">
						<CardContent className="p-5 flex items-center gap-3">
							<div className="rounded-md p-2.5 bg-ds-amber-100 text-tone-warning">
								<GraduationCap className="h-5 w-5" />
							</div>
							<div>
								<p className="text-xs text-muted-foreground">
									Graduating by {currentYear + 1}
								</p>
								<p className="text-2xl font-semibold text-foreground">
									{graduatingSoonCount}
								</p>
							</div>
						</CardContent>
					</Card>
				</div>

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
					<Card className="bg-background border-border shadow-sm">
						<CardContent className="p-4 md:p-5">
							<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
								<div className="relative xl:col-span-2">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
									<Input
										type="text"
										placeholder="Search by name, email, or major"
										value={searchTerm}
										onChange={(e) => {
											setSearchTerm(e.target.value);
											setCurrentPage(1);
										}}
										className="pl-9 h-10"
									/>
								</div>
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
									<SelectTrigger className="h-10">
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
										if (value === "all_years") {
											setSelectedYears(new Set());
										} else {
											setSelectedYears(new Set([value]));
										}
										setCurrentPage(1);
									}}
								>
									<SelectTrigger className="h-10">
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
									<SelectTrigger className="h-10">
										<div className="flex items-center gap-2 flex-1">
											<Users className="w-4 h-4 text-muted-foreground" />
											<SelectValue placeholder="All members" />
										</div>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All members</SelectItem>
										<SelectItem value="officers">Officers only</SelectItem>
										<SelectItem value="members">General members</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="mt-3 flex items-center justify-between">
								<p className="text-xs text-muted-foreground">
									Click any user row to view their resume in-page.
								</p>
								<Button variant="outline" size="sm" onClick={clearFilters}>
									Clear filters
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				{loading ? (
					<Card className="bg-background border-border shadow-raised">
						<CardContent className="space-y-3 p-12 text-center">
							<div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-foreground" />
							<p className="text-muted-foreground">Loading resumes…</p>
						</CardContent>
					</Card>
				) : filteredUsers.length === 0 ? (
					<Card className="bg-background border-border shadow-raised">
						<CardContent className="p-12 text-center">
							<FileText className="mx-auto mb-3 h-14 w-14 text-muted-foreground" />
							<h3 className="text-base font-semibold text-foreground">
								No resumes found
							</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								{searchTerm ||
								selectedMajors.size > 0 ||
								selectedYears.size > 0 ||
								selectedOfficerStatus !== "all"
									? "Try adjusting your filters."
									: "No members have uploaded resumes yet. Ask members to add one from Settings."}
							</p>
						</CardContent>
					</Card>
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
											: "border-ds-blue-100 bg-ds-blue-100"
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
												Download{" "}
												{selectedUsers.size === 1 ? "Resume" : "as CSV"}
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
							<Card className="bg-background border-border shadow-sm overflow-hidden">
								<div className="overflow-x-auto">
									<Table>
										<TableHeader>
											<TableRow className="bg-muted hover:bg-muted">
												<TableHead className="px-5 py-3 w-12">
													<Checkbox
														checked={
															paginatedUsers.length > 0 &&
															paginatedUsers.every((u) =>
																selectedUsers.has(u.id),
															)
														}
														onCheckedChange={(checked) =>
															handleSelectAll(Boolean(checked))
														}
														aria-label="Select all users"
													/>
												</TableHead>
												<TableHead className="px-5 py-3">Name</TableHead>
												<TableHead className="px-5 py-3">Email</TableHead>
												<TableHead className="px-5 py-3">Major</TableHead>
												<TableHead className="px-5 py-3">Grad Year</TableHead>
												<TableHead className="px-5 py-3">Role</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{paginatedUsers.map((user) => (
												<TableRow
													key={user.id}
													className="hover:bg-muted cursor-pointer transition-colors"
												>
													<TableCell
														className="px-5 py-4"
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
														className="px-5 py-4"
														onClick={() => handleRowClick(user)}
													>
														<div className="text-sm font-medium text-foreground">
															{user.name}
														</div>
													</TableCell>
													<TableCell
														className="px-5 py-4"
														onClick={() => handleRowClick(user)}
													>
														<div className="text-sm text-muted-foreground">
															{user.email}
														</div>
													</TableCell>
													<TableCell
														className="px-5 py-4"
														onClick={() => handleRowClick(user)}
													>
														<div
															className="text-sm text-foreground max-w-[230px] truncate"
															title={getNormalizedMajor(user.major) || "N/A"}
														>
															{getNormalizedMajor(user.major) || "N/A"}
														</div>
													</TableCell>
													<TableCell
														className="px-5 py-4"
														onClick={() => handleRowClick(user)}
													>
														<div className="text-sm text-foreground">
															{user.graduationYear || "N/A"}
														</div>
													</TableCell>
													<TableCell
														className="px-5 py-4"
														onClick={() => handleRowClick(user)}
													>
														<Badge variant={getRoleBadgeVariant(user.role)}>
															{user.position || user.role}
														</Badge>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>

								{totalPages > 1 && (
									<div className="bg-muted px-5 py-4 border-t border-border">
										<div className="flex flex-col lg:flex-row items-center justify-between gap-4">
											<div className="flex flex-col sm:flex-row items-center gap-4">
												<p className="text-sm text-foreground">
													Showing{" "}
													<span className="font-medium">{startIndex + 1}</span>{" "}
													to{" "}
													<span className="font-medium">
														{Math.min(endIndex, filteredUsers.length)}
													</span>{" "}
													of{" "}
													<span className="font-medium">
														{filteredUsers.length}
													</span>
												</p>
												<div className="flex items-center gap-2">
													<span className="text-sm text-foreground">
														Per page:
													</span>
													<Select
														value={itemsPerPage.toString()}
														onValueChange={handleItemsPerPageChange}
													>
														<SelectTrigger className="w-20 h-8 bg-background">
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
												<span className="text-sm text-foreground">
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
							</Card>
						)}
					</>
				)}
			</div>

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
		</div>
	);
}
