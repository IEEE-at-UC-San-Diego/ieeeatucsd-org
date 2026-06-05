import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEGAL_VERSIONS } from "@/config/navigation";

export const Route = createFileRoute("/terms-of-service")({
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p className="text-muted-foreground mb-8">
          Version {LEGAL_VERSIONS.TOS_VERSION} &middot; Effective{" "}
          {LEGAL_VERSIONS.TOS_EFFECTIVE_DATE}
        </p>

        <div className="prose prose-neutral max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using the IEEE at UC San Diego Dashboard ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is an internal dashboard for IEEE at UC San Diego members, officers, and sponsors. It provides tools for event management, reimbursement tracking, fund requests, member management, and other organizational functions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to use the Service only for its intended purposes related to IEEE at UC San Diego activities. You shall not misuse the Service, attempt to gain unauthorized access, or use the Service in any way that violates applicable laws or regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">5. Data and Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of any content you submit through the Service. By submitting content, you grant IEEE at UC San Diego a non-exclusive license to use, store, and process that content for the purposes of operating the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">6. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" without warranties of any kind. IEEE at UC San Diego shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">7. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these terms at any time. We will notify users of significant changes through the Service. Your continued use of the Service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mt-8 mb-3">8. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these Terms of Service, please contact us at{" "}
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
