import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import {
	Download,
	Filter,
	Loader2,
	Plus,
	Search,
	UserPlus,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { AddMemberModal } from "@/components/dashboard/manage-users/AddMemberModal";
import { EditUserModal } from "@/components/dashboard/manage-users/EditUserModal";
import {
	type OfficerTeam,
	type SortConfig,
	TEAMS,
	USER_ROLES,
	USER_STATUSES,
	type UserFilters,
	type UserModalData,
	type UserRole,
} from "@/components/dashboard/manage-users/types";
import { UserStatsCards } from "@/components/dashboard/manage-users/UserStatsCards";
import { UserTable } from "@/components/dashboard/manage-users/UserTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import {
	buildMembersCsv,
	downloadMembersCsv,
	membersCsvFilename,
} from "@/lib/members-csv";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

const SORT_FIELDS = ["name", "email", "role", "team", "lastLogin"] as const;

const searchSchema = z.object({
	q: z.string().catch(""),
	role: z.enum(["all", ...USER_ROLES]).catch("all"),
	status: z.enum(USER_STATUSES).catch("all"),
	team: z.enum(TEAMS).catch("all"),
	sort: z.enum(SORT_FIELDS).catch("name"),
	dir: z.enum(["asc", "desc"]).catch("asc"),
	page: z.number().int().min(1).catch(1),
});

type UsersSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_dashboard/manage-users")({
	validateSearch: searchSchema,
	loader: (ctx) => prefetchAuthedQuery(api.users.list, undefined, ctx),
	component: ManageUsersPage,
});

const ITEMS_PER_PAGE = 10;

function ManageUsersPage() {
	const {
		hasAdminAccess,
		logtoId,
		user: currentUser,
		getAuthHeaders,
		isLoading,
	} = usePermissions();
	const users = useAuthedQuery(api.users.list, logtoId ? { logtoId } : "skip");

	// Mutations
	const updateStatusMutation = useAuthedMutation(api.users.updateStatus);
	const updateProfileForAdminMutation = useAuthedMutation(
		api.users.updateProfileForAdmin,
	);
	const deleteUserMutation = useAuthedMutation(api.users.deleteUser);

	// State
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const setSearch = (patch: Partial<UsersSearch>) =>
		navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
	const filters: UserFilters = {
		searchTerm: search.q,
		roleFilter: search.role,
		statusFilter: search.status,
		teamFilter: search.team,
	};
	const setFilters = (next: UserFilters) =>
		setSearch({
			q: next.searchTerm,
			role: next.roleFilter,
			status: next.statusFilter,
			team: next.teamFilter,
			page: 1,
		});
	const sortConfig: SortConfig = { field: search.sort, direction: search.dir };
	const setCurrentPage = (page: number) => setSearch({ page });
	const confirm = useConfirm();
	const [showEditModal, setShowEditModal] = useState(false);
	const [showAddMemberModal, setShowAddMemberModal] = useState(false);
	const [editingUser, setEditingUser] = useState<UserModalData | null>(null);
	const [saving, setSaving] = useState(false);

	// Filter and sort users
	const filteredUsers = useMemo(() => {
		if (!users) return [];
		const filters = {
			searchTerm: search.q,
			roleFilter: search.role,
			statusFilter: search.status,
			teamFilter: search.team,
		};
		const sortConfig = { field: search.sort, direction: search.dir };

		return users
			.filter((user) => {
				// Search filter
				const matchesSearch =
					!filters.searchTerm ||
					user.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
					user.email.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
					(user.pid &&
						user.pid
							.toLowerCase()
							.includes(filters.searchTerm.toLowerCase())) ||
					(user.major &&
						user.major
							.toLowerCase()
							.includes(filters.searchTerm.toLowerCase()));

				// Role filter
				const matchesRole =
					filters.roleFilter === "all" || user.role === filters.roleFilter;

				// Status filter
				const matchesStatus =
					filters.statusFilter === "all" ||
					user.status === filters.statusFilter;

				// Team filter
				const matchesTeam =
					filters.teamFilter === "all" || user.team === filters.teamFilter;

				return matchesSearch && matchesRole && matchesStatus && matchesTeam;
			})
			.sort((a, b) => {
				const { field, direction } = sortConfig;
				const modifier = direction === "asc" ? 1 : -1;

				switch (field) {
					case "name":
						return a.name.localeCompare(b.name) * modifier;
					case "email":
						return a.email.localeCompare(b.email) * modifier;
					case "role":
						return a.role.localeCompare(b.role) * modifier;
					case "team":
						return (a.team || "").localeCompare(b.team || "") * modifier;
					case "lastLogin":
						return ((a.lastLogin || 0) - (b.lastLogin || 0)) * modifier;
					default:
						return 0;
				}
			});
	}, [
		users,
		search.q,
		search.role,
		search.status,
		search.team,
		search.sort,
		search.dir,
	]);

	// Pagination
	const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
	const currentPage = Math.min(search.page, Math.max(totalPages, 1));
	const paginatedUsers = filteredUsers.slice(
		(currentPage - 1) * ITEMS_PER_PAGE,
		currentPage * ITEMS_PER_PAGE,
	);

	// Handlers
	const handleSort = (field: string) => {
		const parsed = searchSchema.shape.sort.safeParse(field);
		if (!parsed.success) return;
		setSearch({
			sort: parsed.data,
			dir: search.sort === parsed.data && search.dir === "asc" ? "desc" : "asc",
			page: 1,
		});
	};

	const handleEditUser = (user: any) => {
		setEditingUser({
			id: user._id,
			name: user.name,
			email: user.email,
			role: user.role,
			position: user.position || "",
			status: user.status,
			pid: user.pid || "",
			memberId: user.memberId || "",
			major: user.major || "",
			graduationYear: user.graduationYear,
			points: user.points || 0,
			team: user.team,
			hasIEEEEmail: user.hasIEEEEmail as any,
			ieeeEmail: user.ieeeEmail,
			ieeeEmailCreatedAt: user.ieeeEmailCreatedAt,
		});
		setShowEditModal(true);
	};

	const handleSaveUser = async (userData: UserModalData) => {
		if (!logtoId || !userData.id) return;
		setSaving(true);

		try {
			// Update status if changed
			await updateStatusMutation({
				logtoId,
				userId: userData.id,
				status: userData.status,
			});

			const roleChanged =
				userData.role !== editingUser?.role ||
				(userData.position || "") !== (editingUser?.position || "") ||
				(userData.team || undefined) !== (editingUser?.team || undefined);

			// Update role, position, team and sync with Logto only when role-related fields changed.
			if (roleChanged) {
				const roleResponse = await fetch("/api/users/update-role", {
					method: "POST",
					headers: { "Content-Type": "application/json", ...getAuthHeaders() },
					body: JSON.stringify({
						userId: userData.id,
						role: userData.role,
						position: userData.position || undefined,
						team: userData.team,
						source: "manage-users",
					}),
				});

				const roleResult = await roleResponse.json();
				if (!roleResponse.ok) {
					throw new Error(roleResult.error || "Failed to update role");
				}

				if (
					Array.isArray(roleResult.warnings) &&
					roleResult.warnings.length > 0
				) {
					toast.warning(roleResult.warnings.join(" | "));
				}
			}

			// Update additional fields
			await updateProfileForAdminMutation({
				logtoId,
				userId: userData.id,
				name: userData.name,
				pid: userData.pid,
				memberId: userData.memberId,
				major: userData.major,
				graduationYear: userData.graduationYear,
			});

			toast.success("User updated successfully");
			setShowEditModal(false);
			setEditingUser(null);
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to update user. Check your connection and try again.",
			);
		} finally {
			setSaving(false);
		}
	};

	const handlePromoteUser = async (
		userId: string,
		newRole: UserRole,
		newPosition: string,
		newTeam?: OfficerTeam,
	) => {
		if (!logtoId) return;
		setSaving(true);

		try {
			const roleResponse = await fetch("/api/users/update-role", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({
					userId,
					role: newRole,
					position: newPosition || undefined,
					team: newTeam,
					source: "manage-users",
				}),
			});

			const roleResult = await roleResponse.json();
			if (!roleResponse.ok) {
				throw new Error(roleResult.error || "Failed to promote user");
			}

			if (
				Array.isArray(roleResult.warnings) &&
				roleResult.warnings.length > 0
			) {
				toast.warning(roleResult.warnings.join(" | "));
			}

			toast.success("User promoted successfully");
			setShowAddMemberModal(false);
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to promote user. Check your connection and try again.",
			);
		} finally {
			setSaving(false);
		}
	};

	const handleExportCsv = () => {
		// Export the full users.list result, not the page's client-side filters.
		if (!users || users.length === 0) return;

		try {
			const csv = buildMembersCsv(users);
			downloadMembersCsv(csv, membersCsvFilename());
			toast.success(`Exported ${users.length} members`);
		} catch (error: unknown) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to export members. Try again in a moment.";
			toast.error(message);
		}
	};

	const handleDeleteUser = async (userId: Id<"users">) => {
		if (
			!(await confirm({
				title: "Delete User?",
				description: "This can’t be undone.",
				confirmLabel: "Delete User",
				destructive: true,
			}))
		) {
			return;
		}

		setSaving(true);
		try {
			await deleteUserMutation({ userId });
			toast.success("User deleted successfully");
			setShowEditModal(false);
			setEditingUser(null);
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to delete user. Check your connection and try again.",
			);
		} finally {
			setSaving(false);
		}
	};

	const getAvailableRoles = (isCurrentUser = false): UserRole[] => {
		if (isCurrentUser) {
			return USER_ROLES;
		}
		return USER_ROLES;
	};

	const availableTeams: OfficerTeam[] = ["Internal", "Events", "Projects"];

	const userStats = useMemo(() => {
		const list = users ?? [];
		const monthStart = new Date();
		monthStart.setDate(1);
		monthStart.setHours(0, 0, 0, 0);
		return {
			totalMembers: list.length,
			activeMembers: list.filter((u) => u.status === "active").length,
			officers: list.filter(
				(u) =>
					u.role === "General Officer" ||
					u.role === "Executive Officer" ||
					u.role === "Administrator",
			).length,
			newThisMonth: list.filter(
				(u) => (u.joinDate ?? u._creationTime) >= monthStart.getTime(),
			).length,
		};
	}, [users]);

	// Loading state
	if (isLoading) {
		return (
			<DashboardPage
				width="wide"
				className="flex min-h-[60vh] items-center justify-center"
			>
				<output aria-live="polite" className="block">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					<span className="sr-only">Loading…</span>
				</output>
			</DashboardPage>
		);
	}

	// Access denied
	if (!hasAdminAccess) {
		return (
			<DashboardPage width="wide">
				<div className="bg-background rounded-md border p-8 text-center">
					<div className="text-tone-danger mb-4">
						<svg
							aria-hidden="true"
							className="w-12 h-12 mx-auto"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
							/>
						</svg>
					</div>
					<h3 className="text-lg font-medium text-foreground mb-2 text-balance">
						Access Denied
					</h3>
					<p className="text-muted-foreground">
						You don’t have permission to access user management. Ask an
						administrator for access.
					</p>
				</div>
			</DashboardPage>
		);
	}

	return (
		<DashboardPage width="wide">
			{/* Header */}
			<PageHeader
				title="Manage Users"
				description="View and manage user accounts, roles, and permissions."
				actions={
					<>
						<Button
							variant="outline"
							onClick={handleExportCsv}
							disabled={!users || users.length === 0}
						>
							<Download /> Export CSV
						</Button>
						<Button
							variant="outline"
							onClick={() => setShowAddMemberModal(true)}
						>
							<UserPlus /> Promote Member…
						</Button>
						<Button
							onClick={() => {
								setEditingUser(null);
								setShowEditModal(true);
							}}
						>
							<Plus /> Add User
						</Button>
					</>
				}
			/>

			<UserStatsCards stats={userStats} loading={!users} />

			{/* Filters */}
			<div>
				<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
					{/* Search and Filters */}
					<div className="flex flex-col sm:flex-row gap-4 flex-1">
						{/* Search */}
						<div className="relative flex-1 max-w-md">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								type="search"
								name="q"
								aria-label="Search users"
								autoComplete="off"
								placeholder="Search by name, email, TSN, major…"
								value={filters.searchTerm}
								onChange={(e) =>
									setFilters({ ...filters, searchTerm: e.target.value })
								}
								className="pl-9"
							/>
						</div>

						{/* Role Filter */}
						<div className="flex items-center gap-2">
							<Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							<Select
								value={filters.roleFilter}
								onValueChange={(v) =>
									setFilters({ ...filters, roleFilter: v as any })
								}
							>
								<SelectTrigger
									aria-label="Filter by role"
									className="w-[150px]"
								>
									<SelectValue placeholder="Role" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Roles</SelectItem>
									{USER_ROLES.map((role) => (
										<SelectItem key={role} value={role}>
											{role}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Status Filter */}
						<div>
							<Select
								value={filters.statusFilter}
								onValueChange={(v) =>
									setFilters({ ...filters, statusFilter: v as any })
								}
							>
								<SelectTrigger
									aria-label="Filter by status"
									className="w-[150px]"
								>
									<SelectValue placeholder="Status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Status</SelectItem>
									{["active", "inactive", "suspended"].map((status) => (
										<SelectItem key={status} value={status}>
											{status.charAt(0).toUpperCase() + status.slice(1)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* Team Filter */}
						<div>
							<Select
								value={filters.teamFilter}
								onValueChange={(v) =>
									setFilters({ ...filters, teamFilter: v as any })
								}
							>
								<SelectTrigger
									aria-label="Filter by team"
									className="w-[150px]"
								>
									<SelectValue placeholder="Team" />
								</SelectTrigger>
								<SelectContent>
									{TEAMS.map((team) => (
										<SelectItem key={team} value={team}>
											{team === "all" ? "All Teams" : team}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{/* Active Filters Display */}
				{(filters.searchTerm ||
					filters.roleFilter !== "all" ||
					filters.statusFilter !== "all" ||
					filters.teamFilter !== "all") && (
					<div className="mt-4 pt-4 border-t">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-sm text-muted-foreground">
								Active filters:
							</span>

							{filters.searchTerm && (
								<Badge variant="secondary" className="rounded-[3px]">
									<span className="max-w-48 truncate">
										Search: “{filters.searchTerm}”
									</span>
									<Button
										variant="ghost"
										size="icon"
										type="button"
										aria-label="Clear search filter"
										onClick={() => setFilters({ ...filters, searchTerm: "" })}
										className="ml-2 hover:text-destructive"
									>
										<X className="h-3 w-3" />
									</Button>
								</Badge>
							)}

							{filters.roleFilter !== "all" && (
								<Badge variant="secondary" className="rounded-[3px]">
									Role: {filters.roleFilter}
									<Button
										variant="ghost"
										size="icon"
										type="button"
										aria-label="Clear role filter"
										onClick={() =>
											setFilters({ ...filters, roleFilter: "all" })
										}
										className="ml-2 hover:text-destructive"
									>
										<X className="h-3 w-3" />
									</Button>
								</Badge>
							)}

							{filters.statusFilter !== "all" && (
								<Badge variant="secondary" className="rounded-[3px]">
									Status: {filters.statusFilter}
									<Button
										variant="ghost"
										size="icon"
										type="button"
										aria-label="Clear status filter"
										onClick={() =>
											setFilters({ ...filters, statusFilter: "all" })
										}
										className="ml-2 hover:text-destructive"
									>
										<X className="h-3 w-3" />
									</Button>
								</Badge>
							)}

							{filters.teamFilter !== "all" && (
								<Badge variant="secondary" className="rounded-[3px]">
									Team: {filters.teamFilter}
									<Button
										variant="ghost"
										size="icon"
										type="button"
										aria-label="Clear team filter"
										onClick={() =>
											setFilters({ ...filters, teamFilter: "all" })
										}
										className="ml-2 hover:text-destructive"
									>
										<X className="h-3 w-3" />
									</Button>
								</Badge>
							)}

							<Button
								size="sm"
								variant="ghost"
								onClick={() =>
									setFilters({
										searchTerm: "",
										roleFilter: "all",
										statusFilter: "all",
										teamFilter: "all",
									})
								}
								className="text-xs"
							>
								Clear All Filters
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* User Table */}
			{paginatedUsers.length > 0 ? (
				<>
					<UserTable
						users={paginatedUsers}
						sortConfig={sortConfig}
						onSort={handleSort}
						currentUserId={currentUser?._id}
						onRowClick={handleEditUser}
					/>

					{/* Pagination Controls */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between">
							<p className="text-sm tabular-nums text-muted-foreground">
								Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
								{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)}{" "}
								of {filteredUsers.length} users
							</p>
							<Pagination
								currentPage={currentPage}
								totalPages={totalPages}
								onPageChange={setCurrentPage}
							/>
						</div>
					)}
				</>
			) : (
				<div className="bg-background rounded-md border p-12 text-center">
					<svg
						aria-hidden="true"
						className="w-12 h-12 mx-auto text-muted-foreground mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
						/>
					</svg>
					<h3 className="text-lg font-medium text-foreground mb-2 text-balance">
						No Users Found
					</h3>
					<p className="text-muted-foreground">
						Try adjusting your search or filter criteria.
					</p>
				</div>
			)}

			{/* Edit User Modal */}
			<EditUserModal
				isOpen={showEditModal}
				onClose={() => {
					setShowEditModal(false);
					setEditingUser(null);
				}}
				onSave={handleSaveUser}
				editingUser={editingUser}
				availableRoles={getAvailableRoles(editingUser?.id === currentUser?._id)}
				availableTeams={availableTeams}
				canEditRole={true}
				canEditPosition={true}
				canEditStatus={true}
				canEditPoints={currentUser?.role === "Administrator"}
				loading={saving}
				currentUserId={currentUser?._id}
				onDelete={handleDeleteUser}
			/>

			{/* Add Member Modal */}
			<AddMemberModal
				isOpen={showAddMemberModal}
				onClose={() => setShowAddMemberModal(false)}
				onSave={handlePromoteUser}
				availableRoles={getAvailableRoles(false)}
				availableTeams={availableTeams}
				users={users}
				loading={saving}
			/>
		</DashboardPage>
	);
}
