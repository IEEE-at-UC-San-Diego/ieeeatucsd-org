import { createFileRoute } from "@tanstack/react-router";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/hooks/useAuth";
import {
  User,
  GraduationCap,
  CreditCard,
  Upload,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  FileText,
  Shield,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { LEGAL_VERSIONS } from "@/config/navigation";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_dashboard/get-started")({
  component: GetStartedPage,
});

interface Question {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
  type: "text" | "number" | "file" | "legal-acceptance";
  placeholder?: string;
  min?: number;
  max?: number;
  accept?: string;
}

const questions: Question[] = [
  {
    id: "legalAcceptance",
    title: "Terms of Service & Privacy Policy",
    description: "Please review and accept our policies to continue",
    icon: FileText,
    required: true,
    type: "legal-acceptance",
  },
  {
    id: "pid",
    title: "Student PID",
    description: "Your UCSD student ID (e.g., A12345678)",
    icon: User,
    required: true,
    type: "text",
    placeholder: "A12345678",
  },
  {
    id: "major",
    title: "Major",
    description: "What are you studying at UCSD?",
    icon: GraduationCap,
    required: true,
    type: "text",
    placeholder: "Computer Science",
  },
  {
    id: "graduationYear",
    title: "Expected Graduation Year",
    description: "When do you plan to graduate?",
    icon: GraduationCap,
    required: true,
    type: "number",
    placeholder: "2025",
    min: 2024,
    max: 2030,
  },
  {
    id: "memberId",
    title: "IEEE Member ID",
    description: "If you're already an IEEE member, enter your ID (optional)",
    icon: User,
    required: false,
    type: "text",
    placeholder: "12345678",
  },
  {
    id: "zelle",
    title: "Zelle Information",
    description:
      "Phone number or email for reimbursements and payments (optional)",
    icon: CreditCard,
    required: false,
    type: "text",
    placeholder: "Phone number or email",
  },
  {
    id: "resume",
    title: "Resume",
    description: "Upload your resume for networking opportunities (optional)",
    icon: Upload,
    required: false,
    type: "file",
    accept: ".pdf,.doc,.docx",
  },
];

function GetStartedPage() {
  const { user, logtoId } = useAuth();
  const completeOnboarding = useAuthedMutation(api.users.completeOnboarding);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentQuestion = questions[currentStep];
  const isLastStep = currentStep === questions.length - 1;

  if (user?.signedUp) {
    window.location.href = "/overview";
    return null;
  }

  const handleNext = () => {
    if (currentQuestion.type === "legal-acceptance") {
      const legalValue = answers[currentQuestion.id];
      if (!legalValue?.tos || !legalValue?.privacy) {
        setError(
          "You must accept both the Terms of Service and Privacy Policy to continue",
        );
        return;
      }
    } else if (currentQuestion.required && !answers[currentQuestion.id]) {
      setError("This field is required");
      return;
    }

    setError(null);
    setIsAnimating(true);
    setTimeout(() => {
      if (isLastStep) {
        handleSubmit();
      } else {
        setCurrentStep((prev) => prev + 1);
        setIsAnimating(false);
      }
    }, 300);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
        setIsAnimating(false);
        setError(null);
      }, 300);
    }
  };

  const handleInputChange = (value: any) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleNext();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await completeOnboarding({
        logtoId: logtoId!,
        pid: answers.pid,
        major: answers.major,
        graduationYear: parseInt(answers.graduationYear),
        memberId: answers.memberId || undefined,
        zelleInformation: answers.zelle || undefined,
        tosVersion: LEGAL_VERSIONS.TOS_VERSION,
        privacyPolicyVersion: LEGAL_VERSIONS.PRIVACY_POLICY_VERSION,
      });
      setCurrentStep(questions.length);
      setTimeout(() => {
        window.location.href = "/overview";
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Success screen
  if (currentStep === questions.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">Welcome to IEEE UCSD!</h1>
          <p className="text-muted-foreground text-lg">
            Your profile has been set up successfully.
          </p>
          <p className="text-muted-foreground mt-2">
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  const renderInput = () => {
    const question = currentQuestion;
    const value = answers[question.id] || "";

    switch (question.type) {
      case "text":
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={question.placeholder}
            className="text-lg py-3"
            autoFocus
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={question.placeholder}
            min={question.min}
            max={question.max}
            className="text-lg py-3"
            autoFocus
          />
        );
      case "file":
        return (
          <div className="space-y-4">
            <Input
              type="file"
              accept={question.accept}
              onChange={(e) => handleInputChange(e.target.files?.[0] || null)}
            />
            {value && (
              <p className="text-green-600 font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                {value.name} selected
              </p>
            )}
          </div>
        );
      case "legal-acceptance": {
        const tosAccepted = value?.tos || false;
        const privacyAccepted = value?.privacy || false;
        return (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={tosAccepted}
                  onCheckedChange={(checked) =>
                    handleInputChange({ ...value, tos: checked })
                  }
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Terms of Service</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      v{LEGAL_VERSIONS.TOS_VERSION}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    I have read and agree to the Terms of Service.
                  </p>
                  <a
                    href={LEGAL_VERSIONS.TOS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    Read Terms of Service
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={privacyAccepted}
                  onCheckedChange={(checked) =>
                    handleInputChange({ ...value, privacy: checked })
                  }
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="font-medium">Privacy Policy</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      v{LEGAL_VERSIONS.PRIVACY_POLICY_VERSION}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    I have read and agree to the Privacy Policy.
                  </p>
                  <a
                    href={LEGAL_VERSIONS.PRIVACY_POLICY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    Read Privacy Policy
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              You must accept both policies to continue.
            </p>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 py-8 md:py-12">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img
              src="/logos/blue_logo_only.svg"
              alt="IEEE UCSD Logo"
              className="w-12 h-12 mr-3"
            />
            <h1 className="text-3xl font-bold">IEEE at UC San Diego</h1>
          </div>
          <p className="text-muted-foreground">
            Complete your profile to get started
          </p>
        </div>

        <div className="rounded-xl border bg-card shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>
                Question {currentStep + 1} of {questions.length}
              </span>
              <span>
                {Math.round(((currentStep + 1) / questions.length) * 100)}%
                Complete
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${((currentStep + 1) / questions.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <div
            className={`p-8 transition-all duration-500 ${isAnimating ? "opacity-0" : "opacity-100"}`}
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <currentQuestion.icon className="w-8 h-8 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {currentQuestion.title}
                {currentQuestion.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </h2>
              <p className="text-muted-foreground">
                {currentQuestion.description}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <div className="mb-8">{renderInput()}</div>

            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>

              <Button onClick={handleNext} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finishing...
                  </>
                ) : isLastStep ? (
                  <>
                    Complete Setup
                    <CheckCircle className="w-5 h-5 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {!currentQuestion.required && (
          <div className="text-center mt-4">
            <button
              onClick={handleNext}
              className="text-muted-foreground hover:text-foreground text-sm underline transition-colors"
            >
              Skip this question
            </button>
          </div>
        )}

        <div className="text-center mt-8 text-xs text-muted-foreground">
          <p>
            Need help? Contact us at{" "}
            <a
              href="mailto:ieee@ucsd.edu"
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              ieee@ucsd.edu
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
