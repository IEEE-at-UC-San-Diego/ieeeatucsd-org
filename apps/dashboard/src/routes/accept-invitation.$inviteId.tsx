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
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
	const { inviteId } = Route.useParams();
	const [invitation, setInvitation] = useState<Invitation | null>(null);
	const [loading, setLoading] = useState(true);
	const [processing, setProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [declined, setDeclined] = useState(false);
	const [selectedPosition, setSelectedPosition] = useState("");

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
				if (new Date() > expiresAt && data.status === "pending") {
					setError("This invitation has expired.");
				} else if (data.status === "expired") {
					setError("This invitation has expired.");
				}
			} catch (err) {
				console.error("Error fetching invitation:", err);
				if (!cancelled) {
					setError("Failed to load invitation. Please try again.");
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
				err instanceof Error ? err.message : "Failed to accept invitation",
			);
		} finally {
			setProcessing(false);
		}
	};

	const canAccept =
		!processing && (!hasMultiplePositions || Boolean(selectedPosition));

	const handleDecline = async () => {
		if (!window.confirm("Are you sure you want to decline this position?")) {
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
				err instanceof Error ? err.message : "Failed to decline invitation",
			);
		} finally {
			setProcessing(false);
		}
	};

	if (loading) {
		return (
			<CenteredShell>
				<Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
				<p className="text-muted-foreground">Loading invitation...</p>
			</CenteredShell>
		);
	}

	if (error) {
		return (
			<CenteredShell>
				<AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
				<h1 className="mb-2 text-2xl font-bold">Invitation Unavailable</h1>
				<p className="mb-6 text-muted-foreground">{error}</p>
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
				icon={<CheckCircle className="h-12 w-12 text-ds-green-700" />}
				title="Welcome to the Team!"
				description="You've successfully accepted the position."
				invitation={invitation}
			>
				<div className="rounded-lg border border-ds-blue-100 bg-ds-blue-100 p-5 text-left text-ds-blue-1000">
					<h2 className="mb-3 font-semibold">What's next?</h2>
					<ul className="list-disc space-y-2 pl-5 text-sm">
						<li>Check your email for detailed onboarding instructions.</li>
						<li>Your officer invitation has been recorded.</li>
						<li>
							Sign in to the dashboard and complete your onboarding steps.
						</li>
					</ul>
				</div>
				<Button asChild className="w-full">
					<a href="/signin">Sign in to Dashboard</a>
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
		<main className="min-h-screen bg-muted/40 p-4">
			<section className="mx-auto flex min-h-screen max-w-3xl items-center py-10">
				<div className="w-full overflow-hidden rounded-md border bg-background shadow-sm">
					<div className="bg-primary px-8 py-10 text-center text-primary-foreground">
						<h1 className="mb-2 text-3xl font-bold">
							Congratulations, {invitation?.name}!
						</h1>
						<p className="text-primary-foreground/80">
							You've been elected to the IEEE at UCSD board.
						</p>
					</div>

					<div className="space-y-6 p-8">
						<div className="rounded-lg border bg-card p-5">
							<div className="flex items-start gap-4">
								<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
									<Briefcase className="h-6 w-6 text-primary" />
								</div>
								<div>
									<p className="text-sm text-muted-foreground">
										{hasMultiplePositions
											? "Available Positions"
											: "Your Position"}
									</p>
									<h2 className="text-2xl font-bold">
										{hasMultiplePositions
											? "Choose one position"
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
								<p className="text-sm font-medium">
									Select the position you want to accept
								</p>
								<div className="grid gap-3">
									{offeredPositions.map((position) => {
										const selected = selectedPosition === position;
										return (
											<Button
												variant="outline"
												key={position}
												type="button"
												onClick={() => setSelectedPosition(position)}
												className={`rounded-lg border p-4 text-left transition ${
													selected
														? "border-primary bg-primary/10"
														: "bg-card hover:bg-muted/60"
												}`}
											>
												<div className="flex items-center justify-between gap-3">
													<span className="font-semibold">{position}</span>
													<span
														className={`h-4 w-4 rounded-full border ${
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

						{invitation?.message && (
							<div className="rounded-lg border border-ds-blue-100 bg-ds-blue-100 p-5">
								<p className="mb-2 text-sm font-medium text-ds-blue-1000">
									Message from Leadership
								</p>
								<p className="text-sm leading-relaxed text-ds-blue-700">
									{invitation.message}
								</p>
							</div>
						)}

						<div className="rounded-lg border border-ds-amber-100 bg-ds-amber-100 p-5 text-sm text-ds-amber-900">
							<p className="font-semibold">Important</p>
							<p className="mt-1 leading-relaxed">
								By accepting this position, you agree to fulfill the
								responsibilities of{" "}
								<strong>
									{hasMultiplePositions
										? selectedPosition || "the selected position"
										: invitation?.position}
								</strong>{" "}
								and commit to supporting IEEE at UCSD's mission.
							</p>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<Button
								type="button"
								variant="outline"
								onClick={handleDecline}
								disabled={processing}
								className="flex-1"
							>
								Decline Position
							</Button>
							<Button
								type="button"
								onClick={handleAccept}
								disabled={!canAccept}
								className="flex-1"
							>
								{processing ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : null}
								{processing ? "Processing..." : "Accept Position"}
							</Button>
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}

function CenteredShell({ children }: { children: React.ReactNode }) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
			<div className="w-full max-w-md rounded-md border bg-background p-8 text-center shadow-sm">
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
		<main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
			<div
				className={`w-full max-w-2xl overflow-hidden rounded-md border bg-background shadow-sm ${className}`}
			>
				<div className="bg-muted px-8 py-10 text-center">
					<div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-background">
						{icon}
					</div>
					<h1 className="mb-2 text-3xl font-bold">{title}</h1>
					<p className="text-muted-foreground">{description}</p>
				</div>
				<div className="space-y-6 p-8">
					<InvitationDetails invitation={invitation} />
					{children}
				</div>
			</div>
		</main>
	);
}

function InvitationDetails({ invitation }: { invitation: Invitation | null }) {
	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<DetailItem
				icon={<User className="h-5 w-5 text-primary" />}
				label="Full Name"
				value={invitation?.name}
			/>
			<DetailItem
				icon={<Mail className="h-5 w-5 text-primary" />}
				label="Email Address"
				value={invitation?.email}
			/>
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
