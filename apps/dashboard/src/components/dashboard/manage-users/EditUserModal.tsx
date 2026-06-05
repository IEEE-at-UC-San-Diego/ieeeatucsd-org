import { useState, useEffect } from "react";
import { Shield, User, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatarFallback } from "@/components/dashboard/UserAvatarFallback";
import { Loader2, Trash2 } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { UserModalData, UserRole, OfficerTeam, UserStatus } from "./types";

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: UserModalData) => void;
  editingUser: UserModalData | null;
  availableRoles: UserRole[];
  availableTeams: OfficerTeam[];
  canEditRole?: boolean;
  canEditPosition?: boolean;
  canEditStatus?: boolean;
  canEditPoints?: boolean;
  loading?: boolean;
  currentUserId?: Id<"users">;
  onDelete?: (userId: Id<"users">) => void;
}

const OFFICER_ROLES: UserRole[] = ["General Officer", "Executive Officer", "Administrator"];

export function EditUserModal({
  isOpen,
  onClose,
  onSave,
  editingUser,
  availableRoles,
  availableTeams,
  canEditRole = true,
  canEditPosition = true,
  canEditStatus = true,
  canEditPoints = false,
  loading = false,
  currentUserId,
  onDelete,
}: EditUserModalProps) {
  const [formData, setFormData] = useState<UserModalData>({
    name: "",
    email: "",
    role: "Member",
    position: "",
    status: "active",
    pid: "",
    memberId: "",
    major: "",
    team: undefined,
    points: 0,
  });

  useEffect(() => {
    if (editingUser) {
      setFormData(editingUser);
    } else {
      setFormData({
        name: "",
        email: "",
        role: "Member",
        position: "",
        status: "active",
        pid: "",
        memberId: "",
        major: "",
        team: undefined,
        points: 0,
      });
    }
  }, [editingUser, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleInputChange = (field: keyof UserModalData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isOfficerRole = (role: UserRole) => {
    return OFFICER_ROLES.includes(role);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {editingUser ? "Edit User" : "Add New User"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {editingUser ? "Edit user details, role, permissions, and account status" : "Add a new user to the system"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <form id="user-form" onSubmit={handleSubmit} className="space-y-6 py-4">
            {/* User Info Header */}
            {editingUser && (
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar size="lg">
                  <AvatarImage src={editingUser.avatar} alt={editingUser.name} />
                  <AvatarFallback>
                    <UserAvatarFallback name={editingUser.name} size="md" className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">{editingUser.name}</p>
                  <p className="text-sm text-muted-foreground">{editingUser.email}</p>
                  {editingUser._id === currentUserId && (
                    <Badge variant="outline" className="mt-1">
                      You
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">Basic Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    disabled={!!editingUser}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={!!editingUser}
                  />
                </div>
              </div>
            </div>

            {/* Role & Permissions */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Shield className="h-4 w-4 text-primary" />
                <h3 className="font-medium text-sm">Role & Permissions</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => handleInputChange("role", v as UserRole)}
                    disabled={!canEditRole}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Input
                    value={formData.position || ""}
                    onChange={(e) => handleInputChange("position", e.target.value)}
                    disabled={!canEditPosition}
                    placeholder="e.g., Treasurer"
                  />
                </div>
              </div>

              {/* Team Assignment - Only for officers */}
              {isOfficerRole(formData.role) && (
                <div className="space-y-2">
                  <Label>Team</Label>
                  <Select
                    value={formData.team || "none"}
                    onValueChange={(v) =>
                      handleInputChange("team", v === "none" ? undefined : (v as OfficerTeam))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Team</SelectItem>
                      {availableTeams.map((team) => (
                        <SelectItem key={team} value={team}>
                          {team}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Account Status */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">Account Status</h3>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => handleInputChange("status", v as UserStatus)}
                  disabled={!canEditStatus}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium text-sm">Additional Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PID</Label>
                  <Input
                    value={formData.pid || ""}
                    onChange={(e) => handleInputChange("pid", e.target.value)}
                    placeholder="Student ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Member ID</Label>
                  <Input
                    value={formData.memberId || ""}
                    onChange={(e) => handleInputChange("memberId", e.target.value)}
                    placeholder="IEEE Member ID"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Major</Label>
                  <Input
                    value={formData.major || ""}
                    onChange={(e) => handleInputChange("major", e.target.value)}
                    placeholder="e.g., Computer Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Graduation Year</Label>
                  <Input
                    type="number"
                    value={formData.graduationYear?.toString() || ""}
                    onChange={(e) =>
                      handleInputChange(
                        "graduationYear",
                        e.target.value ? parseInt(e.target.value) : undefined,
                      )
                    }
                    placeholder="e.g., 2025"
                  />
                </div>
              </div>
            </div>

            {/* Points Management (Admin only) */}
            {canEditPoints && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">Points Management</h3>
                </div>
                <div className="space-y-2">
                  <Label>Points</Label>
                  <Input
                    type="number"
                    value={formData.points?.toString() || "0"}
                    onChange={(e) => handleInputChange("points", parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>
            )}

            {/* IEEE Email Info (read-only) */}
            {editingUser?.hasIEEEEmail && (
              <div className="space-y-2 pt-2">
                <Label>IEEE Email</Label>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{editingUser.ieeeEmail}</p>
                  {editingUser.ieeeEmailCreatedAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Created: {new Date(editingUser.ieeeEmailCreatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        <DialogFooter className="pt-4 border-t flex justify-between sm:justify-between">
          {editingUser && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => onDelete(editingUser.id as Id<"users">)}
              disabled={loading}
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" form="user-form" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingUser ? "Update User" : "Add User"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
