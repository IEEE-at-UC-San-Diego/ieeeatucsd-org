import type { Doc, Id } from "@convex/_generated/dataModel";
import { Check, Search, UserPlus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { Badge } from "@/components/ui/badge";
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
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { OfficerTeam, UserRole } from "./types";

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
	onSave: (
		userId: string,
		newRole: UserRole,
		newPosition: string,
		newTeam?: OfficerTeam,
	) => void;
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
	const formId = useId();
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
					((u.name &&
						u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
						(u.email &&
							u.email.toLowerCase().includes(searchTerm.toLowerCase()))),
			) as User[];
			setFilteredMembers(filtered);
		} else if (users) {
			const promotableUsers = users.filter((u) =>
				PROMOTABLE_ROLES.includes(u.role as UserRole),
			) as User[];
			setFilteredMembers(promotableUsers);
		}
	}, [searchTerm, users]);

	const isDirty =
		isOpen &&
		(searchTerm !== "" ||
			selectedMember !== null ||
			newPosition !== "" ||
			newTeam !== undefined);
	const confirmDiscard = useUnsavedChangesGuard(isDirty);

	const handleClose = async () => {
		if (!(await confirmDiscard())) return;
		onClose();
	};

	const handleSubmit = () => {
		if (selectedMember) {
			onSave(selectedMember._id, newRole, newPosition, newTeam);
		}
	};

	const isOfficerRole = (role: UserRole) => {
		return ["General Officer", "Executive Officer", "Administrator"].includes(
			role,
		);
	};

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) void handleClose();
			}}
			title={
				<span className="inline-flex items-center gap-2">
					<UserPlus className="h-5 w-5" />
					Promote User to Officer
				</span>
			}
			description="Search and select a user to promote to an officer role"
			variant="fullscreen"
			className="sm:max-w-2xl"
			footer={
				<div className="flex w-full gap-2">
					<Button
						variant="outline"
						className="h-11 flex-1 sm:h-9 sm:flex-none"
						onClick={() => void handleClose()}
					>
						Cancel
					</Button>
					<Button
						className="h-11 flex-1 sm:h-9 sm:flex-none"
						onClick={handleSubmit}
						disabled={!selectedMember || loading}
					>
						{loading ? "Promoting…" : "Promote User"}
					</Button>
				</div>
			}
		>
			<div className="space-y-5 pb-2">
				<div className="space-y-2">
					<Label htmlFor={`${formId}-promote-user-search`}>Search Users</Label>
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id={`${formId}-promote-user-search`}
							name="promoteUserSearch"
							autoComplete="off"
							placeholder="Search by name or email…"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="h-11 pl-9 text-base sm:h-9 sm:text-sm"
							type="search"
							enterKeyHint="search"
						/>
					</div>
				</div>

				<div className="space-y-2">
					<p
						id={`${formId}-promote-user-list-label`}
						className="text-sm font-medium"
					>
						Select User
					</p>
					<fieldset
						aria-labelledby={`${formId}-promote-user-list-label`}
						className="min-w-0 border rounded-lg max-h-64 overflow-y-auto overscroll-contain"
					>
						{filteredMembers.length === 0 ? (
							<output
								aria-live="polite"
								className="block p-8 text-center text-muted-foreground"
							>
								{searchTerm
									? "No users found matching your search."
									: "No users available to promote."}
							</output>
						) : (
							<div className="divide-y">
								{filteredMembers.map((member) => (
									<button
										type="button"
										key={member._id}
										onClick={() => setSelectedMember(member)}
										aria-pressed={selectedMember?._id === member._id}
										className={`motion-press flex w-full min-h-[52px] items-center justify-between gap-3 p-4 text-left transition-colors [content-visibility:auto] [contain-intrinsic-size:auto_84px] ${
											selectedMember?._id === member._id
												? "bg-ds-blue-100 border-l-4 border-l-ds-blue-700"
												: "active:bg-muted md:hover:bg-muted"
										}`}
									>
										<div className="min-w-0">
											<div className="truncate font-medium text-sm">
												{member.name}
											</div>
											<div className="truncate text-xs text-muted-foreground">
												{member.email}
											</div>
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
											<Check className="h-5 w-5 text-primary shrink-0" />
										)}
									</button>
								))}
							</div>
						)}
					</fieldset>
				</div>

				{selectedMember && (
					<div className="space-y-4 pt-4 border-t">
						<div className="space-y-2">
							<Label htmlFor={`${formId}-promote-new-role`}>New Role</Label>
							<Select
								value={newRole}
								onValueChange={(v) => setNewRole(v as UserRole)}
							>
								<SelectTrigger
									id={`${formId}-promote-new-role`}
									className="h-11 sm:h-9"
								>
									<SelectValue placeholder="Select role…" />
								</SelectTrigger>
								<SelectContent>
									{availableRoles
										.filter((role) => role !== "Member")
										.map((role) => (
											<SelectItem key={role} value={role}>
												{role}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor={`${formId}-promote-position`}>Position</Label>
								<Input
									id={`${formId}-promote-position`}
									name="position"
									autoComplete="off"
									placeholder="e.g., Treasurer, Secretary"
									value={newPosition}
									onChange={(e) => setNewPosition(e.target.value)}
									className="h-11 text-base sm:h-9 sm:text-sm"
								/>
							</div>
							{isOfficerRole(newRole) && (
								<div className="space-y-2">
									<Label htmlFor={`${formId}-promote-team`}>Team</Label>
									<Select
										value={newTeam ?? "none"}
										onValueChange={(v) =>
											setNewTeam(v === "none" ? undefined : (v as OfficerTeam))
										}
									>
										<SelectTrigger
											id={`${formId}-promote-team`}
											className="h-11 sm:h-9"
										>
											<SelectValue placeholder="Select team…" />
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
		</ResponsiveOverlay>
	);
}
