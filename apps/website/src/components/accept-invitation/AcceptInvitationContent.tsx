import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  Mail,
  User,
  Briefcase,
} from "lucide-react";

const DASHBOARD_API_PATH = "/api/onboarding/accept-invitation";

const getDashboardApiBaseUrl = () => {
  const envBaseUrl = import.meta.env.PUBLIC_DASHBOARD_URL?.trim();
  if (envBaseUrl) {
    return envBaseUrl.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return window.location.origin.replace(/\/$/, "");
  }

  return "";
};

const getAcceptInvitationEndpoint = () => {
  const baseUrl = getDashboardApiBaseUrl();
  return baseUrl ? `${baseUrl}${DASHBOARD_API_PATH}` : DASHBOARD_API_PATH;
};

interface AcceptInvitationContentProps {
  inviteId: string;
}

type Invitation = {
  name: string;
  email: string;
  role: string;
  position: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt: number;
  message?: string;
  acceptanceDeadline?: string;
};

export default function AcceptInvitationContent({
  inviteId,
}: AcceptInvitationContentProps) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    fetchInvitation();
  }, [inviteId]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);
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

      const data = result.invitation as Invitation;
      setInvitation(data);

      // Check if already accepted/declined
      if (data.status === "accepted") {
        setSuccess(true);
      } else if (data.status === "declined") {
        setDeclined(true);
      } else if (data.status === "expired") {
        setError("This invitation has expired.");
      }

      // Check if expired
      const expiresAt = new Date(data.expiresAt);
      if (new Date() > expiresAt && data.status === "pending") {
        setError("This invitation has expired.");
      }
    } catch (err) {
      console.error("Error fetching invitation:", err);
      setError("Failed to load invitation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to accept invitation");
      }

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

  const handleDecline = async () => {
    if (!confirm("Are you sure you want to decline this position?")) {
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
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-ieee-blue-100" />
          <p className="text-white/60">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="surface w-full max-w-md p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-14 w-14 text-ieee-yellow" />
          <h2 className="title-3 text-white">Oops!</h2>
          <p className="copy mt-2">{error}</p>
          <div className="mt-6 flex justify-center">
            <a href="/" className="ieee-btn ieee-btn-primary">
              Go to Homepage
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="surface w-full max-w-2xl overflow-hidden">
          <div className="border-b border-white/10 px-8 py-10">
            <CheckCircle className="mb-4 h-14 w-14 text-ieee-yellow" />
            <h2 className="headline text-white">Welcome to the Team!</h2>
            <p className="lead mt-3">
              You've successfully accepted the position
            </p>
          </div>

          <div className="p-8">
            <div className="surface-flat p-6">
              <div className="mb-2 flex items-center gap-3">
                <Briefcase className="h-6 w-6 text-ieee-blue-100" />
                <h3 className="title-3 text-white">{invitation?.position}</h3>
              </div>
              <p className="copy ml-9 text-white/60">{invitation?.role}</p>
            </div>

            <div className="surface-flat mt-6 p-6">
              <h3 className="flex items-center gap-2 font-semibold text-white">
                <CheckCircle className="h-5 w-5 text-ieee-blue-100" />
                What's Next?
              </h3>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <span className="font-mono text-xs font-bold text-ieee-blue-100">
                      1
                    </span>
                  </div>
                  <span className="text-white/70">
                    Check your email for detailed onboarding instructions
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <span className="font-mono text-xs font-bold text-ieee-blue-100">
                      2
                    </span>
                  </div>
                  <span className="text-white/70">
                    Your officer invitation has been recorded
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <span className="font-mono text-xs font-bold text-ieee-blue-100">
                      3
                    </span>
                  </div>
                  <span className="text-white/70">
                    Your officer role has been granted - you now have dashboard
                    access
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <span className="font-mono text-xs font-bold text-ieee-blue-100">
                      4
                    </span>
                  </div>
                  <span className="text-white/70">
                    Sign in to the dashboard and follow the onboarding steps
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-6 text-center">
              <a href="/dashboard" className="ieee-btn ieee-btn-primary px-8">
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="surface w-full max-w-md p-8 text-center">
          <XCircle className="mx-auto mb-4 h-14 w-14 text-white/40" />
          <h2 className="title-3 text-white">Invitation Declined</h2>
          <p className="copy mt-2">
            You have declined the position of {invitation?.position}. Thank you
            for your response.
          </p>
          <div className="mt-6 flex justify-center">
            <a href="/" className="ieee-btn ieee-btn-ghost">
              Go to Homepage
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="surface w-full max-w-3xl overflow-hidden">
        <div className="border-b border-white/10 px-8 py-10">
          <h1 className="headline text-white">
            Congratulations, {invitation?.name}!
          </h1>
          <p className="lead mt-3">
            You've been elected to the IEEE at UCSD general board
          </p>
        </div>

        <div className="p-8">
          <div className="surface-flat p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Briefcase className="h-6 w-6 text-ieee-blue-100" />
              </div>
              <div className="flex-1">
                <p className="mono-label">Your Position</p>
                <h2 className="title-3 mt-1 text-white">
                  {invitation?.position}
                </h2>
                <span className="chip mt-3">{invitation?.role}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="surface-flat p-4">
              <div className="mb-2 flex items-center gap-3">
                <User className="h-5 w-5 text-ieee-blue-100" />
                <p className="mono-label">Full Name</p>
              </div>
              <p className="ml-8 font-medium text-white">{invitation?.name}</p>
            </div>

            <div className="surface-flat p-4">
              <div className="mb-2 flex items-center gap-3">
                <Mail className="h-5 w-5 text-ieee-blue-100" />
                <p className="mono-label">Email Address</p>
              </div>
              <p className="ml-8 break-all font-medium text-white">
                {invitation?.email}
              </p>
            </div>

            {invitation?.acceptanceDeadline && (
              <div className="surface-flat p-4 md:col-span-2">
                <div className="mb-2 flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-ieee-blue-100" />
                  <p className="mono-label">Response Deadline</p>
                </div>
                <p className="ml-8 font-medium text-white">
                  {invitation.acceptanceDeadline}
                </p>
              </div>
            )}
          </div>

          {invitation?.message && (
            <div className="surface-flat mt-6 p-5">
              <p className="mono-label">Message from Leadership</p>
              <p className="copy mt-2 leading-relaxed">{invitation.message}</p>
            </div>
          )}

          <div className="surface-flat mt-6 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-ieee-yellow" />
              <div>
                <p className="font-semibold text-white">Important</p>
                <p className="copy mt-1 text-sm leading-relaxed">
                  By accepting this position, you agree to fulfill the
                  responsibilities of <strong>{invitation?.position}</strong>{" "}
                  for the 2025-2026 academic year and commit to supporting IEEE
                  at UCSD's mission.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleDecline}
              disabled={processing}
              className="ieee-btn ieee-btn-ghost flex-1 font-semibold disabled:opacity-50"
            >
              Decline Position
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={processing}
              className="ieee-btn ieee-btn-primary flex-1 font-semibold disabled:opacity-50"
            >
              {processing ? "Processing..." : "Accept Position"}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-white/50">
            Questions? Contact us at{" "}
            <a href="mailto:ieee@ucsd.edu">ieee@ucsd.edu</a>
          </p>
        </div>
      </div>
    </div>
  );
}
