import { createFileRoute } from "@tanstack/react-router";
import { useState, useId } from "react";
import {
  Mail,
  Key,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Loader2,
  MessageSquare,
  Shield,
  RefreshCw,
  Inbox,
  ExternalLink,
  Copy,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PasswordStrengthIndicator } from "@/components/dashboard/slack-access/PasswordStrengthIndicator";
import { EmailModal } from "@/components/dashboard/slack-access/EmailModal";
import type { EmailMessage, EmailInboxState, EmailGenerationState, PasswordValidation } from "@/components/dashboard/slack-access/types";

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
  const canResetPassword = user?.role && ["General Officer", "Executive Officer", "Past Officer", "Administrator"].includes(user?.role);

  const extractUsername = (email: string): string => {
    return email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
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
        if (!emailState.isResetting && customPassword.trim() && passwordValidation.isValid) {
          resetEmailPassword();
        }
      } else {
        if (!emailState.isGenerating && customPassword.trim() && passwordValidation.isValid) {
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
      setEmailState((prev) => ({ ...prev, error: "User authentication required" }));
      return;
    }

    if (!user.email || !user.email.includes("@")) {
      setEmailState((prev) => ({ ...prev, error: "Invalid user email format" }));
      return;
    }

    if (!customPassword.trim()) {
      setEmailState((prev) => ({ ...prev, error: "Password is required" }));
      return;
    }

    const validation = validatePassword(customPassword);
    if (!validation.isValid) {
      setEmailState((prev) => ({ ...prev, error: "Password does not meet requirements." }));
      return;
    }

    setEmailState((prev) => ({ ...prev, isGenerating: true, error: null, success: null }));

    try {
      const username = extractUsername(user.email);
      const proposedEmail = `${username}@ieeeatucsd.org`;

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

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
        error: error instanceof Error ? error.message : "Failed to create IEEE email.",
      }));
    }
  };

  const resetEmailPassword = async () => {
    const ieeeEmailAddress = emailState.generatedEmail || user?.ieeeEmail;
    if (!ieeeEmailAddress || !customPassword.trim()) {
      setEmailState((prev) => ({ ...prev, error: "Email and password required" }));
      return;
    }

    const validation = validatePassword(customPassword);
    if (!validation.isValid) {
      setEmailState((prev) => ({ ...prev, error: "Password does not meet requirements." }));
      return;
    }

    setEmailState((prev) => ({ ...prev, isResetting: true, error: null, success: null }));

    try {
      const response = await fetch("/api/reset-email-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email: ieeeEmailAddress, password: customPassword }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
        error: error instanceof Error ? error.message : "Failed to reset password.",
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
        body: JSON.stringify({ email: ieeeEmailAddress, password: inboxPassword }),
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
        const isAuthError = errorMessage.toLowerCase().includes("password") || errorMessage.toLowerCase().includes("login");
        setInboxState((prev) => ({
          ...prev,
          isLoading: false,
          error: isAuthError ? "Login failed. Check password." : "Connection failed.",
        }));
      }
    } catch (error) {
      console.error("Error authenticating inbox:", error);
      setInboxState((prev) => ({ ...prev, isLoading: false, error: "Connection failed." }));
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
        setInboxState((prev) => ({ ...prev, isRefreshing: false, emails: result.emails || [] }));
        toast.success("Inbox refreshed!");
      } else {
        setInboxState((prev) => ({ ...prev, isRefreshing: false, error: "Failed to refresh." }));
      }
    } catch (_error) {
      setInboxState((prev) => ({ ...prev, isRefreshing: false, error: "Failed to refresh." }));
    }
  };

  const copyEmail = () => {
    if (ieeeEmail) {
      navigator.clipboard.writeText(ieeeEmail);
      toast.success("Email copied to clipboard");
    }
  };

  return (
    <div className="w-full">
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-6">
        <section className="rounded-xl border bg-muted/20 p-4">
          <h3 className="mb-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">How to Join</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[{ n: 1, t: "Create Email", d: "Generate your IEEE email above." }, { n: 2, t: "Sign Up", d: "Use it on the Slack sign-up page." }, { n: 3, t: "Verify", d: "Check this inbox for your code." }, { n: 4, t: "Join", d: "Finish setup and join channels." }].map((s) => (
              <div key={s.n} className="flex items-start gap-2 rounded-md border bg-card p-2.5">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{s.n}</div>
                <div>
                  <div className="text-xs font-semibold">{s.t}</div>
                  <div className="text-[11px] text-muted-foreground">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-xl border bg-card p-5 shadow-sm lg:col-span-5">
            <div className="mb-4 flex items-center gap-3 border-b pb-3">
              <div className="rounded-lg bg-blue-50 p-2">
                <Mail className="h-5 w-5 text-ieee-blue" />
              </div>
              <div>
                <h2 className="text-base font-semibold">
                  {hasIEEEEmail ? "Email Management" : "Create Email"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {hasIEEEEmail ? "Manage your IEEE account credentials." : "Create your @ieeeatucsd.org account."}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="grid grid-cols-[92px_1fr] items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Personal</span>
                  <span className="truncate font-medium" title={user?.email}>{user?.email}</span>
                </div>
                <div className="grid grid-cols-[92px_1fr] items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">IEEE Email</span>
                  {hasIEEEEmail || ieeeEmail ? (
                    <span className="flex items-center gap-1.5 truncate font-medium text-ieee-blue">
                      {ieeeEmail}
                      <button onClick={copyEmail} className="text-muted-foreground hover:text-foreground" type="button">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">Not created yet</span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={passwordInputId} className="text-xs font-medium">
                    {hasIEEEEmail ? "New Password (Reset)" : "Create Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      id={passwordInputId}
                      type={showPassword ? "text" : "password"}
                      placeholder={hasIEEEEmail ? "Enter new password" : "Create secure password"}
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      onKeyDown={handleIEEEPasswordKeyDown}
                      disabled={hasIEEEEmail && !canResetPassword}
                      className="h-10 pr-9 text-sm"
                    />
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {customPassword && <PasswordStrengthIndicator validation={passwordValidation} />}
                </div>

                {hasIEEEEmail ? (
                  canResetPassword ? (
                    <Button
                      onClick={resetEmailPassword}
                      disabled={!customPassword.trim() || !passwordValidation.isValid || emailState.isResetting}
                      className="h-10 w-full bg-ieee-blue text-sm text-white hover:bg-ieee-blue-light"
                    >
                      {emailState.isResetting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Reset Password
                    </Button>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
                      Password reset is only available to officers and admins.
                    </div>
                  )
                ) : (
                  <Button
                    onClick={generateIEEEEmail}
                    disabled={!customPassword.trim() || !passwordValidation.isValid || emailState.isGenerating}
                    className="h-10 w-full bg-ieee-blue text-sm text-white hover:bg-ieee-blue-light"
                  >
                    {emailState.isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Generate Email
                  </Button>
                )}

                {emailState.success && (
                  <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-2.5 text-xs text-green-700">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {emailState.success}
                  </div>
                )}
                {emailState.error && (
                  <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {emailState.error}
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="rounded-lg border bg-indigo-50/40 p-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-indigo-100 p-2">
                      <MessageSquare className="h-4 w-4 text-indigo-700" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold">Slack Workspace</h3>
                      <a
                        href="https://ieeeucsdofficers.slack.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-ieee-blue hover:underline"
                      >
                        ieeeucsdofficers.slack.com
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <p className="text-xs text-muted-foreground">
                        Use this IEEE email for workspace access and account verification.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2.5">
                    <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-amber-900">Access Restriction</p>
                      <p className="text-xs text-amber-800">
                        This account is for Slack authentication only.
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-900">
                        <Info className="h-3.5 w-3.5" />
                        Do not use for external communication.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-[560px] flex-col rounded-xl border bg-card p-5 shadow-sm lg:col-span-7">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-purple-50 p-2">
                  <Inbox className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Inbox</h2>
                  <p className="text-xs text-muted-foreground">Verification codes and account updates.</p>
                </div>
              </div>
              {inboxState.isAuthenticated && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshInbox}
                  disabled={inboxState.isRefreshing}
                  className="h-8 w-8 p-0"
                >
                  {inboxState.isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-purple-600" />
                  )}
                </Button>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {!ieeeEmail ? (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground/60">
                  <Mail className="mb-3 h-10 w-10 opacity-20" />
                  <p className="text-sm">Create an IEEE email first to access inbox messages.</p>
                </div>
              ) : !inboxState.isAuthenticated ? (
                <div className="flex flex-1 items-center justify-center p-6">
                  <div className="w-full max-w-[300px] space-y-4 rounded-lg border bg-muted/20 p-4">
                    <div className="text-center">
                      <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-purple-100">
                        <Key className="h-5 w-5 text-purple-600" />
                      </div>
                      <h3 className="text-sm font-semibold">Login to Inbox</h3>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{ieeeEmail}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          type={showInboxPassword ? "text" : "password"}
                          placeholder="Enter email password"
                          value={inboxPassword}
                          onChange={(e) => setInboxPassword(e.target.value)}
                          onKeyDown={handleInboxPasswordKeyDown}
                          className="h-10 pr-9 text-sm"
                        />
                        <button
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowInboxPassword(!showInboxPassword)}
                          type="button"
                        >
                          {showInboxPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={authenticateInbox}
                        disabled={!inboxPassword.trim() || inboxState.isLoading}
                        className="h-10 w-full bg-purple-600 text-sm text-white hover:bg-purple-700"
                      >
                        {inboxState.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Access Inbox"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    {inboxState.emails.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                        <p className="text-sm">Inbox is empty</p>
                      </div>
                    ) : (
                      getPaginatedEmails().map((email) => {
                        const isSlackRelated = email.subject.toLowerCase().includes("slack") || email.from.toLowerCase().includes("slack");
                        return (
                          <button
                            key={email.id}
                            onClick={() => setSelectedEmail(email)}
                            type="button"
                            className={`group cursor-pointer rounded-lg border p-3 transition-colors hover:shadow-sm ${
                              email.isRead ? "border-border bg-card hover:border-purple-300" : "border-purple-100 bg-purple-50/60"
                            }`}
                          >
                            <div className="mb-1 flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                {!email.isRead && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-purple-500" />}
                                {isSlackRelated && (
                                  <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                                    Slack
                                  </span>
                                )}
                                <h4 className={`truncate text-xs ${!email.isRead ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>
                                  {email.subject || "(No Subject)"}
                                </h4>
                              </div>
                              <span className="whitespace-nowrap text-[10px] text-muted-foreground">{email.date}</span>
                            </div>
                            <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">{email.from}</span>
                              <span className="mx-1 text-border">|</span>
                              <span className="truncate opacity-80">{email.preview}</span>
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {Math.ceil(inboxState.emails.length / emailsPerPage) > 1 && (
                    <div className="mt-2 flex justify-center gap-1 border-t pt-2">
                      {Array.from({ length: Math.ceil(inboxState.emails.length / emailsPerPage) }, (_, i) => i + 1).map((page) => (
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
                <div className="mt-2 flex items-center justify-center border-t border-red-200 bg-red-50 p-2.5 text-xs text-red-600">
                  {inboxState.error}
                </div>
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
    </div>
  );
}
