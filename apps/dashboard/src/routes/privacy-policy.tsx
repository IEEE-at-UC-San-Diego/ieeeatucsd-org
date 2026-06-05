import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEGAL_VERSIONS } from "@/config/navigation";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/overview">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mb-8">
          Version {LEGAL_VERSIONS.PRIVACY_POLICY_VERSION} &middot; Effective{" "}
          {LEGAL_VERSIONS.PRIVACY_POLICY_EFFECTIVE_DATE}
        </p>

        <div className="prose prose-neutral max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly, including your name, email address, UCSD student PID, major, graduation year, IEEE member ID, and optionally your Zelle information for reimbursements and your resume.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your information is used to operate the IEEE at UC San Diego Dashboard, manage membership, track event attendance and points, process reimbursements and fund requests, facilitate officer onboarding, and communicate with members about organizational activities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information. Your information may be shared with IEEE at UC San Diego officers for organizational purposes, with sponsors (limited to resume data for eligible sponsor tiers, with your consent), and as required by law or university policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored securely using industry-standard cloud services. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may access, update, or delete your personal information through the Dashboard settings page. You may request a copy of your data or request deletion of your account by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Cookies and Authentication</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use authentication tokens to maintain your session. We do not use third-party tracking cookies. Authentication is handled through our identity provider (Logto) using Google OAuth.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes through the Service and request your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about this Privacy Policy, please contact us at{" "}
              <a
                href="mailto:ieee@ucsd.edu"
                className="text-primary hover:underline"
              >
                ieee@ucsd.edu
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
