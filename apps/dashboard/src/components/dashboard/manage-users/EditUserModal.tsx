import type { Id } from "@convex/_generated/dataModel";
import { Info, Loader2, Shield, Trash2, User } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { UserAvatarFallback } from "@/components/dashboard/UserAvatarFallback";
import { ResponsiveOverlay } from "@/components/mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { formatDate } from "@/lib/formatters";
import type { OfficerTeam, UserModalData, UserRole, UserStatus } from "./types";

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

const EMPTY_USER: UserModalData = {
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
};

const OFFICER_ROLES: UserRole[] = [
	"General Officer",
	"Executive Officer",
	"Administrator",
];

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
	const formId = useId();
	const [formData, setFormData] = useState<UserModalData>(EMPTY_USER);

	useEffect(() => {
		setFormData(editingUser ?? EMPTY_USER);
	}, [editingUser, isOpen]);

	const isDirty =
		isOpen &&
		JSON.stringify(formData) !== JSON.stringify(editingUser ?? EMPTY_USER);
	const confirmDiscard = useUnsavedChangesGuard(isDirty);

	const handleClose = async () => {
		if (!(await confirmDiscard())) return;
		onClose();
	};

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
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) void handleClose();
			}}
			title={
				<span className="inline-flex items-center gap-2">
					<User className="h-5 w-5" />
					{editingUser ? "Edit User" : "Add New User"}
				</span>
			}
			description={
				editingUser
					? "Edit user details, role, permissions, and account status"
					: "Add a new user to the system"
			}
			variant="fullscreen"
			className="sm:max-w-2xl"
			footer={
				<div className="flex w-full flex-wrap items-center justify-between gap-2">
					{editingUser && onDelete ? (
						<Button
							type="button"
							variant="destructive"
							className="h-11 sm:h-9"
							onClick={() => onDelete(editingUser.id as Id<"users">)}
							disabled={loading}
						>
							<Trash2 className="h-4 w-4 mr-2" />
							Delete User
						</Button>
					) : (
						<span />
					)}
					<div className="flex flex-1 justify-end gap-2 sm:flex-none">
						<Button
							type="button"
							variant="outline"
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							onClick={() => void handleClose()}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							form={`${formId}-user-form`}
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							disabled={loading}
						>
							{loading ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Saving…
								</>
							) : editingUser ? (
								"Update User"
							) : (
								"Add User"
							)}
						</Button>
					</div>
				</div>
			}
		>
			<form
				id={`${formId}-user-form`}
				onSubmit={handleSubmit}
				className="space-y-6 pb-2"
			>
				{/* User Info Header */}
				{editingUser && (
					<div className="flex items-center gap-4 pb-4 border-b">
						<Avatar size="lg">
							<AvatarImage src={editingUser.avatar} alt={editingUser.name} />
							<AvatarFallback>
								<UserAvatarFallback
									name={editingUser.name}
									size="md"
									className="h-12 w-12"
								/>
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0">
							<p className="truncate font-semibold text-lg">
								{editingUser.name}
							</p>
							<p className="truncate text-sm text-muted-foreground">
								{editingUser.email}
							</p>
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
						<h3 className="font-medium text-sm text-balance">
							Basic Information
						</h3>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor={`${formId}-edit-user-name`}>Name</Label>
							<Input
								id={`${formId}-edit-user-name`}
								name="name"
								autoComplete="off"
								value={formData.name}
								onChange={(e) => handleInputChange("name", e.target.value)}
								disabled={!!editingUser}
								className="h-11 text-base sm:h-9 sm:text-sm"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${formId}-edit-user-email`}>Email</Label>
							<Input
								id={`${formId}-edit-user-email`}
								name="email"
								type="email"
								spellCheck={false}
								value={formData.email}
								onChange={(e) => handleInputChange("email", e.target.value)}
								disabled={!!editingUser}
								className="h-11 text-base sm:h-9 sm:text-sm"
								autoComplete="email"
							/>
						</div>
					</div>
				</div>

				{/* Role & Permissions */}
				<div className="space-y-4 pt-2">
					<div className="flex items-center gap-2 pb-2 border-b">
						<Shield className="h-4 w-4 text-primary" />
						<h3 className="font-medium text-sm text-balance">
							Role & Permissions
						</h3>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor={`${formId}-edit-user-role`}>Role</Label>
							<Select
								value={formData.role}
								onValueChange={(v) => handleInputChange("role", v as UserRole)}
								disabled={!canEditRole}
							>
								<SelectTrigger
									id={`${formId}-edit-user-role`}
									className="h-11 sm:h-9"
								>
									<SelectValue placeholder="Select role…" />
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
							<Label htmlFor={`${formId}-edit-user-position`}>Position</Label>
							<Input
								id={`${formId}-edit-user-position`}
								name="position"
								autoComplete="off"
								value={formData.position || ""}
								onChange={(e) => handleInputChange("position", e.target.value)}
								disabled={!canEditPosition}
								placeholder="e.g., Treasurer"
								className="h-11 text-base sm:h-9 sm:text-sm"
							/>
						</div>
					</div>

					{/* Team Assignment - Only for officers */}
					{isOfficerRole(formData.role) && (
						<div className="space-y-2">
							<Label htmlFor={`${formId}-edit-user-team`}>Team</Label>
							<Select
								value={formData.team || "none"}
								onValueChange={(v) =>
									handleInputChange(
										"team",
										v === "none" ? undefined : (v as OfficerTeam),
									)
								}
							>
								<SelectTrigger
									id={`${formId}-edit-user-team`}
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

				{/* Account Status */}
				<div className="space-y-4 pt-2">
					<div className="flex items-center gap-2 pb-2 border-b">
						<Info className="h-4 w-4 text-muted-foreground" />
						<h3 className="font-medium text-sm text-balance">Account Status</h3>
					</div>
					<div className="space-y-2">
						<Label htmlFor={`${formId}-edit-user-status`}>Status</Label>
						<Select
							value={formData.status}
							onValueChange={(v) =>
								handleInputChange("status", v as UserStatus)
							}
							disabled={!canEditStatus}
						>
							<SelectTrigger
								id={`${formId}-edit-user-status`}
								className="h-11 sm:h-9"
							>
								<SelectValue placeholder="Select status…" />
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
						<h3 className="font-medium text-sm text-balance">
							Additional Information
						</h3>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor={`${formId}-edit-user-pid`}>TSN</Label>
							<Input
								id={`${formId}-edit-user-pid`}
								name="pid"
								spellCheck={false}
								value={formData.pid || ""}
								onChange={(e) => handleInputChange("pid", e.target.value)}
								placeholder="123456789"
								className="h-11 text-base sm:h-9 sm:text-sm"
								inputMode="numeric"
								autoComplete="off"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${formId}-edit-user-member-id`}>Member ID</Label>
							<Input
								id={`${formId}-edit-user-member-id`}
								name="memberId"
								autoComplete="off"
								spellCheck={false}
								value={formData.memberId || ""}
								onChange={(e) => handleInputChange("memberId", e.target.value)}
								placeholder="IEEE Member ID"
								className="h-11 text-base sm:h-9 sm:text-sm"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${formId}-edit-user-major`}>Major</Label>
							<Input
								id={`${formId}-edit-user-major`}
								name="major"
								autoComplete="off"
								value={formData.major || ""}
								onChange={(e) => handleInputChange("major", e.target.value)}
								placeholder="e.g., Computer Science"
								className="h-11 text-base sm:h-9 sm:text-sm"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${formId}-edit-user-graduation-year`}>
								Graduation Year
							</Label>
							<Input
								id={`${formId}-edit-user-graduation-year`}
								name="graduationYear"
								autoComplete="off"
								type="number"
								value={formData.graduationYear?.toString() || ""}
								onChange={(e) =>
									handleInputChange(
										"graduationYear",
										e.target.value ? parseInt(e.target.value) : undefined,
									)
								}
								placeholder="e.g., 2025"
								className="h-11 text-base sm:h-9 sm:text-sm"
								inputMode="numeric"
							/>
						</div>
					</div>
				</div>

				{/* Points Management (Admin only) */}
				{canEditPoints && (
					<div className="space-y-4 pt-2">
						<div className="flex items-center gap-2 pb-2 border-b">
							<Info className="h-4 w-4 text-muted-foreground" />
							<h3 className="font-medium text-sm text-balance">
								Points Management
							</h3>
						</div>
						<div className="space-y-2">
							<Label htmlFor={`${formId}-edit-user-points`}>Points</Label>
							<Input
								id={`${formId}-edit-user-points`}
								name="points"
								autoComplete="off"
								type="number"
								value={formData.points?.toString() || "0"}
								onChange={(e) =>
									handleInputChange("points", parseInt(e.target.value) || 0)
								}
								placeholder="0"
								className="h-11 text-base sm:h-9 sm:text-sm"
								inputMode="numeric"
							/>
						</div>
					</div>
				)}

				{/* IEEE Email Info (read-only) */}
				{editingUser?.hasIEEEEmail && (
					<div className="space-y-2 pt-2">
						<p className="text-sm font-medium">IEEE Email</p>
						<div className="p-3 bg-muted rounded-lg">
							<p className="break-all font-medium" translate="no">
								{editingUser.ieeeEmail}
							</p>
							{editingUser.ieeeEmailCreatedAt && (
								<p className="text-xs text-muted-foreground mt-1">
									Created: {formatDate(editingUser.ieeeEmailCreatedAt)}
								</p>
							)}
						</div>
					</div>
				)}
			</form>
		</ResponsiveOverlay>
	);
}
