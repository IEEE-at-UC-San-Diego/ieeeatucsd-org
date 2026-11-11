import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	Briefcase,
	Calendar,
	CheckCircle,
	Loader2,
	Mail,
	User,
	XCircle,
} from "lucide-react";
import {
	type KeyboardEvent,
	useEffect,
	useId,
	useReducer,
	useState,
} from "react";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	type Invitation,
	initialInvitationPhase,
	invitationPhaseReducer,
} from "@/lib/invitations/invitationPhase";

export const Route = createFileRoute("/accept-invitation/$inviteId")({
	component: AcceptInvitationPage,
});

const EXPIRED_INVITATION_MESSAGE =
	"This invitation has expired. Contact IEEE UCSD leadership to request a new one.";

type AcceptDetails = {
	email: string;
	selectedPosition: string;
};

function getAcceptInvitationEndpoint() {
	return "/api/onboarding/accept-invitation";
}

function AcceptInvitationPage() {
	const { inviteId } = Route.useParams();
	const [phase, dispatch] = useReducer(
		invitationPhaseReducer,
		initialInvitationPhase,
	);
	const confirm = useConfirm();

	useEffect(() => {
		let cancelled = false;

		const fetchInvitation = async () => {
			dispatch({ type: "loadStarted" });
			try {
				const endpoint = new URL(
					getAcceptInvitationEndpoint(),
					window.location.origin,
				);
				endpoint.searchParams.set("inviteId", inviteId);
				const response = await fetch(endpoint.toString());
				const result = await response.json();

				if (cancelled) return;
				if (!response.ok) {
					dispatch({
						type: "loadFailed",
						message:
							result.error ||
							"Invitation not found. Please check your link and try again.",
					});
					return;
				}

				dispatch({
					type: "loadSucceeded",
					invitation: result.invitation as Invitation,
					now: Date.now(),
				});
			} catch (err) {
				console.error("Error fetching invitation:", err);
				if (!cancelled) {
					dispatch({
						type: "loadFailed",
						message:
							"Failed to load invitation. Check your connection and reload the page.",
					});
				}
			}
		};

		void fetchInvitation();

		return () => {
			cancelled = true;
		};
	}, [inviteId]);

	const handleAccept = async ({ email, selectedPosition }: AcceptDetails) => {
		dispatch({ type: "acceptStarted" });
		try {
			const response = await fetch(getAcceptInvitationEndpoint(), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					inviteId,
					action: "accept",
					email,
					selectedPosition,
				}),
			});
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || "Failed to accept invitation");
			}

			dispatch({
				type: "acceptSucceeded",
				invitation: result.invitation as Invitation,
			});
		} catch (err) {
			console.error("Error accepting invitation:", err);
			dispatch({
				type: "actionFailed",
				message:
					err instanceof Error
						? err.message
						: "Failed to accept invitation. Try again in a moment.",
			});
		}
	};

	const handleDecline = async () => {
		if (
			!(await confirm({
				title: "Decline Position?",
				description:
					"You won’t be able to accept this invitation after declining.",
				confirmLabel: "Decline Position",
				destructive: true,
			}))
		) {
			return;
		}

		dispatch({ type: "declineStarted" });
		try {
			const response = await fetch(getAcceptInvitationEndpoint(), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					inviteId,
					action: "decline",
				}),
			});
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || "Failed to decline invitation");
			}

			dispatch({
				type: "declineSucceeded",
				invitation: result.invitation as Invitation,
			});
		} catch (err) {
			console.error("Error declining invitation:", err);
			dispatch({
				type: "actionFailed",
				message:
					err instanceof Error
						? err.message
						: "Failed to decline invitation. Try again in a moment.",
			});
		}
	};

	switch (phase.kind) {
		case "loading":
			return (
				<CenteredShell>
					<output className="block">
						<Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
						<p className="text-muted-foreground">Loading invitation…</p>
					</output>
				</CenteredShell>
			);
		case "loadFailed":
			return <InvitationUnavailable message={phase.message} />;
		case "expired":
			return <InvitationUnavailable message={EXPIRED_INVITATION_MESSAGE} />;
		case "accepted":
			return (
				<StatusShell
					className="success-reveal"
					icon={<CheckCircle className="h-12 w-12 text-tone-success" />}
					title="Welcome to the Team!"
					description="You’ve successfully accepted the position."
					invitation={phase.invitation}
				>
					<div className="rounded-lg border border-ds-blue-100 bg-ds-blue-100 p-5 text-left text-ds-blue-1000">
						<h2 className="mb-3 font-semibold text-balance">What’s Next?</h2>
						<ul className="list-disc space-y-2 pl-5 text-sm">
							<li>Check your email for detailed onboarding instructions.</li>
							<li>Your officer invitation has been recorded.</li>
							<li>
								Sign in to the dashboard and complete your onboarding steps.
							</li>
						</ul>
					</div>
					<Button asChild className="w-full">
						<a href="/signin">Sign In to Dashboard</a>
					</Button>
				</StatusShell>
			);
		case "declined":
			return (
				<StatusShell
					icon={<XCircle className="h-12 w-12 text-muted-foreground" />}
					title="Invitation Declined"
					description={`You have declined the ${phase.invitation.position ?? "officer"} position.`}
					invitation={phase.invitation}
				>
					<Button asChild variant="outline" className="w-full">
						<a href="/signin">Go to Dashboard</a>
					</Button>
				</StatusShell>
			);
		case "pending":
		case "accepting":
		case "declining":
			return (
				<InvitationOfferForm
					invitation={phase.invitation}
					processing={phase.kind !== "pending"}
					actionError={phase.kind === "pending" ? phase.actionError : undefined}
					onAccept={handleAccept}
					onDecline={handleDecline}
				/>
			);
		default: {
			const unreachable: never = phase;
			return unreachable;
		}
	}
}

function InvitationOfferForm({
	invitation,
	processing,
	actionError,
	onAccept,
	onDecline,
}: {
	invitation: Invitation;
	processing: boolean;
	actionError: string | undefined;
	onAccept: (details: AcceptDetails) => void;
	onDecline: () => void;
}) {
	const formId = useId();
	const [selectedPosition, setSelectedPosition] = useState(() =>
		invitation.offeredPositions && invitation.offeredPositions.length > 1
			? ""
			: invitation.position,
	);
	const [confirmEmail, setConfirmEmail] = useState("");

	const offeredPositions =
		invitation.offeredPositions && invitation.offeredPositions.length > 0
			? invitation.offeredPositions
			: invitation.position
				? [invitation.position]
				: [];
	const hasMultiplePositions = offeredPositions.length > 1;

	const handlePositionKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const step =
			event.key === "ArrowRight" || event.key === "ArrowDown"
				? 1
				: event.key === "ArrowLeft" || event.key === "ArrowUp"
					? -1
					: 0;
		if (!step) return;
		event.preventDefault();
		const index = offeredPositions.indexOf(selectedPosition);
		const next =
			offeredPositions[
				index === -1
					? 0
					: (index + step + offeredPositions.length) % offeredPositions.length
			];
		setSelectedPosition(next);
		for (const option of event.currentTarget.querySelectorAll<HTMLElement>(
			"[data-position]",
		)) {
			if (option.dataset.position === next) option.focus();
		}
	};

	const canAccept =
		!processing &&
		Boolean(confirmEmail.trim()) &&
		(!hasMultiplePositions || Boolean(selectedPosition));

	const handleAccept = () =>
		onAccept({
			email: confirmEmail.trim(),
			selectedPosition: hasMultiplePositions
				? selectedPosition
				: invitation.position,
		});

	return (
		<main className="min-h-dvh bg-muted/40 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
			<section className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-3xl items-start py-6 sm:items-center sm:py-10">
				<div className="w-full overflow-hidden rounded-md border bg-background shadow-sm">
					<div className="bg-primary px-4 py-6 text-center text-primary-foreground sm:px-8 sm:py-10">
						<h1 className="mb-1 text-xl font-bold text-balance break-words sm:mb-2 sm:text-3xl">
							Congratulations, {invitation.name}!
						</h1>
						<p className="text-sm text-primary-foreground/80 sm:text-base">
							You’ve been elected to the IEEE at UCSD board.
						</p>
					</div>

					<div className="space-y-5 p-4 sm:space-y-6 sm:p-8">
						<div className="rounded-lg border bg-card p-4 sm:p-5">
							<div className="flex items-start gap-3 sm:gap-4">
								<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:h-12 sm:w-12">
									<Briefcase className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
								</div>
								<div className="min-w-0">
									<p className="text-sm text-muted-foreground">
										{hasMultiplePositions
											? "Available Positions"
											: "Your Position"}
									</p>
									<h2 className="text-xl font-bold text-balance break-words sm:text-2xl">
										{hasMultiplePositions
											? "Choose One Position"
											: invitation.position}
									</h2>
									<p className="mt-1 text-sm text-muted-foreground">
										{invitation.role}
									</p>
								</div>
							</div>
						</div>

						{hasMultiplePositions ? (
							<div className="space-y-3">
								<p
									id={`${formId}-position-picker-label`}
									className="text-sm font-medium"
								>
									Select the position you want to accept
								</p>
								<div
									className="grid gap-3"
									role="radiogroup"
									aria-labelledby={`${formId}-position-picker-label`}
									onKeyDown={handlePositionKeyDown}
								>
									{offeredPositions.map((position, index) => {
										const selected = selectedPosition === position;
										const focusable = selectedPosition ? selected : index === 0;
										return (
											<Button
												variant="outline"
												key={position}
												type="button"
												role="radio"
												aria-checked={selected}
												tabIndex={focusable ? 0 : -1}
												data-position={position}
												onClick={() => setSelectedPosition(position)}
												className={`rounded-lg border p-4 text-left transition ${
													selected
														? "border-primary bg-primary/10"
														: "bg-card hover:bg-muted/60"
												}`}
											>
												<div className="flex items-center justify-between gap-3">
													<span className="min-w-0 font-semibold break-words whitespace-normal">
														{position}
													</span>
													<span
														aria-hidden="true"
														className={`h-4 w-4 shrink-0 rounded-full border ${
															selected
																? "border-primary bg-primary"
																: "border-muted-foreground/40"
														}`}
													/>
												</div>
											</Button>
										);
									})}
								</div>
							</div>
						) : null}

						<InvitationDetails invitation={invitation} />

						<div className="space-y-2">
							<label
								htmlFor={`${formId}-email`}
								className="text-sm font-medium"
							>
								Email address
							</label>
							<Input
								id={`${formId}-email`}
								type="email"
								autoComplete="email"
								value={confirmEmail}
								onChange={(event) => setConfirmEmail(event.target.value)}
								placeholder="The address that received this invitation"
							/>
						</div>

						{invitation.message && (
							<div className="rounded-lg border border-ds-blue-100 bg-ds-blue-100 p-5">
								<p className="mb-2 text-sm font-medium text-ds-blue-1000">
									Message from Leadership
								</p>
								<p className="text-sm leading-relaxed text-tone-info">
									{invitation.message}
								</p>
							</div>
						)}

						<div className="rounded-lg border border-ds-amber-100 bg-ds-amber-100 p-5 text-sm">
							<p className="font-semibold text-tone-warning">Important</p>
							<p className="mt-1 leading-relaxed text-muted-foreground">
								By accepting this position, you agree to fulfill the
								responsibilities of{" "}
								<strong className="text-foreground">
									{hasMultiplePositions
										? selectedPosition || "the selected position"
										: invitation.position}
								</strong>{" "}
								and commit to supporting IEEE at UCSD’s mission.
							</p>
						</div>

						{actionError && (
							<div
								role="alert"
								className="flex items-center gap-2 rounded-md border border-ds-red-100 bg-ds-red-100 p-4 text-tone-danger"
							>
								<AlertCircle className="h-5 w-5 shrink-0" />
								<span className="min-w-0 break-words text-sm">
									{actionError}
								</span>
							</div>
						)}

						<div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
							<div className="flex flex-col gap-3 sm:flex-row">
								<Button
									type="button"
									variant="outline"
									onClick={onDecline}
									disabled={processing}
									className="h-12 flex-1"
								>
									Decline Position
								</Button>
								<Button
									type="button"
									onClick={handleAccept}
									disabled={!canAccept}
									className="h-12 flex-1"
								>
									{processing ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : null}
									{processing ? "Processing…" : "Accept Position"}
								</Button>
							</div>
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}

function InvitationUnavailable({ message }: { message: string }) {
	return (
		<CenteredShell>
			<AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
			<h1 className="mb-2 text-2xl font-bold text-balance">
				Invitation Unavailable
			</h1>
			<p className="mb-6 text-muted-foreground" role="alert">
				{message}
			</p>
			<Button asChild>
				<a href="/signin">Go to Dashboard</a>
			</Button>
		</CenteredShell>
	);
}

function CenteredShell({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
			<div className="w-full max-w-md rounded-md border bg-background p-6 text-center shadow-sm sm:p-8">
				{children}
			</div>
		</main>
	);
}

function StatusShell({
	icon,
	title,
	description,
	invitation,
	children,
	className = "",
}: {
	icon: React.ReactNode;
	title: string;
	description: string;
	invitation: Invitation;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
			<div
				className={`w-full max-w-2xl overflow-hidden rounded-md border bg-background shadow-sm ${className}`}
			>
				<div className="bg-muted px-4 py-6 text-center sm:px-8 sm:py-10">
					<div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-background sm:mb-4 sm:h-20 sm:w-20">
						{icon}
					</div>
					<h1 className="mb-2 text-xl font-bold text-balance sm:text-3xl">
						{title}
					</h1>
					<p className="text-sm text-muted-foreground sm:text-base">
						{description}
					</p>
				</div>
				<div className="space-y-5 p-4 sm:space-y-6 sm:p-8">
					<InvitationDetails invitation={invitation} />
					{children}
				</div>
			</div>
		</main>
	);
}

function InvitationDetails({ invitation }: { invitation: Invitation }) {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
			<DetailItem
				icon={<User className="h-5 w-5 text-primary" />}
				label="Full Name"
				value={invitation.name}
			/>
			{invitation.email ? (
				<DetailItem
					icon={<Mail className="h-5 w-5 text-primary" />}
					label="Email Address"
					value={invitation.email}
				/>
			) : null}
			{invitation.acceptanceDeadline ? (
				<DetailItem
					icon={<Calendar className="h-5 w-5 text-primary" />}
					label="Response Deadline"
					value={invitation.acceptanceDeadline}
					className="sm:col-span-2"
				/>
			) : null}
		</div>
	);
}

function DetailItem({
	icon,
	label,
	value,
	className = "",
}: {
	icon: React.ReactNode;
	label: string;
	value: string | undefined;
	className?: string;
}) {
	return (
		<div className={`rounded-lg border bg-card p-4 ${className}`}>
			<div className="mb-2 flex items-center gap-3">
				{icon}
				<p className="text-sm font-medium text-muted-foreground">{label}</p>
			</div>
			<p className="break-all pl-8 font-medium">{value || "N/A"}</p>
		</div>
	);
}
