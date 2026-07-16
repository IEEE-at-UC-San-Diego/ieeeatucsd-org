import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle,
	Clock,
	ExternalLink,
	Eye,
	List,
	Loader2,
	Lock,
	Mail,
	Plus,
	RefreshCw,
	Save,
	Send,
	Settings,
	Trash2,
	UserPlus,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import {
	MobileDataList,
	MobileDataListItem,
	ResponsiveOverlay,
} from "@/components/mobile";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE } from "@/lib/onboarding-template";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/onboarding")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.officerInvitations.list, undefined, ctx),
	component: OnboardingPage,
});

const OFFICER_ROLES = ["General Officer", "Executive Officer"] as const;

const ALL_ROLES = [
	"Member",
	"General Officer",
	"Executive Officer",
	"Member at Large",
	"Past Officer",
	"Sponsor",
	"Administrator",
] as const;

const TEAMS = ["Internal", "Events", "Projects"] as const;

type PositionField = { id: string; value: string };

function createPositionField(value = ""): PositionField {
	return {
		id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
		value,
	};
}

/** Sticky, safe-area-aware submit bar. Full-bleed inside a `p-6` card on mobile, inline on desktop. */
const STICKY_FORM_FOOTER =
	"sticky bottom-0 z-10 -mx-6 -mb-6 rounded-b-md border-t bg-card/95 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:mx-0 sm:mb-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0 sm:pt-4 sm:backdrop-blur-none";

const MOBILE_INPUT = "h-11 text-base md:h-9 md:text-sm";

// ── Main Page ──

function OnboardingPage() {
	const { hasAdminAccess, logtoId, isLoading } = usePermissions();

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!hasAdminAccess) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<div className="max-w-md w-full mx-4 text-center">
					<div className="rounded-md border bg-card p-8">
						<div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
							<Lock className="w-8 h-8 text-destructive" />
						</div>
						<h2 className="text-2xl font-bold mb-2">Access Denied</h2>
						<p className="text-muted-foreground">
							You don't have permission to access the onboarding page. This page
							is only accessible to Executive Officers and Administrators.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<DashboardPage variant="list">
			<PageHeader
				title="Onboarding"
				description="Manage officer invitations and onboarding."
				hideTitleOnMobile
			/>

			<Tabs defaultValue="invitation" className="space-y-6">
				<div className="-mx-4 overflow-x-auto scrollbar-quiet px-4 sm:-mx-6 sm:px-6 md:mx-0 md:overflow-visible md:px-0">
					<TabsList variant="line" className="h-11 w-max gap-1 md:h-9 md:w-fit">
						<TabsTrigger
							value="invitation"
							className="h-11 shrink-0 gap-2 whitespace-nowrap px-4 md:h-8 md:px-2"
						>
							<Mail className="h-4 w-4" />
							Invitation Flow
						</TabsTrigger>
						<TabsTrigger
							value="direct"
							className="h-11 shrink-0 gap-2 whitespace-nowrap px-4 md:h-8 md:px-2"
						>
							<UserPlus className="h-4 w-4" />
							Direct Onboarding
						</TabsTrigger>
						<TabsTrigger
							value="pending"
							className="h-11 shrink-0 gap-2 whitespace-nowrap px-4 md:h-8 md:px-2"
						>
							<List className="h-4 w-4" />
							Pending Invitations
						</TabsTrigger>
						<TabsTrigger
							value="rejections"
							className="h-11 shrink-0 gap-2 whitespace-nowrap px-4 md:h-8 md:px-2"
						>
							<XCircle className="h-4 w-4" />
							Rejections
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent value="invitation">
					<InvitationFlowTab logtoId={logtoId} />
				</TabsContent>

				<TabsContent value="direct">
					<DirectOnboardingTab logtoId={logtoId} />
				</TabsContent>

				<TabsContent value="pending">
					<PendingInvitationsTab logtoId={logtoId} />
				</TabsContent>

				<TabsContent value="rejections">
					<RejectionsTab logtoId={logtoId} />
				</TabsContent>
			</Tabs>
		</DashboardPage>
	);
}

// ── Tab 1: Invitation Flow ──

function InvitationFlowTab({ logtoId }: { logtoId: string | null }) {
	const { getAuthHeaders } = useAuth();
	const createInvitation = useAuthedMutation(api.officerInvitations.create);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<string>("General Officer");
	const [positions, setPositions] = useState<PositionField[]>(() => [
		createPositionField(),
	]);
	const [team, setTeam] = useState<string>("");
	const [acceptanceDeadline, setAcceptanceDeadline] = useState("");
	const [leaderName, setLeaderName] = useState("");
	const [message, setMessage] = useState("");

	const resetForm = () => {
		setName("");
		setEmail("");
		setRole("General Officer");
		setPositions([createPositionField()]);
		setTeam("");
		setAcceptanceDeadline("");
		setLeaderName("");
		setMessage("");
	};

	const offeredPositions = positions.map((p) => p.value.trim()).filter(Boolean);

	const updatePosition = (index: number, value: string) => {
		setPositions((current) =>
			current.map((position, i) =>
				i === index ? { ...position, value } : position,
			),
		);
	};

	const addPosition = () => {
		setPositions((current) => [...current, createPositionField()]);
	};

	const removePosition = (index: number) => {
		setPositions((current) =>
			current.length === 1
				? [createPositionField()]
				: current.filter((_, i) => i !== index),
		);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!logtoId) return;

		if (!name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (!email.trim()) {
			toast.error("Email is required");
			return;
		}
		if (!role) {
			toast.error("Role is required");
			return;
		}
		if (offeredPositions.length === 0) {
			toast.error("At least one position is required");
			return;
		}

		if (acceptanceDeadline) {
			const deadline = new Date(acceptanceDeadline);
			if (isNaN(deadline.getTime())) {
				toast.error("Invalid acceptance deadline");
				return;
			}
			if (deadline <= new Date()) {
				toast.error("Acceptance deadline must be in the future");
				return;
			}
		}

		setIsSubmitting(true);
		try {
			const formattedDeadline = acceptanceDeadline
				? new Date(acceptanceDeadline).toLocaleString("en-US", {
						weekday: "long",
						year: "numeric",
						month: "long",
						day: "numeric",
						hour: "numeric",
						minute: "2-digit",
						timeZoneName: "short",
					})
				: undefined;

			const result = await createInvitation({
				logtoId,
				name,
				email,
				role: role as any,
				position: offeredPositions[0],
				offeredPositions,
				message: message || undefined,
				acceptanceDeadline: formattedDeadline,
				leaderName: leaderName || undefined,
			});

			// Send invitation email via API
			try {
				const resp = await fetch("/api/onboarding/send-invitation", {
					method: "POST",
					headers: { "Content-Type": "application/json", ...getAuthHeaders() },
					body: JSON.stringify({
						inviteId: result,
						name,
						email,
						role,
						position: offeredPositions[0],
						offeredPositions,
						acceptanceDeadline: formattedDeadline,
						message: message || undefined,
						leaderName: leaderName || undefined,
					}),
				});
				if (!resp.ok) {
					const err = await resp.json();
					console.error("Email send failed:", err);
					toast.warning("Invitation created but email failed to send.");
				}
			} catch (emailErr) {
				console.error("Email send error:", emailErr);
				toast.warning("Invitation created but email failed to send.");
			}

			toast.success(`Invitation sent successfully to ${name}!`);
			resetForm();
		} catch (error: any) {
			toast.error(error.message || "Failed to send invitation");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="max-w-4xl space-y-4">
			<div className="rounded-md border bg-card p-6">
				<div className="mb-6">
					<h3 className="text-lg font-semibold">Send Officer Invitation</h3>
					<p className="text-sm text-muted-foreground mt-1">
						Send an invitation email asking the prospective officer to accept
						their position. Upon acceptance, they will be automatically
						onboarded.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Full Name *</Label>
							<Input
								placeholder="John Doe"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className={MOBILE_INPUT}
								autoComplete="name"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label>Email Address *</Label>
							<Input
								type="email"
								placeholder="john.doe@ucsd.edu"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className={MOBILE_INPUT}
								inputMode="email"
								autoComplete="email"
								required
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Officer Role *</Label>
							<Select value={role} onValueChange={setRole}>
								<SelectTrigger className={MOBILE_INPUT}>
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									{ALL_ROLES.map((r) => (
										<SelectItem key={r} value={r}>
											{r}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Offered Positions *</Label>
							<div className="space-y-2">
								{positions.map((position, index) => (
									<div key={position.id} className="flex gap-2">
										<Input
											placeholder="e.g., Webmaster, President"
											value={position.value}
											onChange={(e) => updatePosition(index, e.target.value)}
											className={MOBILE_INPUT}
											required={index === 0}
										/>
										<Button
											type="button"
											variant="outline"
											size="icon"
											className="size-11 shrink-0 md:size-9"
											onClick={() => removePosition(index)}
											disabled={positions.length === 1}
											aria-label="Remove position"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={addPosition}
							>
								<Plus className="h-4 w-4 mr-2" />
								Add Position
							</Button>
							<p className="text-xs text-muted-foreground">
								If multiple positions are offered, the recipient will choose one
								when accepting.
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Team Assignment (Optional)</Label>
							<Select value={team} onValueChange={setTeam}>
								<SelectTrigger className={MOBILE_INPUT}>
									<SelectValue placeholder="Select a team" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">No Team</SelectItem>
									{TEAMS.map((t) => (
										<SelectItem key={t} value={t}>
											{t}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Acceptance Deadline *</Label>
							<Input
								type="datetime-local"
								value={acceptanceDeadline}
								onChange={(e) => setAcceptanceDeadline(e.target.value)}
								className={MOBILE_INPUT}
							/>
							<p className="text-xs text-muted-foreground">
								Date and time by which the officer must accept
							</p>
						</div>
					</div>

					<div className="space-y-2">
						<Label>Team Lead Name (Optional)</Label>
						<Input
							placeholder="e.g., Jane Smith"
							value={leaderName}
							onChange={(e) => setLeaderName(e.target.value)}
							className={MOBILE_INPUT}
							autoComplete="name"
						/>
					</div>

					<div className="space-y-2">
						<Label>Custom Message (Optional)</Label>
						<Textarea
							placeholder="Add any additional information for the invitation..."
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							rows={4}
							className="text-base md:text-sm"
						/>
					</div>

					<div className="rounded-lg border border-ds-blue-100 bg-ds-blue-100 p-4">
						<h4 className="text-sm font-medium text-ds-blue-1000 mb-2">
							What happens next?
						</h4>
						<ul className="text-sm text-tone-info space-y-1 list-disc list-inside">
							<li>
								An invitation email will be sent to the prospective officer
							</li>
							<li>
								They will have until the acceptance deadline to accept or
								decline
							</li>
							<li>
								Upon acceptance, they will automatically receive onboarding
								instructions
							</li>
							<li>Officer permissions will be granted in the system</li>
						</ul>
					</div>

					<div className={cn(STICKY_FORM_FOOTER, "flex justify-end")}>
						<Button
							type="submit"
							className="h-11 w-full sm:h-9 sm:w-auto"
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Send className="h-4 w-4 mr-2" />
							)}
							{isSubmitting ? "Sending Invitation..." : "Send Invitation"}
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ── Tab 2: Direct Onboarding ──

function DirectOnboardingTab({ logtoId }: { logtoId: string | null }) {
	const { getAuthHeaders } = useAuth();
	const orgSettings = useAuthedQuery(
		api.organizationSettings.get,
		logtoId ? { logtoId } : "skip",
	);
	const updateOrgSettings = useAuthedMutation(api.organizationSettings.update);
	const createDirectOnboarding = useAuthedMutation(
		api.directOnboardings.create,
	);
	const updateDirectOnboardingGoogleGroup = useAuthedMutation(
		api.directOnboardings.updateGoogleGroup,
	);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showPreview, setShowPreview] = useState(false);
	const [showSettings, setShowSettings] = useState(false);
	const [tempGoogleSheetsUrl, setTempGoogleSheetsUrl] = useState("");
	const [tempEmailTemplate, setTempEmailTemplate] = useState(
		DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE,
	);
	const [savingSettings, setSavingSettings] = useState(false);
	const [settingsError, setSettingsError] = useState<string | null>(null);

	// Form state
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<string>("General Officer");
	const [position, setPosition] = useState("");
	const [team, setTeam] = useState<string>("");
	const [leaderName, setLeaderName] = useState("");
	const [customMessage, setCustomMessage] = useState("");
	const [emailTemplate, setEmailTemplate] = useState(
		DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE,
	);

	const googleSheetsUrl = orgSettings?.googleSheetsContactListUrl || "";
	const savedEmailTemplate =
		orgSettings?.directOnboardingEmailTemplate ||
		DEFAULT_DIRECT_ONBOARDING_EMAIL_TEMPLATE;

	useEffect(() => {
		setTempGoogleSheetsUrl(googleSheetsUrl);
	}, [googleSheetsUrl]);

	useEffect(() => {
		if (orgSettings === undefined) return;
		setEmailTemplate(savedEmailTemplate);
		setTempEmailTemplate(savedEmailTemplate);
	}, [orgSettings, savedEmailTemplate]);

	const validateGoogleSheetsUrl = (url: string): boolean => {
		if (!url) return true;
		return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(
			url,
		);
	};

	const handleSaveSettings = async () => {
		if (!logtoId) return;
		setSettingsError(null);

		if (!validateGoogleSheetsUrl(tempGoogleSheetsUrl)) {
			setSettingsError("Please enter a valid Google Sheets URL");
			return;
		}
		if (!tempEmailTemplate.trim()) {
			setSettingsError("Please enter an onboarding email template");
			return;
		}

		setSavingSettings(true);
		try {
			await updateOrgSettings({
				logtoId,
				googleSheetsContactListUrl: tempGoogleSheetsUrl || undefined,
				directOnboardingEmailTemplate: tempEmailTemplate,
			});
			setEmailTemplate(tempEmailTemplate);
			toast.success("Onboarding settings saved successfully!");
			setTimeout(() => setShowSettings(false), 500);
		} catch (error) {
			console.error("Error saving settings:", error);
			setSettingsError("Failed to save settings. Please try again.");
		} finally {
			setSavingSettings(false);
		}
	};

	const resetForm = () => {
		setName("");
		setEmail("");
		setRole("General Officer");
		setPosition("");
		setTeam("");
		setLeaderName("");
		setCustomMessage("");
		setEmailTemplate(savedEmailTemplate);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!logtoId) return;

		if (!googleSheetsUrl) {
			setSettingsError(
				"Please configure the Google Sheets contact list URL before sending onboarding emails.",
			);
			setShowSettings(true);
			return;
		}

		if (!name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (!email.trim()) {
			toast.error("Email is required");
			return;
		}
		if (!role) {
			toast.error("Role is required");
			return;
		}
		if (!position.trim()) {
			toast.error("Position is required");
			return;
		}

		setIsSubmitting(true);
		try {
			// Send onboarding email via API
			const resp = await fetch("/api/onboarding/send-direct-onboarding", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({
					name,
					email,
					role,
					position,
					leaderName: leaderName || undefined,
					customMessage: customMessage || undefined,
					emailTemplate,
					googleSheetsUrl,
				}),
			});

			const result = await resp.json();
			if (!resp.ok) {
				throw new Error(result.error || "Failed to send onboarding email");
			}

			// Create record in Convex
			const directOnboardingId = await createDirectOnboarding({
				logtoId,
				name,
				email,
				role,
				position,
				team: team && team !== "none" ? team : undefined,
				emailSent: true,
				googleGroupAssigned: false,
				googleGroup: undefined,
			});

			// Best-effort role sync to Convex user + Logto by email
			try {
				const roleSyncResp = await fetch("/api/users/update-role", {
					method: "POST",
					headers: { "Content-Type": "application/json", ...getAuthHeaders() },
					body: JSON.stringify({
						email,
						name,
						role,
						position,
						team: team && team !== "none" ? team : undefined,
						source: "onboarding",
					}),
				});

				const roleSyncResult = await roleSyncResp.json();
				if (!roleSyncResp.ok) {
					toast.warning(
						roleSyncResult.error || "Onboarding succeeded but role sync failed",
					);
				} else {
					await updateDirectOnboardingGoogleGroup({
						logtoId,
						id: directOnboardingId,
						googleGroupAssigned: Boolean(roleSyncResult.googleGroupUpdated),
						googleGroup: roleSyncResult.googleGroup || undefined,
					});

					if (
						Array.isArray(roleSyncResult.warnings) &&
						roleSyncResult.warnings.length > 0
					) {
						toast.warning(roleSyncResult.warnings.join(" | "));
					}
				}
			} catch (roleSyncError) {
				console.error("Error syncing onboarding role:", roleSyncError);
				toast.warning(
					"Onboarding succeeded, but role sync could not be completed.",
				);
			}

			toast.success(`${name} has been onboarded successfully!`);
			resetForm();
		} catch (error: any) {
			console.error("Error sending direct onboarding:", error);
			toast.error(error.message || "Failed to onboard officer");
		} finally {
			setIsSubmitting(false);
		}
	};

	const getPreviewEmail = () => {
		let preview = emailTemplate;
		preview = preview.replace(/{NAME}/g, name || "[Name]");
		preview = preview.replace(/{POSITION}/g, position || "[Position]");

		const leaderInfo = leaderName
			? `The Vice Chair you'll be working with throughout the year will be ${leaderName}.`
			: "";
		preview = preview.replace(/{LEADER_INFO}/g, leaderInfo);

		const customMsg = customMessage ? `\n\n${customMessage}\n` : "";
		preview = preview.replace(/{CUSTOM_MESSAGE}/g, customMsg);

		if (googleSheetsUrl) {
			preview = preview.replace(
				/https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+[^\s)"]*/g,
				googleSheetsUrl,
			);
		}

		return preview;
	};

	return (
		<div className="max-w-4xl space-y-4">
			{/* Google Sheets URL Configuration Card */}
			<div className="rounded-md border bg-card p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex-1 min-w-0">
						<h3 className="text-lg font-semibold flex items-center gap-2">
							<Settings className="w-5 h-5" />
							Onboarding Email Configuration
						</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Configure the saved Direct Onboarding template and Google Sheets
							contact list URL used by invitation acceptance emails.
						</p>

						{orgSettings === undefined ? (
							<div className="mt-4">
								<Skeleton className="h-4 w-48" />
							</div>
						) : googleSheetsUrl ? (
							<div className="mt-4 space-y-2">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium">Current URL:</span>
									<a
										href={googleSheetsUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-primary hover:underline flex items-center gap-1"
									>
										View Sheet <ExternalLink className="w-3 h-3" />
									</a>
								</div>
								<p className="text-xs text-muted-foreground break-all">
									{googleSheetsUrl}
								</p>
							</div>
						) : (
							<div className="mt-4 flex items-center gap-2 text-sm text-tone-warning bg-ds-amber-100 border border-ds-amber-100 rounded-lg p-3">
								<AlertCircle className="w-4 h-4 shrink-0" />
								<span>
									No Google Sheets URL configured. Please configure it before
									sending onboarding emails.
								</span>
							</div>
						)}
					</div>
					<Button
						variant="outline"
						className="h-11 w-full shrink-0 sm:h-9 sm:w-auto"
						onClick={() => {
							setTempGoogleSheetsUrl(googleSheetsUrl);
							setTempEmailTemplate(savedEmailTemplate);
							setSettingsError(null);
							setShowSettings(true);
						}}
					>
						<Settings className="w-4 h-4 mr-2" />
						Configure
					</Button>
				</div>
			</div>

			{/* Direct Onboarding Form */}
			<div className="rounded-md border bg-card p-6">
				<div className="mb-6">
					<h3 className="text-lg font-semibold">Direct Officer Onboarding</h3>
					<p className="text-sm text-muted-foreground mt-1">
						Directly onboard an officer without requiring acceptance. The
						onboarding email will be sent immediately, and their officer
						permissions will be synced where possible.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Full Name *</Label>
							<Input
								placeholder="John Doe"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className={MOBILE_INPUT}
								autoComplete="name"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label>Email Address *</Label>
							<Input
								type="email"
								placeholder="john.doe@ucsd.edu"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className={MOBILE_INPUT}
								inputMode="email"
								autoComplete="email"
								required
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Officer Role *</Label>
							<Select value={role} onValueChange={setRole}>
								<SelectTrigger className={MOBILE_INPUT}>
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									{OFFICER_ROLES.map((r) => (
										<SelectItem key={r} value={r}>
											{r}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Position *</Label>
							<Input
								placeholder="e.g., Webmaster, President"
								value={position}
								onChange={(e) => setPosition(e.target.value)}
								className={MOBILE_INPUT}
								required
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Team Assignment (Optional)</Label>
							<Select value={team} onValueChange={setTeam}>
								<SelectTrigger className={MOBILE_INPUT}>
									<SelectValue placeholder="Select a team" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">No Team</SelectItem>
									{TEAMS.map((t) => (
										<SelectItem key={t} value={t}>
											{t}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Vice Chair / Mentor Name (Optional)</Label>
							<Input
								placeholder="e.g., Jane Smith"
								value={leaderName}
								onChange={(e) => setLeaderName(e.target.value)}
								className={MOBILE_INPUT}
								autoComplete="name"
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label>Additional Custom Message (Optional)</Label>
						<Textarea
							placeholder="Add any additional information to include in the email..."
							value={customMessage}
							onChange={(e) => setCustomMessage(e.target.value)}
							rows={3}
							className="text-base md:text-sm"
						/>
					</div>

					<div className="space-y-2">
						<Label>Email Template</Label>
						<p className="text-xs text-muted-foreground">
							Customize the onboarding email. Use {"{NAME}"}, {"{POSITION}"},{" "}
							{"{LEADER_INFO}"}, and {"{CUSTOM_MESSAGE}"} as placeholders.
						</p>
						<Textarea
							value={emailTemplate}
							onChange={(e) => setEmailTemplate(e.target.value)}
							rows={10}
							className="font-mono text-sm"
						/>
					</div>

					<div className="rounded-lg border border-ds-green-100 bg-ds-green-100 p-4">
						<h4 className="text-sm font-medium text-tone-success mb-2">
							What happens immediately?
						</h4>
						<ul className="text-sm text-tone-success space-y-1 list-disc list-inside">
							<li>
								Onboarding email will be sent with all necessary instructions
							</li>
							<li>Officer permissions will be granted in the system</li>
							<li>No acceptance required - they are onboarded immediately</li>
						</ul>
					</div>

					<div
						className={cn(
							STICKY_FORM_FOOTER,
							"flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3",
						)}
					>
						<Button
							type="button"
							variant="outline"
							className="h-11 w-full sm:h-9 sm:w-auto"
							onClick={() => setShowPreview(true)}
						>
							<Eye className="h-4 w-4 mr-2" />
							Preview Email
						</Button>
						<Button
							type="submit"
							className="h-11 w-full sm:h-9 sm:w-auto"
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Send className="h-4 w-4 mr-2" />
							)}
							{isSubmitting ? "Sending..." : "Send Onboarding Email"}
						</Button>
					</div>
				</form>
			</div>

			{/* Email Preview */}
			<ResponsiveOverlay
				open={showPreview}
				onOpenChange={setShowPreview}
				title="Email Preview"
				description="Preview of the onboarding email that will be sent."
				variant="fullscreen"
				footer={
					<Button
						className="h-11 w-full sm:h-9 sm:w-auto"
						onClick={() => setShowPreview(false)}
					>
						Close
					</Button>
				}
			>
				<div className="rounded-lg border bg-muted/50 p-4">
					<pre className="whitespace-pre-wrap text-sm font-mono">
						{getPreviewEmail()}
					</pre>
				</div>
			</ResponsiveOverlay>

			{/* Settings */}
			<ResponsiveOverlay
				open={showSettings}
				onOpenChange={(open) => {
					if (!open) {
						setShowSettings(false);
						setSettingsError(null);
						setTempGoogleSheetsUrl(googleSheetsUrl);
						setTempEmailTemplate(savedEmailTemplate);
					}
				}}
				title="Configure Onboarding Email"
				description="Save the Direct Onboarding template and contact list URL. Accepted invitations use this saved configuration."
				variant="large-sheet"
				footer={
					<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							variant="outline"
							className="h-11 w-full sm:h-9 sm:w-auto"
							onClick={() => {
								setShowSettings(false);
								setSettingsError(null);
								setTempGoogleSheetsUrl(googleSheetsUrl);
								setTempEmailTemplate(savedEmailTemplate);
							}}
						>
							Cancel
						</Button>
						<Button
							className="h-11 w-full sm:h-9 sm:w-auto"
							onClick={handleSaveSettings}
							disabled={savingSettings}
						>
							{savingSettings ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Save className="h-4 w-4 mr-2" />
							)}
							{savingSettings ? "Saving..." : "Save Settings"}
						</Button>
					</div>
				}
			>
				<div className="space-y-4">
					<div className="space-y-2">
						<Label>Google Sheets URL</Label>
						<Input
							type="url"
							placeholder="https://docs.google.com/spreadsheets/d/..."
							value={tempGoogleSheetsUrl}
							onChange={(e) => setTempGoogleSheetsUrl(e.target.value)}
							className={MOBILE_INPUT}
							inputMode="url"
						/>
						<p className="text-xs text-muted-foreground">
							The URL should start with https://docs.google.com/spreadsheets/d/
						</p>
					</div>

					<div className="space-y-2">
						<Label>Saved Direct Onboarding Template</Label>
						<p className="text-xs text-muted-foreground">
							Use {"{NAME}"}, {"{POSITION}"}, {"{LEADER_INFO}"}, and{" "}
							{"{CUSTOM_MESSAGE}"} as placeholders.
						</p>
						<Textarea
							value={tempEmailTemplate}
							onChange={(e) => setTempEmailTemplate(e.target.value)}
							rows={12}
							className="font-mono text-sm"
						/>
					</div>

					{settingsError && (
						<div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
							<AlertCircle className="w-4 h-4 shrink-0" />
							<span>{settingsError}</span>
						</div>
					)}

					<div className="rounded-lg border border-ds-blue-100 bg-ds-blue-100 p-4">
						<h4 className="text-sm font-medium text-ds-blue-1000 mb-2">
							Instructions:
						</h4>
						<ol className="text-sm text-tone-info space-y-1 list-decimal list-inside">
							<li>Open your Google Sheets contact list</li>
							<li>
								Click "Share" and ensure it's accessible to anyone with the link
							</li>
							<li>Copy the full URL from your browser's address bar</li>
							<li>Paste it in the field above</li>
						</ol>
					</div>
				</div>
			</ResponsiveOverlay>
		</div>
	);
}

// ── Tab 3: Rejections ──

function RejectionsTab({ logtoId }: { logtoId: string | null }) {
	const isMobile = useIsMobile();
	const { getAuthHeaders } = useAuth();
	const rejections = useAuthedQuery(
		api.officerRejections.list,
		logtoId ? { logtoId } : "skip",
	);
	const createRejection = useAuthedMutation(api.officerRejections.create);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [positions, setPositions] = useState<PositionField[]>(() => [
		createPositionField(),
	]);
	const [customMessage, setCustomMessage] = useState("");

	const rejectionPositions = positions
		.map((p) => p.value.trim())
		.filter(Boolean);

	const resetForm = () => {
		setName("");
		setEmail("");
		setPositions([createPositionField()]);
		setCustomMessage("");
	};

	const updatePosition = (index: number, value: string) => {
		setPositions((current) =>
			current.map((position, i) =>
				i === index ? { ...position, value } : position,
			),
		);
	};

	const addPosition = () => {
		setPositions((current) => [...current, createPositionField()]);
	};

	const removePosition = (index: number) => {
		setPositions((current) =>
			current.length === 1
				? [createPositionField()]
				: current.filter((_, i) => i !== index),
		);
	};

	const formatDate = (timestamp: number | undefined) => {
		if (!timestamp) return "N/A";
		return new Date(timestamp).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!logtoId) return;

		if (!name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (!email.trim()) {
			toast.error("Email is required");
			return;
		}

		setIsSubmitting(true);
		try {
			const resp = await fetch("/api/onboarding/send-rejection", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({
					name,
					email,
					positions: rejectionPositions,
					customMessage: customMessage || undefined,
				}),
			});
			const result = await resp.json();
			if (!resp.ok) {
				throw new Error(result.error || "Failed to send rejection email");
			}

			await createRejection({
				logtoId,
				name,
				email,
				positions: rejectionPositions,
				customMessage: customMessage || undefined,
				emailSent: true,
			});

			toast.success(`Rejection email sent to ${name}`);
			resetForm();
		} catch (error: any) {
			console.error("Error sending rejection:", error);
			toast.error(error.message || "Failed to send rejection email");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="max-w-4xl rounded-md border bg-card p-6">
				<div className="mb-6">
					<h3 className="text-lg font-semibold">Send Rejection Notice</h3>
					<p className="text-sm text-muted-foreground mt-1">
						Send a standard rejection email to someone who was not selected for
						an officer role.
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label>Full Name *</Label>
							<Input
								placeholder="John Doe"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className={MOBILE_INPUT}
								autoComplete="name"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label>Email Address *</Label>
							<Input
								type="email"
								placeholder="john.doe@ucsd.edu"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className={MOBILE_INPUT}
								inputMode="email"
								autoComplete="email"
								required
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label>Position(s) Applied For (Optional)</Label>
						<div className="space-y-2">
							{positions.map((position, index) => (
								<div key={position.id} className="flex gap-2">
									<Input
										placeholder="e.g., Webmaster, President"
										value={position.value}
										onChange={(e) => updatePosition(index, e.target.value)}
										className={MOBILE_INPUT}
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										className="size-11 shrink-0 md:size-9"
										onClick={() => removePosition(index)}
										disabled={positions.length === 1}
										aria-label="Remove position"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={addPosition}
						>
							<Plus className="h-4 w-4 mr-2" />
							Add Position
						</Button>
					</div>

					<div className="space-y-2">
						<Label>Custom Message (Optional)</Label>
						<Textarea
							placeholder="Add a brief personal note..."
							value={customMessage}
							onChange={(e) => setCustomMessage(e.target.value)}
							rows={4}
							className="text-base md:text-sm"
						/>
					</div>

					<div className={cn(STICKY_FORM_FOOTER, "flex justify-end")}>
						<Button
							type="submit"
							className="h-11 w-full sm:h-9 sm:w-auto"
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : (
								<Send className="h-4 w-4 mr-2" />
							)}
							{isSubmitting ? "Sending..." : "Send Rejection"}
						</Button>
					</div>
				</form>
			</div>

			<div>
				<div className="mb-4">
					<h3 className="text-lg font-semibold">Rejection History</h3>
					<p className="text-sm text-muted-foreground mt-1">
						Rejection notices sent through onboarding.
					</p>
				</div>

				{!rejections ? (
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-16 w-full rounded-md" />
						))}
					</div>
				) : rejections.length === 0 ? (
					<div className="rounded-md border bg-card p-8 text-center">
						<XCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
						<p className="text-muted-foreground">
							No rejection notices sent yet
						</p>
					</div>
				) : isMobile ? (
					<MobileDataList>
						{rejections.map((rejection) => (
							<MobileDataListItem
								key={rejection._id}
								title={rejection.name}
								subtitle={rejection.email}
								meta={
									rejection.positions.length > 0
										? rejection.positions.join(", ")
										: "No position specified"
								}
								status={
									<Badge
										variant="secondary"
										className="bg-ds-red-100 text-[10px] text-tone-danger"
									>
										{rejection.emailSent ? "Sent" : "Not Sent"}
									</Badge>
								}
								trailing={
									<span className="text-xs font-normal text-muted-foreground">
										{formatDate(rejection.sentAt)}
									</span>
								}
							/>
						))}
					</MobileDataList>
				) : (
					<div className="rounded-md border bg-card overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Position(s)</TableHead>
									<TableHead>Sent</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rejections.map((rejection) => (
									<TableRow key={rejection._id}>
										<TableCell className="font-medium">
											{rejection.name}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{rejection.email}
										</TableCell>
										<TableCell>
											{rejection.positions.length > 0
												? rejection.positions.join(", ")
												: "N/A"}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{formatDate(rejection.sentAt)}
										</TableCell>
										<TableCell>
											<Badge
												variant="secondary"
												className="bg-ds-red-100 text-tone-danger"
											>
												{rejection.emailSent ? "Sent" : "Not Sent"}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}

// ── Tab 4: Pending Invitations ──

function PendingInvitationsTab({ logtoId }: { logtoId: string | null }) {
	const isMobile = useIsMobile();
	const { getAuthHeaders } = useAuth();
	const invitations = useAuthedQuery(
		api.officerInvitations.list,
		logtoId ? { logtoId } : "skip",
	);
	const resendMutation = useAuthedMutation(api.officerInvitations.resend);

	const [resendingId, setResendingId] = useState<string | null>(null);

	const formatDate = (timestamp: number | undefined) => {
		if (!timestamp) return "N/A";
		try {
			return new Date(timestamp).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return "Invalid date";
		}
	};

	const isExpired = (inv: { expiresAt: number; status: string }) => {
		return Date.now() > inv.expiresAt && inv.status === "pending";
	};

	const getStatusBadge = (status: string, expired: boolean) => {
		if (expired) {
			return (
				<Badge variant="secondary" className="bg-muted text-foreground gap-1">
					<AlertCircle className="w-3 h-3" /> Expired
				</Badge>
			);
		}
		switch (status) {
			case "pending":
				return (
					<Badge
						variant="secondary"
						className="bg-ds-amber-100 text-tone-warning gap-1"
					>
						<Clock className="w-3 h-3" /> Pending
					</Badge>
				);
			case "accepted":
				return (
					<Badge
						variant="secondary"
						className="bg-ds-green-100 text-tone-success gap-1"
					>
						<CheckCircle className="w-3 h-3" /> Accepted
					</Badge>
				);
			case "declined":
				return (
					<Badge
						variant="secondary"
						className="bg-ds-red-100 text-tone-danger gap-1"
					>
						<XCircle className="w-3 h-3" /> Declined
					</Badge>
				);
			default:
				return <Badge variant="secondary">{status}</Badge>;
		}
	};

	const handleResend = async (inv: any) => {
		if (!logtoId) return;
		setResendingId(inv._id);
		try {
			await resendMutation({ logtoId, id: inv._id });

			// Send email via API
			try {
				const resp = await fetch("/api/onboarding/resend-invitation", {
					method: "POST",
					headers: { "Content-Type": "application/json", ...getAuthHeaders() },
					body: JSON.stringify({
						invitationId: inv._id,
						name: inv.name,
						email: inv.email,
						role: inv.role,
						position: inv.position,
						offeredPositions: inv.offeredPositions,
						acceptanceDeadline: inv.acceptanceDeadline,
						message: inv.message,
						leaderName: inv.leaderName,
					}),
				});
				if (!resp.ok) {
					console.error("Resend email failed");
					toast.warning(
						`Invitation updated but email failed to send to ${inv.name}`,
					);
					return;
				}
			} catch (emailErr) {
				console.error("Resend email error:", emailErr);
				toast.warning(
					`Invitation updated but email failed to send to ${inv.name}`,
				);
				return;
			}

			toast.success(`Invitation resent to ${inv.name}`);
		} catch {
			toast.error(`Failed to resend invitation to ${inv.name}`);
		} finally {
			setResendingId(null);
		}
	};

	const stats = invitations
		? {
				total: invitations.length,
				pending: invitations.filter((i) => i.status === "pending").length,
				accepted: invitations.filter((i) => i.status === "accepted").length,
				declined: invitations.filter((i) => i.status === "declined").length,
			}
		: null;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex justify-between items-center">
				<div>
					<h3 className="text-lg font-semibold">All Invitations</h3>
					<p className="text-sm text-muted-foreground mt-1">
						View and track all officer invitations sent through the system
					</p>
				</div>
			</div>

			{/* Stats Cards */}
			{stats && (
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
					<div className="rounded-md border bg-card p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total</p>
								<p className="text-2xl font-bold">{stats.total}</p>
							</div>
							<Mail className="w-8 h-8 text-muted-foreground/40" />
						</div>
					</div>
					<div className="rounded-md border bg-card p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Pending</p>
								<p className="text-2xl font-bold text-tone-warning">
									{stats.pending}
								</p>
							</div>
							<Clock className="w-8 h-8 text-tone-warning" />
						</div>
					</div>
					<div className="rounded-md border bg-card p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Accepted</p>
								<p className="text-2xl font-bold text-tone-success">
									{stats.accepted}
								</p>
							</div>
							<CheckCircle className="w-8 h-8 text-tone-success" />
						</div>
					</div>
					<div className="rounded-md border bg-card p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Declined</p>
								<p className="text-2xl font-bold text-tone-danger">
									{stats.declined}
								</p>
							</div>
							<XCircle className="w-8 h-8 text-tone-danger" />
						</div>
					</div>
				</div>
			)}

			{/* Invitations */}
			{!invitations ? (
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-16 w-full rounded-md" />
					))}
				</div>
			) : invitations.length === 0 ? (
				<div className="rounded-md border bg-card p-8 text-center">
					<Mail className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
					<p className="text-muted-foreground">No invitations sent yet</p>
					<p className="text-sm text-muted-foreground mt-1">
						Use the Invitation Flow or Direct Onboarding tabs to get started
					</p>
				</div>
			) : isMobile ? (
				<MobileDataList>
					{invitations.map((inv) => {
						const expired = isExpired(inv);
						return (
							<MobileDataListItem
								key={inv._id}
								title={inv.name}
								subtitle={inv.email}
								status={
									<>
										{getStatusBadge(inv.status, expired)}
										<Badge variant="secondary" className="text-[10px]">
											{inv.role}
										</Badge>
									</>
								}
								meta={
									<span
										className={cn(expired && "font-medium text-destructive")}
									>
										{Array.isArray(inv.offeredPositions) &&
										inv.offeredPositions.length > 1
											? inv.offeredPositions.join(", ")
											: inv.position}
										{" · "}
										{expired
											? "Expired"
											: `Expires ${formatDate(inv.expiresAt)}`}
									</span>
								}
								actions={
									inv.status === "pending" ? (
										<Button
											size="icon"
											variant="ghost"
											className="size-11"
											aria-label={`Resend invitation to ${inv.name}`}
											onClick={() => handleResend(inv)}
											disabled={resendingId === inv._id}
										>
											{resendingId === inv._id ? (
												<Loader2 className="size-4 animate-spin" />
											) : (
												<RefreshCw className="size-4" />
											)}
										</Button>
									) : undefined
								}
							/>
						);
					})}
				</MobileDataList>
			) : (
				<div className="rounded-md border bg-card overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Position</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Invited</TableHead>
								<TableHead>Expires</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{invitations.map((inv) => {
								const expired = isExpired(inv);
								return (
									<TableRow key={inv._id}>
										<TableCell className="font-medium">{inv.name}</TableCell>
										<TableCell className="text-muted-foreground">
											{inv.email}
										</TableCell>
										<TableCell>
											{Array.isArray(inv.offeredPositions) &&
											inv.offeredPositions.length > 1
												? inv.offeredPositions.join(", ")
												: inv.position}
										</TableCell>
										<TableCell>
											<Badge variant="secondary">{inv.role}</Badge>
										</TableCell>
										<TableCell>{getStatusBadge(inv.status, expired)}</TableCell>
										<TableCell className="text-muted-foreground">
											{formatDate(inv.invitedAt)}
										</TableCell>
										<TableCell
											className={
												expired
													? "text-destructive font-medium"
													: "text-muted-foreground"
											}
										>
											{formatDate(inv.expiresAt)}
										</TableCell>
										<TableCell>
											{inv.status === "pending" && (
												<Button
													size="sm"
													variant="ghost"
													onClick={() => handleResend(inv)}
													disabled={resendingId === inv._id}
												>
													{resendingId === inv._id ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<RefreshCw className="h-4 w-4" />
													)}
												</Button>
											)}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
