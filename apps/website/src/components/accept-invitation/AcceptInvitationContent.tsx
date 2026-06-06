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
import { Card, CardBody, Button, Chip } from "@heroui/react";

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button as="a" href="/" color="primary" className="rounded-lg">
              Go to Homepage
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-2xl w-full shadow-xl">
          <CardBody className="p-0">
            {/* Success Header */}
            <div className="bg-green-600 px-8 py-10 text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">
                Welcome to the Team!
              </h2>
              <p className="text-green-50 text-lg">
                You've successfully accepted the position
              </p>
            </div>

            {/* Content */}
            <div className="p-8">
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <Briefcase className="w-6 h-6 text-green-600" />
                  <h3 className="text-xl font-bold text-gray-900">
                    {invitation?.position}
                  </h3>
                </div>
                <p className="text-gray-600 ml-9">{invitation?.role}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  What's Next?
                </h3>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-900">1</span>
                    </div>
                    <span>
                      Check your email for detailed onboarding instructions
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-900">2</span>
                    </div>
                    <span>Your officer invitation has been recorded</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-900">3</span>
                    </div>
                    <span>
                      Your officer role has been granted - you now have
                      dashboard access
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-900">4</span>
                    </div>
                    <span>
                      Sign in to the dashboard and follow the onboarding steps
                    </span>
                  </li>
                </ul>
              </div>

              <div className="text-center">
                <Button
                  as="a"
                  href="/dashboard"
                  color="primary"
                  size="lg"
                  className="rounded-lg px-8"
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardBody className="p-8 text-center">
            <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Invitation Declined
            </h2>
            <p className="text-gray-600 mb-6">
              You have declined the position of {invitation?.position}. Thank
              you for your response.
            </p>
            <Button
              as="a"
              href="/"
              color="primary"
              variant="bordered"
              className="rounded-lg"
            >
              Go to Homepage
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-3xl w-full shadow-xl">
        <CardBody className="p-0">
          {/* Header */}
          <div className="bg-[#0A2463] px-8 py-10 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">
              Congratulations, {invitation?.name}!
            </h1>
            <p className="text-blue-100 text-lg">
              You've been elected to the IEEE at UCSD general board
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Position Card */}
            <div className="bg-gradient-to-br from-[#0A2463] to-[#1a3a7d] text-white rounded-xl p-6 mb-8 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-blue-100 mb-1">Your Position</p>
                  <h2 className="text-2xl font-bold mb-2">
                    {invitation?.position}
                  </h2>
                  <Chip
                    size="sm"
                    className="bg-white/20 text-white border-white/30"
                    variant="bordered"
                  >
                    {invitation?.role}
                  </Chip>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <User className="w-5 h-5 text-[#0A2463]" />
                  <p className="text-sm font-medium text-gray-500">Full Name</p>
                </div>
                <p className="text-gray-900 font-medium ml-8">
                  {invitation?.name}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-[#0A2463]" />
                  <p className="text-sm font-medium text-gray-500">
                    Email Address
                  </p>
                </div>
                <p className="text-gray-900 font-medium ml-8 break-all">
                  {invitation?.email}
                </p>
              </div>

              {invitation?.acceptanceDeadline && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 md:col-span-2">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-[#0A2463]" />
                    <p className="text-sm font-medium text-gray-500">
                      Response Deadline
                    </p>
                  </div>
                  <p className="text-gray-900 font-medium ml-8">
                    {invitation.acceptanceDeadline}
                  </p>
                </div>
              )}
            </div>

            {/* Message */}
            {invitation?.message && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Message from Leadership
                </p>
                <p className="text-blue-800 leading-relaxed">
                  {invitation.message}
                </p>
              </div>
            )}

            {/* Important Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-8">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 mb-1">Important</p>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    By accepting this position, you agree to fulfill the
                    responsibilities of <strong>{invitation?.position}</strong>{" "}
                    for the 2025-2026 academic year and commit to supporting
                    IEEE at UCSD's mission.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                color="danger"
                variant="bordered"
                onPress={handleDecline}
                isDisabled={processing}
                size="lg"
                className="flex-1 rounded-lg font-semibold"
              >
                Decline Position
              </Button>
              <Button
                style={{ background: "#0A2463" }}
                onPress={handleAccept}
                isLoading={processing}
                size="lg"
                className="flex-1 rounded-lg font-semibold text-white"
              >
                {processing ? "Processing..." : "Accept Position"}
              </Button>
            </div>

            {/* Footer Note */}
            <p className="text-center text-sm text-gray-500 mt-6">
              Questions? Contact us at{" "}
              <a
                href="mailto:ieee@ucsd.edu"
                className="text-[#0A2463] hover:underline"
              >
                ieee@ucsd.edu
              </a>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
