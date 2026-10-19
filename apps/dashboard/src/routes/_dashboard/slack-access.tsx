import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle,
	Copy,
	ExternalLink,
	Eye,
	EyeOff,
	Loader2,
	Mail,
	RefreshCw,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import {
	EmailModal,
	parseSender,
} from "@/components/dashboard/slack-access/EmailModal";
import { PasswordStrengthIndicator } from "@/components/dashboard/slack-access/PasswordStrengthIndicator";
import type {
	EmailGenerationState,
	EmailInboxState,
	EmailMessage,
	PasswordValidation,
} from "@/components/dashboard/slack-access/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

/**
 * Domain of the Slack IEEE mailboxes created on this page. This matches the
 * server's MXROUTE_EMAIL_DOMAIN and is not the org's main ieeeatucsd.org domain.
 */
const IEEE_EMAIL_DOMAIN = "ieeeucsd.org";

export const Route = createFileRoute("/_dashboard/slack-access")({
	component: SlackAccessPage,
});

function SlackAccessPage() {
	const { user, getAuthHeaders } = useAuth();
	const passwordInputId = useId();

	const [showPassword, setShowPassword] = useState(false);
	const [customPassword, setCustomPassword] = useState("");

	const [showInboxPassword, setShowInboxPassword] = useState(false);
	const [inboxPassword, setInboxPassword] = useState("");

	const [currentPage, setCurrentPage] = useState(1);
	const emailsPerPage = 10;

	const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
	const [emailState, setEmailState] = useState<EmailGenerationState>({
		isGenerating: false,
		isResetting: false,
		generatedEmail: null,
		error: null,
		success: null,
	});
	const [inboxState, setInboxState] = useState<EmailInboxState>({
		isAuthenticated: false,
		isLoading: false,
		isRefreshing: false,
		emails: [],
		error: null,
		credentials: null,
	});

	// Check if user has existing IEEE email
	const hasIEEEEmail = !!user?.ieeeEmail;
	const ieeeEmail = user?.ieeeEmail || emailState.generatedEmail;
	const canResetPassword =
		user?.role &&
		[
			"General Officer",
			"Executive Officer",
			"Past Officer",
			"Administrator",
		].includes(user?.role);

	const extractUsername = (email: string): string => {
		return email
			.split("@")[0]
			.toLowerCase()
			.replace(/[^a-z0-9]/g, "");
	};

	const validatePassword = (password: string): PasswordValidation => {
		const requirements = {
			minLength: password.length >= 8,
			hasUppercase: /[A-Z]/.test(password),
			hasLowercase: /[a-z]/.test(password),
			hasNumber: /[0-9]/.test(password),
			hasSpecialChar: /[!@#$%^&*()_+-=[\]{}|;:,.<>?]/.test(password),
		};

		const isValid = Object.values(requirements).every((req) => req);
		const strength = Object.values(requirements).filter((req) => req).length;

		return { isValid, strength, requirements };
	};

	const handleIEEEPasswordKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			if (hasIEEEEmail) {
				if (
					!emailState.isResetting &&
					customPassword.trim() &&
					passwordValidation.isValid
				) {
					resetEmailPassword();
				}
			} else {
				if (
					!emailState.isGenerating &&
					customPassword.trim() &&
					passwordValidation.isValid
				) {
					generateIEEEEmail();
				}
			}
		}
	};

	const passwordValidation = validatePassword(customPassword);

	const handleInboxPasswordKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			if (!inboxState.isLoading && inboxPassword.trim()) {
				authenticateInbox();
			}
		}
	};

	const getPaginatedEmails = () => {
		const startIndex = (currentPage - 1) * emailsPerPage;
		const endIndex = startIndex + emailsPerPage;
		return inboxState.emails.slice(startIndex, endIndex);
	};

	const generateIEEEEmail = async () => {
		if (!user) {
			setEmailState((prev) => ({
				...prev,
				error: "User authentication required",
			}));
			return;
		}

		if (!user.email || !user.email.includes("@")) {
			setEmailState((prev) => ({
				...prev,
				error: "Invalid user email format",
			}));
			return;
		}

		if (!customPassword.trim()) {
			setEmailState((prev) => ({ ...prev, error: "Password is required" }));
			return;
		}

		const validation = validatePassword(customPassword);
		if (!validation.isValid) {
			setEmailState((prev) => ({
				...prev,
				error: "Password does not meet requirements.",
			}));
			return;
		}

		setEmailState((prev) => ({
			...prev,
			isGenerating: true,
			error: null,
			success: null,
		}));

		try {
			const username = extractUsername(user.email);
			const proposedEmail = `${username}@${IEEE_EMAIL_DOMAIN}`;

			const checkResponse = await fetch("/api/check-email-exists", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({ email: proposedEmail }),
			});

			if (checkResponse.ok) {
				const checkResult = await checkResponse.json();
				if (checkResult.exists) {
					setEmailState((prev) => ({
						...prev,
						isGenerating: false,
						error: `Email ${proposedEmail} already exists. Please contact webmaster@ieeeatucsd.org.`,
					}));
					return;
				}
			}

			const response = await fetch("/api/create-ieee-email", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({
					username: extractUsername(user.email),
					password: customPassword,
				}),
			});

			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);
			const result = await response.json();

			if (result.success) {
				setEmailState((prev) => ({
					...prev,
					isGenerating: false,
					generatedEmail: result.ieeeEmail,
					success: `IEEE email ${result.ieeeEmail} created successfully!`,
				}));
				toast.success("IEEE email created successfully!");
				setCustomPassword("");
			} else {
				setEmailState((prev) => ({
					...prev,
					isGenerating: false,
					error: result.message || "Failed to create IEEE email",
				}));
			}
		} catch (error) {
			console.error("Error creating IEEE email:", error);
			setEmailState((prev) => ({
				...prev,
				isGenerating: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to create IEEE email.",
			}));
		}
	};

	const resetEmailPassword = async () => {
		const ieeeEmailAddress = emailState.generatedEmail || user?.ieeeEmail;
		if (!ieeeEmailAddress || !customPassword.trim()) {
			setEmailState((prev) => ({
				...prev,
				error: "Email and password required",
			}));
			return;
		}

		const validation = validatePassword(customPassword);
		if (!validation.isValid) {
			setEmailState((prev) => ({
				...prev,
				error: "Password does not meet requirements.",
			}));
			return;
		}

		setEmailState((prev) => ({
			...prev,
			isResetting: true,
			error: null,
			success: null,
		}));

		try {
			const response = await fetch("/api/reset-email-password", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({
					email: ieeeEmailAddress,
					password: customPassword,
				}),
			});

			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);
			const result = await response.json();

			if (result.success) {
				setEmailState((prev) => ({
					...prev,
					isResetting: false,
					success: result.message,
				}));
				toast.success("Password reset successfully!");
				setCustomPassword("");
			} else {
				setEmailState((prev) => ({
					...prev,
					isResetting: false,
					error: result.message || "Failed to reset password",
				}));
			}
		} catch (error) {
			console.error("Error resetting password:", error);
			setEmailState((prev) => ({
				...prev,
				isResetting: false,
				error:
					error instanceof Error ? error.message : "Failed to reset password.",
			}));
		}
	};

	const authenticateInbox = async () => {
		const ieeeEmailAddress = emailState.generatedEmail || user?.ieeeEmail;
		if (!ieeeEmailAddress || !inboxPassword.trim()) {
			setInboxState((prev) => ({ ...prev, error: "Credentials required" }));
			return;
		}

		setInboxState((prev) => ({ ...prev, isLoading: true, error: null }));

		try {
			const response = await fetch("/api/ieee-email/fetch-emails", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({
					email: ieeeEmailAddress,
					password: inboxPassword,
				}),
			});

			const result = await response.json();

			if (result.success) {
				setCurrentPage(1);
				setInboxState((prev) => ({
					...prev,
					isLoading: false,
					isAuthenticated: true,
					emails: result.emails || [],
					credentials: { email: ieeeEmailAddress, password: inboxPassword },
				}));
				setInboxPassword("");
				toast.success("Inbox authenticated successfully!");
			} else {
				const errorMessage = result.message || "Failed to authenticate";
				const isAuthError =
					errorMessage.toLowerCase().includes("password") ||
					errorMessage.toLowerCase().includes("login");
				setInboxState((prev) => ({
					...prev,
					isLoading: false,
					error: isAuthError
						? "Login failed. Check password."
						: "Connection failed.",
				}));
			}
		} catch (error) {
			console.error("Error authenticating inbox:", error);
			setInboxState((prev) => ({
				...prev,
				isLoading: false,
				error: "Connection failed.",
			}));
		}
	};

	const refreshInbox = async () => {
		if (!inboxState.isAuthenticated || !inboxState.credentials) return;
		setInboxState((prev) => ({ ...prev, isRefreshing: true, error: null }));

		try {
			const response = await fetch("/api/ieee-email/fetch-emails", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify(inboxState.credentials),
			});

			const result = await response.json();
			if (result.success) {
				setCurrentPage(1);
				setInboxState((prev) => ({
					...prev,
					isRefreshing: false,
					emails: result.emails || [],
				}));
				toast.success("Inbox refreshed!");
			} else {
				setInboxState((prev) => ({
					...prev,
					isRefreshing: false,
					error: "Failed to refresh.",
				}));
			}
		} catch (_error) {
			setInboxState((prev) => ({
				...prev,
				isRefreshing: false,
				error: "Failed to refresh.",
			}));
		}
	};

	const copyEmail = () => {
		if (ieeeEmail) {
			navigator.clipboard.writeText(ieeeEmail);
			toast.success("Email copied to clipboard");
		}
	};

	return (
		<DashboardPage>
			<PageHeader
				hideTitleOnMobile
				title="Slack Access"
				description="Create your IEEE email and join the IEEE UCSD Slack workspace."
			/>
			<main className="space-y-8">
				<section>
					<h2 className="mb-3 text-sm font-semibold">How to join</h2>
					<ol className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
						{[
							{
								n: 1,
								t: "Create your email",
								d: "Set a password and generate it below.",
							},
							{
								n: 2,
								t: "Sign up",
								d: (
									<>
										Use your{" "}
										<span className="font-medium text-foreground">
											@{IEEE_EMAIL_DOMAIN}
										</span>{" "}
										email on the Slack sign-up page, not your personal one.
									</>
								),
							},
							{
								n: 3,
								t: "Verify",
								d: "Read your code in the inbox here.",
							},
							{
								n: 4,
								t: "Join",
								d: "Finish setup and join channels.",
							},
						].map((step) => (
							<li key={step.n} className="border-t pt-3">
								<p className="text-xs tabular-nums text-muted-foreground">
									Step {step.n}
								</p>
								<p className="mt-0.5 text-sm font-medium">{step.t}</p>
								<p className="text-sm text-muted-foreground">{step.d}</p>
							</li>
						))}
					</ol>
				</section>

				<section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					{/* Account */}
					<div className="flex flex-col overflow-hidden rounded-md border lg:col-span-5">
						<header className="border-b px-5 py-4">
							<h2 className="text-base font-semibold">
								{hasIEEEEmail ? "Your IEEE email" : "Create your IEEE email"}
							</h2>
							<p className="mt-0.5 text-sm text-muted-foreground">
								{hasIEEEEmail
									? "Manage your IEEE account credentials."
									: `Create your @${IEEE_EMAIL_DOMAIN} account for Slack.`}
							</p>
						</header>

						<dl className="divide-y border-b text-sm">
							<div className="flex items-center justify-between gap-4 px-5 py-3">
								<dt className="shrink-0 text-muted-foreground">Personal</dt>
								<dd
									className="min-w-0 truncate font-medium"
									title={user?.email}
								>
									{user?.email}
								</dd>
							</div>
							<div className="flex items-center justify-between gap-4 px-5 py-3">
								<dt className="shrink-0 text-muted-foreground">IEEE email</dt>
								{hasIEEEEmail || ieeeEmail ? (
									<dd className="flex min-w-0 items-center gap-1 font-medium">
										<span
											className="min-w-0 truncate"
											title={ieeeEmail ?? undefined}
										>
											{ieeeEmail}
										</span>
										<Button
											variant="ghost"
											size="icon"
											aria-label="Copy IEEE email"
											onClick={copyEmail}
											className="-my-2 text-muted-foreground hover:text-foreground"
											type="button"
										>
											<Copy className="h-3.5 w-3.5" />
										</Button>
									</dd>
								) : (
									<dd className="text-muted-foreground">Not created yet</dd>
								)}
							</div>
						</dl>

						<div className="space-y-4 px-5 py-5">
							<div className="space-y-1.5">
								<Label
									htmlFor={passwordInputId}
									className="text-sm font-medium"
								>
									{hasIEEEEmail ? "New password" : "Password"}
								</Label>
								<div className="relative">
									<Input
										id={passwordInputId}
										type={showPassword ? "text" : "password"}
										placeholder={
											hasIEEEEmail
												? "Enter new password"
												: "Create a secure password"
										}
										value={customPassword}
										onChange={(e) => setCustomPassword(e.target.value)}
										onKeyDown={handleIEEEPasswordKeyDown}
										disabled={hasIEEEEmail && !canResetPassword}
										className="h-11 pr-12 text-base md:h-10 md:text-sm"
										autoComplete="new-password"
										autoCapitalize="off"
										autoCorrect="off"
										spellCheck={false}
										enterKeyHint="done"
									/>
									<Button
										variant="ghost"
										size="icon"
										aria-label={
											showPassword ? "Hide password" : "Show password"
										}
										className="absolute right-1 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										onClick={() => setShowPassword(!showPassword)}
										type="button"
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</Button>
								</div>
								{customPassword && (
									<PasswordStrengthIndicator validation={passwordValidation} />
								)}
							</div>

							{hasIEEEEmail ? (
								canResetPassword ? (
									<Button
										onClick={resetEmailPassword}
										disabled={
											!customPassword.trim() ||
											!passwordValidation.isValid ||
											emailState.isResetting
										}
										className="h-11 w-full md:h-10"
									>
										{emailState.isResetting ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="mr-2 h-4 w-4" />
										)}
										Reset password
									</Button>
								) : (
									<p className="text-sm text-muted-foreground">
										Password reset is only available to officers and admins.
									</p>
								)
							) : (
								<Button
									onClick={generateIEEEEmail}
									disabled={
										!customPassword.trim() ||
										!passwordValidation.isValid ||
										emailState.isGenerating
									}
									className="h-11 w-full md:h-10"
								>
									{emailState.isGenerating ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Mail className="mr-2 h-4 w-4" />
									)}
									Generate email
								</Button>
							)}

							{emailState.success && (
								<p className="flex items-center gap-2 text-sm text-tone-success">
									<CheckCircle className="h-4 w-4 shrink-0" />
									{emailState.success}
								</p>
							)}
							{emailState.error && (
								<p className="flex items-center gap-2 text-sm text-tone-danger">
									<AlertCircle className="h-4 w-4 shrink-0" />
									{emailState.error}
								</p>
							)}
						</div>

						<footer className="mt-auto space-y-2 border-t bg-muted/30 px-5 py-4 text-sm">
							<p className="flex flex-wrap items-center gap-x-2">
								<span className="text-muted-foreground">Workspace</span>
								<a
									href="https://ieeeucsdofficers.slack.com"
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 font-medium text-tone-link hover:underline"
								>
									ieeeucsdofficers.slack.com
									<ExternalLink className="h-3 w-3" />
								</a>
							</p>
							<p className="text-xs leading-relaxed text-muted-foreground">
								This account is for Slack authentication only. Don't use it for
								external communication.
							</p>
						</footer>
					</div>

					{/* Inbox */}
					<div className="flex h-[600px] flex-col overflow-hidden rounded-md border lg:col-span-7">
						<header className="flex items-center justify-between gap-3 border-b px-5 py-4">
							<div>
								<h2 className="text-base font-semibold">Inbox</h2>
								<p className="mt-0.5 text-sm text-muted-foreground">
									Verification codes and account updates.
								</p>
							</div>
							{inboxState.isAuthenticated && (
								<Button
									variant="ghost"
									size="icon"
									onClick={refreshInbox}
									disabled={inboxState.isRefreshing}
									aria-label="Refresh inbox"
									className="text-muted-foreground hover:text-foreground"
								>
									{inboxState.isRefreshing ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<RefreshCw className="h-4 w-4" />
									)}
								</Button>
							)}
						</header>

						<div className="flex min-h-0 flex-1 flex-col">
							{!ieeeEmail ? (
								<div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
									<p className="text-sm font-medium">No inbox yet</p>
									<p className="mt-1 max-w-xs text-sm text-muted-foreground">
										Create your IEEE email first, then your messages will show
										up here.
									</p>
								</div>
							) : !inboxState.isAuthenticated ? (
								<div className="flex flex-1 items-center justify-center px-6">
									<div className="w-full max-w-[320px] space-y-4">
										<div className="text-center">
											<h3 className="text-base font-semibold">
												Sign in to inbox
											</h3>
											<p className="mt-0.5 break-all text-sm text-muted-foreground">
												{ieeeEmail}
											</p>
										</div>
										<div className="space-y-2">
											<div className="relative">
												<Input
													type={showInboxPassword ? "text" : "password"}
													placeholder="Email password"
													aria-label="Email password"
													value={inboxPassword}
													onChange={(e) => setInboxPassword(e.target.value)}
													onKeyDown={handleInboxPasswordKeyDown}
													className="h-11 pr-12 text-base md:h-10 md:text-sm"
													autoComplete="current-password"
													autoCapitalize="off"
													autoCorrect="off"
													spellCheck={false}
													enterKeyHint="go"
												/>
												<Button
													variant="ghost"
													size="icon"
													aria-label={
														showInboxPassword
															? "Hide password"
															: "Show password"
													}
													className="absolute right-1 top-1/2 size-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
													onClick={() =>
														setShowInboxPassword(!showInboxPassword)
													}
													type="button"
												>
													{showInboxPassword ? (
														<EyeOff className="h-4 w-4" />
													) : (
														<Eye className="h-4 w-4" />
													)}
												</Button>
											</div>
											<Button
												onClick={authenticateInbox}
												disabled={!inboxPassword.trim() || inboxState.isLoading}
												className="h-11 w-full md:h-10"
											>
												{inboxState.isLoading ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													"Open inbox"
												)}
											</Button>
										</div>
									</div>
								</div>
							) : (
								<>
									<div className="min-h-0 flex-1 overflow-y-auto">
										{inboxState.emails.length === 0 ? (
											<div className="flex h-full flex-col items-center justify-center text-muted-foreground">
												<p className="text-sm">Your inbox is empty</p>
											</div>
										) : (
											<ul className="divide-y">
												{getPaginatedEmails().map((email) => {
													const isSlackRelated =
														email.subject.toLowerCase().includes("slack") ||
														email.from.toLowerCase().includes("slack");
													return (
														<li key={email.id}>
															<button
																onClick={() => setSelectedEmail(email)}
																type="button"
																className="flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
															>
																<span
																	aria-hidden
																	className={`mt-1.5 size-2 shrink-0 rounded-full ${
																		email.isRead
																			? "bg-transparent"
																			: "bg-ds-blue-700"
																	}`}
																/>
																<span className="min-w-0 flex-1">
																	<span className="flex items-baseline justify-between gap-3">
																		<span
																			className={`truncate text-sm ${
																				email.isRead
																					? "text-muted-foreground"
																					: "font-semibold text-foreground"
																			}`}
																		>
																			{parseSender(email.from).name}
																		</span>
																		<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
																			{email.date}
																		</span>
																	</span>
																	<span
																		className={`block truncate text-sm ${
																			email.isRead
																				? "text-muted-foreground"
																				: "font-medium text-foreground"
																		}`}
																	>
																		{email.subject || "(No subject)"}
																		{isSlackRelated && (
																			<span className="ml-2 text-xs font-normal text-tone-link">
																				Slack
																			</span>
																		)}
																	</span>
																	<span className="block truncate text-xs text-muted-foreground">
																		{email.preview}
																	</span>
																</span>
															</button>
														</li>
													);
												})}
											</ul>
										)}
									</div>

									{Math.ceil(inboxState.emails.length / emailsPerPage) > 1 && (
										<div className="flex justify-center gap-1 border-t px-3 py-2">
											{Array.from(
												{
													length: Math.ceil(
														inboxState.emails.length / emailsPerPage,
													),
												},
												(_, i) => i + 1,
											).map((page) => (
												<Button
													key={page}
													variant={currentPage === page ? "default" : "ghost"}
													size="sm"
													onClick={() => setCurrentPage(page)}
													className="h-7 w-7 p-0 text-xs"
												>
													{page}
												</Button>
											))}
										</div>
									)}
								</>
							)}
							{inboxState.error && (
								<p className="border-t px-5 py-3 text-sm text-tone-danger">
									{inboxState.error}
								</p>
							)}
						</div>
					</div>
				</section>
			</main>

			{selectedEmail && (
				<EmailModal
					email={selectedEmail}
					credentials={inboxState.credentials}
					onClose={() => setSelectedEmail(null)}
				/>
			)}
		</DashboardPage>
	);
}
