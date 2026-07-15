import type { Id } from "@convex/_generated/dataModel";
import { ChevronDown, ChevronUp, MoreHorizontal, Pencil } from "lucide-react";
import { UserAvatarFallback } from "@/components/dashboard/UserAvatarFallback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OfficerTeam, SortConfig, UserRole, UserStatus } from "./types";

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
	Member: "bg-muted text-foreground",
	"General Officer": "bg-ds-blue-100 text-ds-blue-700",
	"Executive Officer": "bg-ds-blue-100 text-ds-purple-700",
	"Member at Large": "bg-teal-100 text-ds-teal-700",
	"Past Officer": "bg-ds-amber-100 text-ds-amber-900",
	Sponsor: "bg-ds-amber-100 text-ds-amber-900",
	Administrator: "bg-ds-red-100 text-ds-red-800",
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
			<div className="bg-background rounded-md border p-8 text-center">
				<div className="text-muted-foreground mb-4">
					<svg
						className="w-12 h-12 mx-auto"
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
				</div>
				<h3 className="text-lg font-medium text-foreground mb-2">
					No users found
				</h3>
				<p className="text-muted-foreground">
					Try adjusting your search or filter criteria.
				</p>
			</div>
		);
	}

	return (
		<div className="bg-background rounded-md border overflow-hidden">
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b bg-muted/50">
							<th
								className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
								onClick={() => onSort("name")}
							>
								<span className="flex items-center gap-1">
									User {getSortIcon("name")}
								</span>
							</th>
							<th className="w-14 p-4 text-right font-medium text-muted-foreground">
								Actions
							</th>
							<th
								className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell cursor-pointer hover:bg-muted transition-colors"
								onClick={() => onSort("email")}
							>
								<span className="flex items-center gap-1">
									Email {getSortIcon("email")}
								</span>
							</th>
							<th
								className="text-left p-4 font-medium text-muted-foreground cursor-pointer hover:bg-muted transition-colors"
								onClick={() => onSort("role")}
							>
								<span className="flex items-center gap-1">
									Role {getSortIcon("role")}
								</span>
							</th>

							<th className="text-left p-4 font-medium text-muted-foreground hidden xl:table-cell">
								Points
							</th>
							<th
								className="text-left p-4 font-medium text-muted-foreground hidden xl:table-cell cursor-pointer hover:bg-muted transition-colors"
								onClick={() => onSort("lastLogin")}
							>
								<span className="flex items-center gap-1">
									Last Active {getSortIcon("lastLogin")}
								</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user, idx) => (
							<tr
								key={user._id}
								className={`border-b last:border-b-0 transition-colors hover:bg-muted focus-within:bg-muted ${
									idx % 2 === 1 ? "bg-muted/30" : ""
								}`}
							>
								<td className="p-4">
									<div className="flex items-center gap-3">
										<Avatar size="sm">
											<AvatarImage src={user.avatar} alt={user.name} />
											<AvatarFallback>
												<UserAvatarFallback
													name={user.name}
													size="sm"
													className="h-8 w-8 text-xs"
												/>
											</AvatarFallback>
										</Avatar>
										<div>
											<div className="flex items-center gap-2 text-sm font-medium text-foreground">
												<button
													type="button"
													className="text-left hover:underline"
													onClick={() => onRowClick?.(user)}
												>
													{user.name}
												</button>
												{user._id === currentUserId && (
													<Badge
														variant="outline"
														className="rounded-full text-xs"
													>
														You
													</Badge>
												)}
											</div>
											{user.pid && (
												<div className="text-xs text-muted-foreground">
													PID: {user.pid}
												</div>
											)}
										</div>
									</div>
								</td>
								<td className="p-4 hidden md:table-cell">
									<div className="text-sm text-foreground">{user.email}</div>
									{user.memberId && (
										<div className="text-xs text-muted-foreground">
											ID: {user.memberId}
										</div>
									)}
								</td>
								<td className="p-4">
									<Badge className={`text-xs ${roleColors[user.role]}`}>
										{user.role}
									</Badge>
								</td>

								<td className="p-4 hidden xl:table-cell">
									<Badge className="bg-ds-amber-100 text-ds-amber-900 font-mono">
										{user.points || 0}
									</Badge>
								</td>
								<td className="p-4 hidden xl:table-cell text-muted-foreground">
									{user.lastLogin
										? new Date(user.lastLogin).toLocaleDateString()
										: "Never"}
								</td>
								<td className="p-4 text-right">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={`Actions for ${user.name}`}
											>
												<MoreHorizontal />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem onSelect={() => onRowClick?.(user)}>
												<Pencil /> View and edit
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
