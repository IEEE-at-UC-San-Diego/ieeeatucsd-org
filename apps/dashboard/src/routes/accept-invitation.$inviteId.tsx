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
import { type KeyboardEvent, useEffect, useId, useState } from "react";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/accept-invitation/$inviteId")({
	component: AcceptInvitationPage,
});

type Invitation = {
	name: string;
	email: string;
	role: string;
	position: string;
	offeredPositions?: string[];
	status: "pending" | "accepted" | "declined" | "expired";
	expiresAt: number;
	message?: string;
	acceptanceDeadline?: string;
};

function getAcceptInvitationEndpoint() {
	return "/api/onboarding/accept-invitation";
}

function AcceptInvitationPage() {
	const formId = useId();
	const { inviteId } = Route.useParams();
	const [invitation, setInvitation] = useState<Invitation | null>(null);
	const [loading, setLoading] = useState(true);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [declined, setDeclined] = useState(false);
	const [selectedPosition, setSelectedPosition] = useState("");
	const [confirmEmail, setConfirmEmail] = useState("");
	const confirm = useConfirm();

	const offeredPositions =
		invitation?.offeredPositions && invitation.offeredPositions.length > 0
			? invitation.offeredPositions
			: invitation?.position
				? [invitation.position]
				: [];
	const hasMultiplePositions = offeredPositions.length > 1;

	useEffect(() => {
		let cancelled = false;

		const fetchInvitation = async () => {
			try {
				setLoading(true);
				setError(null);
				const endpoint = new URL(
					getAcceptInvitationEndpoint(),
					window.location.origin,
				);
				endpoint.searchParams.set("inviteId", inviteId);
				const response = await fetch(endpoint.toString());
				const result = await response.json();

				if (!response.ok) {
					setError(
						result.error ||
							"Invitation not found. Please check your link and try again.",
					);
					return;
				}

				if (cancelled) return;
				const data = result.invitation as Invitation;
				setInvitation(data);
				setSuccess(data.status === "accepted");
				setDeclined(data.status === "declined");
				setSelectedPosition(
					data.offeredPositions && data.offeredPositions.length > 1
						? ""
						: data.position,
				);

				const expiresAt = new Date(data.expiresAt);
				if (
					(new Date() > expiresAt && data.status === "pending") ||
					data.status === "expired"
				) {
					setError(
						"This invitation has expired. Contact IEEE UCSD leadership to request a new one.",
					);
				}
			} catch (err) {
				console.error("Error fetching invitation:", err);
				if (!cancelled) {
					setError(
						"Failed to load invitation. Check your connection and reload the page.",
					);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		void fetchInvitation();

		return () => {
			cancelled = true;
		};
	}, [inviteId]);

	const handleAccept = async () => {
		try {
			setProcessing(true);
			setError(null);

			const response = await fetch(getAcceptInvitationEndpoint(), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					inviteId,
					action: "accept",
					email: confirmEmail.trim(),
					selectedPosition: hasMultiplePositions
						? selectedPosition
						: invitation?.position,
				}),
			});
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || "Failed to accept invitation");
			}

			setInvitation(result.invitation as Invitation);
			setSuccess(true);
		} catch (err) {
			console.error("Error accepting invitation:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to accept invitation. Try again in a moment.",
			);
		} finally {
			setProcessing(false);
		}
	};

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

		try {
			setProcessing(true);
			setError(null);

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

			setInvitation(result.invitation as Invitation);
			setDeclined(true);
		} catch (err) {
			console.error("Error declining invitation:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to decline invitation. Try again in a moment.",
			);
		} finally {
			setProcessing(false);
		}
	};

	if (loading) {
		return (
			<CenteredShell>
				<output className="block">
					<Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
					<p className="text-muted-foreground">Loading invitation…</p>
				</output>
			</CenteredShell>
		);
	}

	if (error) {
		return (
			<CenteredShell>
				<AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
				<h1 className="mb-2 text-2xl font-bold text-balance">
					Invitation Unavailable
				</h1>
				<p className="mb-6 text-muted-foreground" role="alert">
					{error}
				</p>
				<Button asChild>
					<a href="/signin">Go to Dashboard</a>
				</Button>
			</CenteredShell>
		);
	}

	if (success) {
		return (
			<StatusShell
				className="success-reveal"
				icon={<CheckCircle className="h-12 w-12 text-tone-success" />}
				title="Welcome to the Team!"
				description="You’ve successfully accepted the position."
				invitation={invitation}
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
	}

	if (declined) {
		return (
			<StatusShell
				icon={<XCircle className="h-12 w-12 text-muted-foreground" />}
				title="Invitation Declined"
				description={`You have declined the ${invitation?.position ?? "officer"} position.`}
				invitation={invitation}
			>
				<Button asChild variant="outline" className="w-full">
					<a href="/signin">Go to Dashboard</a>
				</Button>
			</StatusShell>
		);
	}

	return (
		<main className="min-h-dvh bg-muted/40 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
			<section className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-3xl items-start py-6 sm:items-center sm:py-10">
				<div className="w-full overflow-hidden rounded-md border bg-background shadow-sm">
					<div className="bg-primary px-4 py-6 text-center text-primary-foreground sm:px-8 sm:py-10">
						<h1 className="mb-1 text-xl font-bold text-balance break-words sm:mb-2 sm:text-3xl">
							Congratulations, {invitation?.name}!
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
											: invitation?.position}
									</h2>
									<p className="mt-1 text-sm text-muted-foreground">
										{invitation?.role}
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

						{invitation?.message && (
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
										: invitation?.position}
								</strong>{" "}
								and commit to supporting IEEE at UCSD’s mission.
							</p>
						</div>

						<div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
							<div className="flex flex-col gap-3 sm:flex-row">
								<Button
									type="button"
									variant="outline"
									onClick={handleDecline}
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
	invitation: Invitation | null;
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

function InvitationDetails({ invitation }: { invitation: Invitation | null }) {
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
			<DetailItem
				icon={<User className="h-5 w-5 text-primary" />}
				label="Full Name"
				value={invitation?.name}
			/>
			{invitation?.email ? (
				<DetailItem
					icon={<Mail className="h-5 w-5 text-primary" />}
					label="Email Address"
					value={invitation.email}
				/>
			) : null}
			{invitation?.acceptanceDeadline ? (
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
