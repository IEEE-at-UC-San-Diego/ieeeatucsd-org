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
import { useId, useReducer, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import {
	EmailModal,
	parseSender,
} from "@/components/dashboard/slack-access/EmailModal";
import {
	emailGenerationReducer,
	initialEmailGenerationState,
} from "@/components/dashboard/slack-access/emailGenerationState";
import {
	emailInboxReducer,
	initialEmailInboxState,
} from "@/components/dashboard/slack-access/emailInboxState";
import { PasswordStrengthIndicator } from "@/components/dashboard/slack-access/PasswordStrengthIndicator";
import type {
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

const searchSchema = z.object({
	inboxPage: z.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute("/_dashboard/slack-access")({
	validateSearch: searchSchema,
	component: SlackAccessPage,
});

function SlackAccessPage() {
	const { user, getAuthHeaders } = useAuth();
	const passwordInputId = useId();

	const [showPassword, setShowPassword] = useState(false);
	const [customPassword, setCustomPassword] = useState("");

	const [showInboxPassword, setShowInboxPassword] = useState(false);
	const [inboxPassword, setInboxPassword] = useState("");

	const { inboxPage } = Route.useSearch();
	const navigate = Route.useNavigate();
	const setCurrentPage = (page: number) =>
		navigate({
			search: (prev) => ({ ...prev, inboxPage: page }),
			replace: true,
		});
	const emailsPerPage = 10;

	const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
	const [emailState, dispatchEmail] = useReducer(
		emailGenerationReducer,
		initialEmailGenerationState,
	);
	const [inboxState, dispatchInbox] = useReducer(
		emailInboxReducer,
		initialEmailInboxState,
	);
	const isGenerating = emailState.status === "generating";
	const isResetting = emailState.status === "resetting";
	const emailNotice = emailState.status === "idle" ? emailState.notice : null;
	const inboxEmails = inboxState.status === "signedIn" ? inboxState.emails : [];
	const inboxError =
		inboxState.status === "failed"
			? inboxState.message
			: inboxState.status === "signedIn"
				? inboxState.refreshError
				: null;

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
					!isResetting &&
					customPassword.trim() &&
					passwordValidation.isValid
				) {
					resetEmailPassword();
				}
			} else {
				if (
					!isGenerating &&
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
			if (inboxState.status !== "signingIn" && inboxPassword.trim()) {
				authenticateInbox();
			}
		}
	};

	const inboxTotalPages = Math.max(
		1,
		Math.ceil(inboxEmails.length / emailsPerPage),
	);
	const currentPage = Math.min(inboxPage, inboxTotalPages);

	const getPaginatedEmails = () => {
		const startIndex = (currentPage - 1) * emailsPerPage;
		const endIndex = startIndex + emailsPerPage;
		return inboxEmails.slice(startIndex, endIndex);
	};

	const generateIEEEEmail = async () => {
		if (emailState.status !== "idle") return;

		if (!user) {
			dispatchEmail({
				type: "rejected",
				message: "You’re signed out. Sign in again to continue.",
			});
			return;
		}

		if (!user.email || !user.email.includes("@")) {
			dispatchEmail({
				type: "rejected",
				message:
					"Your account email looks invalid. Contact webmaster@ieeeatucsd.org for help.",
			});
			return;
		}

		if (!customPassword.trim()) {
			dispatchEmail({
				type: "rejected",
				message: "Enter a password to continue.",
			});
			return;
		}

		const validation = validatePassword(customPassword);
		if (!validation.isValid) {
			dispatchEmail({
				type: "rejected",
				message:
					"Password doesn’t meet the requirements below. Update it and try again.",
			});
			return;
		}

		dispatchEmail({ type: "generateStarted" });

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
					dispatchEmail({
						type: "failed",
						message: `Email ${proposedEmail} already exists. Please contact webmaster@ieeeatucsd.org.`,
					});
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
				dispatchEmail({ type: "generateSucceeded", email: result.ieeeEmail });
				toast.success("IEEE email created successfully!");
				setCustomPassword("");
			} else {
				dispatchEmail({
					type: "failed",
					message:
						result.message ||
						"Failed to create IEEE email. Try again or contact webmaster@ieeeatucsd.org.",
				});
			}
		} catch (error) {
			console.error("Error creating IEEE email:", error);
			dispatchEmail({
				type: "failed",
				message:
					error instanceof Error
						? error.message
						: "Failed to create IEEE email. Try again or contact webmaster@ieeeatucsd.org.",
			});
		}
	};

	const resetEmailPassword = async () => {
		if (emailState.status !== "idle") return;

		const ieeeEmailAddress = emailState.generatedEmail || user?.ieeeEmail;
		if (!ieeeEmailAddress || !customPassword.trim()) {
			dispatchEmail({
				type: "rejected",
				message: "Enter a new password to continue.",
			});
			return;
		}

		const validation = validatePassword(customPassword);
		if (!validation.isValid) {
			dispatchEmail({
				type: "rejected",
				message:
					"Password doesn’t meet the requirements below. Update it and try again.",
			});
			return;
		}

		dispatchEmail({ type: "resetStarted" });

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
				dispatchEmail({ type: "resetSucceeded", message: result.message });
				toast.success("Password reset successfully!");
				setCustomPassword("");
			} else {
				dispatchEmail({
					type: "failed",
					message:
						result.message ||
						"Failed to reset password. Try again or contact webmaster@ieeeatucsd.org.",
				});
			}
		} catch (error) {
			console.error("Error resetting password:", error);
			dispatchEmail({
				type: "failed",
				message:
					error instanceof Error
						? error.message
						: "Failed to reset password. Try again or contact webmaster@ieeeatucsd.org.",
			});
		}
	};

	const authenticateInbox = async () => {
		if (inboxState.status === "signingIn" || inboxState.status === "signedIn")
			return;

		const ieeeEmailAddress = emailState.generatedEmail || user?.ieeeEmail;
		if (!ieeeEmailAddress || !inboxPassword.trim()) {
			dispatchInbox({
				type: "signInFailed",
				message: "Enter your email password to open the inbox.",
			});
			return;
		}

		dispatchInbox({ type: "signInStarted" });

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
				dispatchInbox({
					type: "signInSucceeded",
					credentials: { email: ieeeEmailAddress, password: inboxPassword },
					emails: result.emails || [],
				});
				setInboxPassword("");
				toast.success("Inbox authenticated successfully!");
			} else {
				const errorMessage = result.message || "Failed to authenticate";
				const isAuthError =
					errorMessage.toLowerCase().includes("password") ||
					errorMessage.toLowerCase().includes("login");
				dispatchInbox({
					type: "signInFailed",
					message: isAuthError
						? "Login failed. Check your email password and try again."
						: "Connection failed. Check your connection and try again.",
				});
			}
		} catch (error) {
			console.error("Error authenticating inbox:", error);
			dispatchInbox({
				type: "signInFailed",
				message: "Connection failed. Check your connection and try again.",
			});
		}
	};

	const refreshInbox = async () => {
		if (inboxState.status !== "signedIn" || inboxState.refreshing) return;
		dispatchInbox({ type: "refreshStarted" });

		try {
			const response = await fetch("/api/ieee-email/fetch-emails", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify(inboxState.credentials),
			});

			const result = await response.json();
			if (result.success) {
				setCurrentPage(1);
				dispatchInbox({
					type: "refreshSucceeded",
					emails: result.emails || [],
				});
				toast.success("Inbox refreshed!");
			} else {
				dispatchInbox({
					type: "refreshFailed",
					message: "Failed to refresh. Check your connection and try again.",
				});
			}
		} catch (_error) {
			dispatchInbox({
				type: "refreshFailed",
				message: "Failed to refresh. Check your connection and try again.",
			});
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
					<h2 className="mb-3 text-balance text-sm font-semibold">
						How to Join
					</h2>
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
							<h2 className="text-balance text-base font-semibold">
								{hasIEEEEmail ? "Your IEEE Email" : "Create Your IEEE Email"}
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
										name="password"
										type={showPassword ? "text" : "password"}
										placeholder={
											hasIEEEEmail
												? "Enter new password…"
												: "Create a secure password…"
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
											emailState.status !== "idle"
										}
										className="h-11 w-full md:h-10"
									>
										{isResetting ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="mr-2 h-4 w-4" />
										)}
										Reset Password
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
										emailState.status !== "idle"
									}
									className="h-11 w-full md:h-10"
								>
									{isGenerating ? (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									) : (
										<Mail className="mr-2 h-4 w-4" />
									)}
									Generate Email
								</Button>
							)}

							{emailNotice?.kind === "success" && (
								<output
									aria-live="polite"
									className="flex items-center gap-2 break-words text-sm text-tone-success"
								>
									<CheckCircle className="h-4 w-4 shrink-0" />
									{emailNotice.message}
								</output>
							)}
							{emailNotice?.kind === "error" && (
								<p
									role="alert"
									className="flex items-center gap-2 break-words text-sm text-tone-danger"
								>
									<AlertCircle className="h-4 w-4 shrink-0" />
									{emailNotice.message}
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
									<span className="sr-only">(opens in new tab)</span>
								</a>
							</p>
							<p className="text-xs leading-relaxed text-muted-foreground">
								This account is for Slack authentication only. Don’t use it for
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
							{inboxState.status === "signedIn" && (
								<Button
									variant="ghost"
									size="icon"
									onClick={refreshInbox}
									disabled={inboxState.refreshing}
									aria-label="Refresh inbox"
									className="text-muted-foreground hover:text-foreground"
								>
									{inboxState.refreshing ? (
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
									<p className="text-sm font-medium">No Inbox Yet</p>
									<p className="mt-1 max-w-xs text-sm text-muted-foreground">
										Create your IEEE email first, then your messages will show
										up here.
									</p>
								</div>
							) : inboxState.status !== "signedIn" ? (
								<div className="flex flex-1 items-center justify-center px-6">
									<div className="w-full max-w-[320px] space-y-4">
										<div className="text-center">
											<h3 className="text-balance text-base font-semibold">
												Sign In to Inbox
											</h3>
											<p className="mt-0.5 break-all text-sm text-muted-foreground">
												{ieeeEmail}
											</p>
										</div>
										<div className="space-y-2">
											<div className="relative">
												<Input
													type={showInboxPassword ? "text" : "password"}
													name="inbox-password"
													placeholder="Email password…"
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
												disabled={
													!inboxPassword.trim() ||
													inboxState.status === "signingIn"
												}
												className="h-11 w-full md:h-10"
											>
												{inboxState.status === "signingIn" ? (
													<>
														<Loader2 className="h-4 w-4 animate-spin" />
														<span className="sr-only">Opening Inbox…</span>
													</>
												) : (
													"Open Inbox"
												)}
											</Button>
										</div>
									</div>
								</div>
							) : (
								<>
									<div className="min-h-0 flex-1 overflow-y-auto">
										{inboxEmails.length === 0 ? (
											<div className="flex h-full flex-col items-center justify-center text-muted-foreground">
												<p className="text-sm">Your inbox is empty.</p>
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
																		{email.subject || "(No Subject)"}
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
													aria-label={`Inbox page ${page}`}
													aria-current={
														currentPage === page ? "page" : undefined
													}
													className="h-7 w-7 p-0 text-xs tabular-nums"
												>
													{page}
												</Button>
											))}
										</div>
									)}
								</>
							)}
							{inboxError && (
								<p
									role="alert"
									className="border-t px-5 py-3 text-sm text-tone-danger"
								>
									{inboxError}
								</p>
							)}
						</div>
					</div>
				</section>
			</main>

			{selectedEmail && (
				<EmailModal
					email={selectedEmail}
					credentials={
						inboxState.status === "signedIn" ? inboxState.credentials : null
					}
					onClose={() => setSelectedEmail(null)}
				/>
			)}
		</DashboardPage>
	);
}
