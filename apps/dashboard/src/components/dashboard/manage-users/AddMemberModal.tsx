import { useState, useEffect } from "react";
import { Search, Check, UserPlus } from "lucide-react";
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
import { UserRole, OfficerTeam } from "./types";
import type { Id } from "@convex/_generated/dataModel";
import type { Doc } from "@convex/_generated/dataModel";

interface User {
  _id: Id<"users">;
  name: string;
  email: string;
  role: UserRole;
  position?: string;
}

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: string, newRole: UserRole, newPosition: string, newTeam?: OfficerTeam) => void;
  availableRoles: UserRole[];
  availableTeams: OfficerTeam[];
  users: Doc<"users">[] | undefined;
  loading?: boolean;
}

const PROMOTABLE_ROLES: UserRole[] = [
  "Member",
  "General Officer",
  "Member at Large",
  "Past Officer",
];

export function AddMemberModal({
  isOpen,
  onClose,
  onSave,
  availableRoles,
  availableTeams,
  users,
  loading = false,
}: AddMemberModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredMembers, setFilteredMembers] = useState<User[]>([]);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<UserRole>("General Officer");
  const [newPosition, setNewPosition] = useState("");
  const [newTeam, setNewTeam] = useState<OfficerTeam | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedMember(null);
      setNewRole("General Officer");
      setNewPosition("");
      setNewTeam(undefined);
    }
  }, [isOpen]);

  useEffect(() => {
    if (users) {
      const promotableUsers = users.filter((u) =>
        PROMOTABLE_ROLES.includes(u.role as UserRole),
      ) as User[];
      setFilteredMembers(promotableUsers);
    }
  }, [users]);

  useEffect(() => {
    if (searchTerm && users) {
      const filtered = users.filter(
        (u) =>
          PROMOTABLE_ROLES.includes(u.role as UserRole) &&
          ((u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))),
      ) as User[];
      setFilteredMembers(filtered);
    } else if (users) {
      const promotableUsers = users.filter((u) =>
        PROMOTABLE_ROLES.includes(u.role as UserRole),
      ) as User[];
      setFilteredMembers(promotableUsers);
    }
  }, [searchTerm, users]);

  const handleSubmit = () => {
    if (selectedMember) {
      onSave(selectedMember._id, newRole, newPosition, newTeam);
    }
  };

  const isOfficerRole = (role: UserRole) => {
    return ["General Officer", "Executive Officer", "Administrator"].includes(role);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Promote User to Officer
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search and select a user to promote to an officer role
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-4">
          {/* Search Users */}
          <div className="space-y-2">
            <Label>Search Users</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Users List */}
          <div className="space-y-2">
            <Label>Select User</Label>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchTerm ? "No users found matching your search." : "No users available to promote."}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredMembers.map((member) => (
                    <div
                      key={member._id}
                      onClick={() => setSelectedMember(member)}
                      className={`p-4 cursor-pointer hover:bg-muted transition-colors ${
                        selectedMember?._id === member._id
                          ? "bg-blue-50 border-l-4 border-l-blue-500"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                          <div className="mt-1">
                            <Badge variant="outline" className="text-xs">
                              {member.role}
                            </Badge>
                            {member.position && (
                              <Badge variant="secondary" className="text-xs ml-2">
                                {member.position}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {selectedMember?._id === member._id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Role and Position Selection */}
          {selectedMember && (
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>New Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.filter((role) => role !== "Member").map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Input
                    placeholder="e.g., Treasurer, Secretary"
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                  />
                </div>
                {isOfficerRole(newRole) && (
                  <div className="space-y-2">
                    <Label>Team</Label>
                    <Select value={newTeam ?? "none"} onValueChange={(v) => setNewTeam(v === "none" ? undefined : v as OfficerTeam)}>
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
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedMember || loading}>
            {loading ? "Promoting..." : "Promote User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
