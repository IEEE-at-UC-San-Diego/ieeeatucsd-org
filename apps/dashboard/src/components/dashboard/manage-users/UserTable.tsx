import { ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatarFallback } from "@/components/dashboard/UserAvatarFallback";
import type { Id } from "@convex/_generated/dataModel";
import { UserRole, UserStatus, OfficerTeam, SortConfig } from "./types";

interface User {
  _id: Id<"users">;
  name: string;
  email: string;
  role: UserRole;
  position?: string;
  status: UserStatus;
  pid?: string;
  memberId?: string;
  major?: string;
  graduationYear?: number;
  points?: number;
  team?: OfficerTeam;
  avatar?: string;
  lastLogin?: number;
  joinDate?: number;
  eventsAttended?: number;
}

interface UserTableProps {
  users: User[];
  sortConfig: SortConfig;
  onSort: (field: string) => void;
  currentUserId?: Id<"users">;
  onRowClick?: (user: User) => void;
}

const roleColors: Record<UserRole, string> = {
  Member: "bg-gray-100 text-gray-800",
  "General Officer": "bg-blue-100 text-blue-800",
  "Executive Officer": "bg-purple-100 text-purple-800",
  "Member at Large": "bg-teal-100 text-teal-800",
  "Past Officer": "bg-orange-100 text-orange-800",
  Sponsor: "bg-yellow-100 text-yellow-800",
  Administrator: "bg-red-100 text-red-800",
};

const truncateMajor = (major: string, maxLength = 20) => {
  if (!major || major.length <= maxLength) return major;
  return major.substring(0, maxLength) + "...";
};

// Use truncateMajor to avoid unused variable error
void truncateMajor;

export function UserTable({
  users,
  sortConfig,
  onSort,
  currentUserId,
  onRowClick,
}: UserTableProps) {
  const getSortIcon = (field: string) => {
    if (sortConfig.field === field) {
      return sortConfig.direction === "asc" ? (
        <ChevronUp className="w-3.5 h-3.5" />
      ) : (
        <ChevronDown className="w-3.5 h-3.5" />
      );
    }
    return null;
  };

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
        <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/50">
              <th className="text-left p-4 font-medium text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort("name")}>
                <span className="flex items-center gap-1">User {getSortIcon("name")}</span>
              </th>
              <th className="text-left p-4 font-medium text-gray-500 hidden md:table-cell cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort("email")}>
                <span className="flex items-center gap-1">Email {getSortIcon("email")}</span>
              </th>
              <th className="text-left p-4 font-medium text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort("role")}>
                <span className="flex items-center gap-1">Role {getSortIcon("role")}</span>
              </th>

              <th className="text-left p-4 font-medium text-gray-500 hidden xl:table-cell">Points</th>
              <th className="text-left p-4 font-medium text-gray-500 hidden xl:table-cell cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => onSort("lastLogin")}>
                <span className="flex items-center gap-1">Last Active {getSortIcon("lastLogin")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => (
              <tr
                key={user._id}
                className={`border-b last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer ${idx % 2 === 1 ? "bg-gray-50/30" : ""
                  }`}
                onClick={() => onRowClick?.(user)}
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>
                        <UserAvatarFallback name={user.name} size="sm" className="h-8 w-8 text-xs" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        {user.name}
                        {user._id === currentUserId && (
                          <Badge variant="outline" className="rounded-full text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                      {user.pid && (
                        <div className="text-xs text-gray-500">PID: {user.pid}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4 hidden md:table-cell">
                  <div className="text-sm text-gray-900">{user.email}</div>
                  {user.memberId && (
                    <div className="text-xs text-gray-500">ID: {user.memberId}</div>
                  )}
                </td>
                <td className="p-4">
                  <Badge className={`text-xs ${roleColors[user.role]}`}>{user.role}</Badge>
                </td>

                <td className="p-4 hidden xl:table-cell">
                  <Badge className="bg-yellow-100 text-yellow-800 font-mono">
                    {user.points || 0}
                  </Badge>
                </td>
                <td className="p-4 hidden xl:table-cell text-gray-600">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
