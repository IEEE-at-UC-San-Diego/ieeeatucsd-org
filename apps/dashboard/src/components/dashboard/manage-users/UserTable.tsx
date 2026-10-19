import type { Id } from "@convex/_generated/dataModel";
import { ChevronDown, ChevronUp, MoreHorizontal, Pencil } from "lucide-react";
import { DotLabel, type DotTone } from "@/components/dashboard/DotLabel";
import { UserAvatarFallback } from "@/components/dashboard/UserAvatarFallback";
import { MobileDataList, MobileDataListItem } from "@/components/mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
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

const roleTone: Record<UserRole, DotTone> = {
	Member: "gray",
	"General Officer": "blue",
	"Executive Officer": "purple",
	"Member at Large": "teal",
	"Past Officer": "amber",
	Sponsor: "amber",
	Administrator: "red",
};

function RoleChip({ role, label }: { role: UserRole; label?: string }) {
	return <DotLabel tone={roleTone[role]}>{label ?? role}</DotLabel>;
}

function YouChip() {
	return <span className="text-xs text-muted-foreground">You</span>;
}

export function UserTable({
	users,
	sortConfig,
	onSort,
	currentUserId,
	onRowClick,
}: UserTableProps) {
	const isMobile = useIsMobile();

	const getSortIcon = (field: string) => {
		if (sortConfig.field !== field) return null;
		return sortConfig.direction === "asc" ? (
			<ChevronUp className="size-3" />
		) : (
			<ChevronDown className="size-3" />
		);
	};

	const headCell =
		"px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

	const sortableHead = (field: string, label: string, extra = "") => (
		<th
			scope="col"
			aria-sort={
				sortConfig.field === field
					? sortConfig.direction === "asc"
						? "ascending"
						: "descending"
					: "none"
			}
			className={cn("p-0 text-left", extra)}
		>
			<button
				type="button"
				onClick={() => onSort(field)}
				className={cn(
					headCell,
					"flex w-full items-center gap-1.5 transition-colors hover:text-foreground",
				)}
			>
				{label}
				{getSortIcon(field)}
			</button>
		</th>
	);

	if (users.length === 0) {
		return (
			<div className="flex flex-col items-center rounded-md border border-dashed px-6 py-14 text-center">
				<h3 className="text-sm font-semibold text-foreground">
					No users found
				</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					Try adjusting your search or filter criteria.
				</p>
			</div>
		);
	}

	if (isMobile) {
		return (
			<MobileDataList>
				{users.map((user) => (
					<MobileDataListItem
						key={user._id}
						leading={
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
						}
						title={
							<span className="inline-flex items-center gap-2">
								{user.name}
								{user._id === currentUserId && <YouChip />}
							</span>
						}
						subtitle={user.email}
						status={<RoleChip role={user.role} />}
						onClick={() => onRowClick?.(user)}
						actions={
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="size-11"
										aria-label={`Actions for ${user.name}`}
									>
										<MoreHorizontal className="size-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onSelect={() => onRowClick?.(user)}>
										<Pencil /> View and edit
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						}
					/>
				))}
			</MobileDataList>
		);
	}

	return (
		<div className="overflow-hidden rounded-md border">
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b">
							{sortableHead("name", "User")}
							{sortableHead("email", "Email", "hidden md:table-cell")}
							{sortableHead("role", "Role")}
							<th scope="col" className={cn(headCell, "hidden xl:table-cell")}>
								Points
							</th>
							{sortableHead("lastLogin", "Last Active", "hidden xl:table-cell")}
							<th scope="col" className="w-12">
								<span className="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{users.map((user) => (
							<tr
								key={user._id}
								className="transition-colors focus-within:bg-muted/50 hover:bg-muted/50"
							>
								<td className="px-4 py-3">
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
										<div className="min-w-0">
											<div className="flex items-center gap-2 text-sm font-medium text-foreground">
												<button
													type="button"
													className="truncate text-left hover:underline"
													onClick={() => onRowClick?.(user)}
												>
													{user.name}
												</button>
												{user._id === currentUserId && <YouChip />}
											</div>
											{user.pid && (
												<div className="font-mono text-xs text-muted-foreground">
													TSN {user.pid}
												</div>
											)}
										</div>
									</div>
								</td>
								<td className="hidden px-4 py-3 md:table-cell">
									<div className="text-sm text-foreground">{user.email}</div>
									{user.memberId && (
										<div className="font-mono text-xs text-muted-foreground">
											ID {user.memberId}
										</div>
									)}
								</td>
								<td className="px-4 py-3">
									<RoleChip role={user.role} />
								</td>
								<td className="hidden px-4 py-3 xl:table-cell">
									<span className="text-sm tabular-nums text-foreground">
										{user.points || 0}
									</span>
								</td>
								<td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">
									{user.lastLogin
										? new Date(user.lastLogin).toLocaleDateString()
										: "Never"}
								</td>
								<td className="px-3 py-3 text-right">
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
