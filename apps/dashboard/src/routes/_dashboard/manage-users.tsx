import { createFileRoute } from "@tanstack/react-router";
import { useAuthedQuery, useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { usePermissions } from "@/hooks/usePermissions";
import { useState, useMemo, useEffect } from "react";
import { Plus, UserPlus, Search, Filter, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserTable } from "@/components/dashboard/manage-users/UserTable";
import { EditUserModal } from "@/components/dashboard/manage-users/EditUserModal";
import { AddMemberModal } from "@/components/dashboard/manage-users/AddMemberModal";
import type { Id } from "@convex/_generated/dataModel";
import { UserModalData, UserFilters, SortConfig, UserRole, OfficerTeam, USER_ROLES, TEAMS } from "@/components/dashboard/manage-users/types";

export const Route = createFileRoute("/_dashboard/manage-users")({
  component: ManageUsersPage,
});

const ITEMS_PER_PAGE = 10;

function ManageUsersPage() {
  const { hasAdminAccess, logtoId, user: currentUser, getAuthHeaders, isLoading } = usePermissions();
  const users = useAuthedQuery(api.users.list, logtoId ? { logtoId } : "skip");

  // Mutations
  const updateStatusMutation = useAuthedMutation(api.users.updateStatus);
  const updateProfileForAdminMutation = useAuthedMutation(api.users.updateProfileForAdmin);
  const deleteUserMutation = useAuthedMutation(api.users.deleteUser);

  // State
  const [filters, setFilters] = useState<UserFilters>({
    searchTerm: "",
    roleFilter: "all",
    statusFilter: "all",
    teamFilter: "all",
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "name",
    direction: "asc",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserModalData | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset pagination when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortConfig]);


  // Filter and sort users
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    return users
      .filter((user) => {
        // Search filter
        const matchesSearch =
          !filters.searchTerm ||
          user.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          (user.pid && user.pid.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
          (user.major && user.major.toLowerCase().includes(filters.searchTerm.toLowerCase()));

        // Role filter
        const matchesRole = filters.roleFilter === "all" || user.role === filters.roleFilter;

        // Status filter
        const matchesStatus = filters.statusFilter === "all" || user.status === filters.statusFilter;

        // Team filter
        const matchesTeam = filters.teamFilter === "all" || user.team === filters.teamFilter;

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
  }, [users, filters, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Handlers
  const handleSort = (field: string) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
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

        if (Array.isArray(roleResult.warnings) && roleResult.warnings.length > 0) {
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
      toast.error(error.message || "Failed to update user");
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

      if (Array.isArray(roleResult.warnings) && roleResult.warnings.length > 0) {
        toast.warning(roleResult.warnings.join(" | "));
      }

      toast.success("User promoted successfully");
      setShowAddMemberModal(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to promote user");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: Id<"users">) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    setSaving(true);
    try {
      await deleteUserMutation({ userId });
      toast.success("User deleted successfully");
      setShowEditModal(false);
      setEditingUser(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete user");
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Access denied
  if (!hasAdminAccess) {
    return (
      <div className="w-full">
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
          <div className="bg-white rounded-xl border p-8 text-center">
            <div className="text-red-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Access Denied
            </h3>
            <p className="text-gray-500">
              You don't have permission to access user management.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Users</h1>
          <p className="text-muted-foreground">
            View and manage user accounts, roles, and permissions.
          </p>
        </div>



        {/* Filters */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, PID, major..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="pl-9"
                />
              </div>

              {/* Role Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Select
                  value={filters.roleFilter}
                  onValueChange={(v) => setFilters({ ...filters, roleFilter: v as any })}
                >
                  <SelectTrigger className="w-[150px]">
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
                  onValueChange={(v) => setFilters({ ...filters, statusFilter: v as any })}
                >
                  <SelectTrigger className="w-[150px]">
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
                  onValueChange={(v) => setFilters({ ...filters, teamFilter: v as any })}
                >
                  <SelectTrigger className="w-[150px]">
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

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAddMemberModal(true)}
                className="rounded-lg"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Promote to Officer
              </Button>

              <Button
                onClick={() => {
                  setEditingUser(null);
                  setShowEditModal(true);
                }}
                className="rounded-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>

          {/* Active Filters Display */}
          {(filters.searchTerm ||
            filters.roleFilter !== "all" ||
            filters.statusFilter !== "all" ||
            filters.teamFilter !== "all") && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Active filters:</span>

                  {filters.searchTerm && (
                    <Badge variant="secondary" className="rounded-full">
                      Search: "{filters.searchTerm}"
                      <button
                        onClick={() => setFilters({ ...filters, searchTerm: "" })}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}

                  {filters.roleFilter !== "all" && (
                    <Badge variant="secondary" className="rounded-full">
                      Role: {filters.roleFilter}
                      <button
                        onClick={() => setFilters({ ...filters, roleFilter: "all" })}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}

                  {filters.statusFilter !== "all" && (
                    <Badge variant="secondary" className="rounded-full">
                      Status: {filters.statusFilter}
                      <button
                        onClick={() => setFilters({ ...filters, statusFilter: "all" })}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}

                  {filters.teamFilter !== "all" && (
                    <Badge variant="secondary" className="rounded-full">
                      Team: {filters.teamFilter}
                      <button
                        onClick={() => setFilters({ ...filters, teamFilter: "all" })}
                        className="ml-2 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
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
                    Clear all
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
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
                </p>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-xl border p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
            <p className="text-gray-500">
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
      </div>
    </div>
  );
}
