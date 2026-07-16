import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle,
	CreditCard,
	ExternalLink,
	FileText,
	GraduationCap,
	Loader2,
	Shield,
	Upload,
	User,
} from "lucide-react";
import { useState } from "react";
import { MobileTaskStepper } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LEGAL_VERSIONS } from "@/config/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { uploadResumeToStorage, validateResumeFile } from "@/lib/resumeUpload";

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
	autoComplete?: string;
	inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
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
		autoComplete: "off",
		inputMode: "text",
	},
	{
		id: "major",
		title: "Major",
		description: "What are you studying at UCSD?",
		icon: GraduationCap,
		required: true,
		type: "text",
		placeholder: "Computer Science",
		autoComplete: "organization-title",
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
		inputMode: "numeric",
	},
	{
		id: "memberId",
		title: "IEEE Member ID",
		description: "If you're already an IEEE member, enter your ID (optional)",
		icon: User,
		required: false,
		type: "text",
		placeholder: "12345678",
		inputMode: "numeric",
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
		autoComplete: "email",
	},
	{
		id: "resume",
		title: "Resume",
		description: "Upload your resume for networking opportunities (optional)",
		icon: Upload,
		required: false,
		type: "file",
		accept: ".pdf,application/pdf",
	},
];

function GetStartedPage() {
	const { user, logtoId } = useAuth();
	const completeOnboarding = useAuthedMutation(api.users.completeOnboarding);
	const generateResumeUploadUrl = useAuthedMutation(
		api.users.generateResumeUploadUrl,
	);
	const [currentStep, setCurrentStep] = useState(0);
	const [answers, setAnswers] = useState<Record<string, unknown>>({});
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const currentQuestion = questions[currentStep];
	const isLastStep = currentStep === questions.length - 1;

	if (user?.signedUp) {
		window.location.href = "/overview";
		return null;
	}

	const handleNext = () => {
		if (currentQuestion.type === "legal-acceptance") {
			const legalValue = answers[currentQuestion.id] as
				| { tos?: boolean; privacy?: boolean }
				| undefined;
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
		if (isLastStep) {
			handleSubmit();
		} else {
			setCurrentStep((prev) => prev + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 0) {
			setCurrentStep((prev) => prev - 1);
			setError(null);
		}
	};

	const handleInputChange = (value: unknown) => {
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
			const resumeFile = answers.resume as File | null | undefined;
			let resumeStorageId;
			let resumeFileName;

			if (resumeFile) {
				resumeStorageId = await uploadResumeToStorage(resumeFile, () =>
					generateResumeUploadUrl({ logtoId: logtoId! }),
				);
				resumeFileName = resumeFile.name;
			}

			await completeOnboarding({
				logtoId: logtoId!,
				pid: answers.pid as string,
				major: answers.major as string,
				graduationYear: parseInt(answers.graduationYear as string),
				memberId: (answers.memberId as string) || undefined,
				zelleInformation: (answers.zelle as string) || undefined,
				resumeStorageId,
				resumeFileName,
				tosVersion: LEGAL_VERSIONS.TOS_VERSION,
				privacyPolicyVersion: LEGAL_VERSIONS.PRIVACY_POLICY_VERSION,
			});
			setCurrentStep(questions.length);
			setTimeout(() => {
				window.location.href = "/overview";
			}, 2000);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Something went wrong");
			setLoading(false);
		}
	};

	if (currentStep === questions.length) {
		return (
			<div className="flex min-h-dvh items-center justify-center bg-background px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
				<div className="text-center success-reveal">
					<div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-ds-green-1000 sm:h-24 sm:w-24">
						<CheckCircle className="h-10 w-10 text-white sm:h-12 sm:w-12" />
					</div>
					<h1 className="mb-3 text-2xl font-bold sm:text-3xl">
						Welcome to IEEE UCSD!
					</h1>
					<p className="text-muted-foreground">
						Your profile has been set up successfully.
					</p>
					<p className="mt-2 text-sm text-muted-foreground">
						Redirecting to your dashboard...
					</p>
				</div>
			</div>
		);
	}

	const renderInput = () => {
		const question = currentQuestion;
		const value = answers[question.id];

		switch (question.type) {
			case "text":
				return (
					<Input
						type="text"
						value={(value as string) || ""}
						onChange={(e) => handleInputChange(e.target.value)}
						onKeyDown={handleKeyPress}
						placeholder={question.placeholder}
						className="h-12 text-base"
						autoFocus
						autoComplete={question.autoComplete}
						inputMode={question.inputMode}
						enterKeyHint="next"
					/>
				);
			case "number":
				return (
					<Input
						type="number"
						value={(value as string) || ""}
						onChange={(e) => handleInputChange(e.target.value)}
						onKeyDown={handleKeyPress}
						placeholder={question.placeholder}
						min={question.min}
						max={question.max}
						className="h-12 text-base"
						autoFocus
						inputMode="numeric"
						enterKeyHint="next"
					/>
				);
			case "file":
				return (
					<div className="space-y-4">
						<label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center active:bg-muted/50">
							<Upload className="size-8 text-muted-foreground" />
							<span className="text-sm font-medium">Tap to choose PDF</span>
							<span className="text-xs text-muted-foreground">Maximum 5MB</span>
							<input
								type="file"
								accept={question.accept}
								className="sr-only"
								onChange={(e) => {
									const file = e.target.files?.[0] || null;
									if (file) {
										const validationError = validateResumeFile(file);
										if (validationError) {
											setError(validationError);
											e.target.value = "";
											return;
										}
									}
									handleInputChange(file);
								}}
							/>
						</label>
						{value instanceof File && (
							<p className="flex items-center gap-2 font-medium text-ds-green-700">
								<CheckCircle className="w-4 h-4" />
								{value.name} selected
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Your resume will be visible to IEEE sponsors and officers.
						</p>
					</div>
				);
			case "legal-acceptance": {
				const legal = (value as { tos?: boolean; privacy?: boolean }) || {};
				const tosAccepted = legal.tos || false;
				const privacyAccepted = legal.privacy || false;
				return (
					<div className="space-y-3">
						<label className="flex min-h-[52px] cursor-pointer items-start gap-3 rounded-md border bg-muted/40 p-4 active:bg-muted/60">
							<Checkbox
								checked={tosAccepted}
								onCheckedChange={(checked) =>
									handleInputChange({ ...legal, tos: checked })
								}
								className="mt-0.5 size-5"
							/>
							<div className="min-w-0 flex-1">
								<div className="mb-1 flex flex-wrap items-center gap-2">
									<FileText className="size-4 text-ds-blue-700" />
									<span className="font-medium">Terms of Service</span>
									<span className="rounded bg-ds-blue-100 px-2 py-0.5 text-xs text-ds-blue-700">
										v{LEGAL_VERSIONS.TOS_VERSION}
									</span>
								</div>
								<p className="mb-2 text-sm text-muted-foreground">
									I have read and agree to the Terms of Service.
								</p>
								<a
									href={LEGAL_VERSIONS.TOS_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-sm text-ds-blue-700"
									onClick={(e) => e.stopPropagation()}
								>
									Read Terms of Service
									<ExternalLink className="size-3" />
								</a>
							</div>
						</label>
						<label className="flex min-h-[52px] cursor-pointer items-start gap-3 rounded-md border bg-muted/40 p-4 active:bg-muted/60">
							<Checkbox
								checked={privacyAccepted}
								onCheckedChange={(checked) =>
									handleInputChange({ ...legal, privacy: checked })
								}
								className="mt-0.5 size-5"
							/>
							<div className="min-w-0 flex-1">
								<div className="mb-1 flex flex-wrap items-center gap-2">
									<Shield className="size-4 text-ds-green-700" />
									<span className="font-medium">Privacy Policy</span>
									<span className="rounded bg-ds-green-100 px-2 py-0.5 text-xs text-ds-green-700">
										v{LEGAL_VERSIONS.PRIVACY_POLICY_VERSION}
									</span>
								</div>
								<p className="mb-2 text-sm text-muted-foreground">
									I have read and agree to the Privacy Policy.
								</p>
								<a
									href={LEGAL_VERSIONS.PRIVACY_POLICY_URL}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-sm text-ds-blue-700"
									onClick={(e) => e.stopPropagation()}
								>
									Read Privacy Policy
									<ExternalLink className="size-3" />
								</a>
							</div>
						</label>
						<p className="text-center text-xs text-muted-foreground">
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
		<div className="flex min-h-dvh flex-col bg-background pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
			<div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
				<div className="mb-6 text-center md:mb-8">
					<div className="mb-3 flex items-center justify-center gap-3">
						<img
							src="/logos/blue_logo_only.svg"
							alt=""
							className="size-10 sm:size-12"
						/>
						<h1 className="text-xl font-bold sm:text-3xl">
							IEEE at UC San Diego
						</h1>
					</div>
					<p className="text-sm text-muted-foreground">
						Complete your profile to get started
					</p>
				</div>

				<div className="flex min-h-0 flex-1 flex-col rounded-md border bg-card md:shadow-sm">
					<div className="shrink-0 border-b px-4 py-3 sm:px-6 sm:py-4">
						<MobileTaskStepper
							currentStep={currentStep + 1}
							totalSteps={questions.length}
							stepTitle={currentQuestion.title}
						/>
					</div>

					<div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
						<div className="text-center">
							<div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary sm:size-16">
								<currentQuestion.icon className="size-7 text-primary-foreground sm:size-8" />
							</div>
							<h2 className="mb-2 text-xl font-bold sm:text-2xl">
								{currentQuestion.title}
								{currentQuestion.required && (
									<span className="ml-1 text-ds-red-800">*</span>
								)}
							</h2>
							<p className="text-sm text-muted-foreground sm:text-base">
								{currentQuestion.description}
							</p>
						</div>

						{error && (
							<div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
								<p className="text-sm text-destructive">{error}</p>
							</div>
						)}

						{renderInput()}
					</div>

					<div className="sticky bottom-0 shrink-0 space-y-2 border-t bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
						<div className="flex gap-3">
							<Button
								variant="outline"
								onClick={handleBack}
								disabled={currentStep === 0}
								className="h-12 min-w-[5.5rem] shrink-0"
							>
								<ArrowLeft className="mr-1.5 size-4" />
								Back
							</Button>
							<Button
								onClick={handleNext}
								disabled={loading}
								className="h-12 flex-1"
							>
								{loading ? (
									<>
										<Loader2 className="mr-2 size-4 animate-spin" />
										Finishing...
									</>
								) : isLastStep ? (
									<>
										Complete Setup
										<CheckCircle className="ml-2 size-4" />
									</>
								) : (
									<>
										Next
										<ArrowRight className="ml-2 size-4" />
									</>
								)}
							</Button>
						</div>
						{!currentQuestion.required && (
							<Button
								variant="ghost"
								onClick={handleNext}
								className="h-10 w-full text-muted-foreground"
							>
								Skip this question
							</Button>
						)}
					</div>
				</div>

				<p className="mt-6 text-center text-xs text-muted-foreground">
					Need help?{" "}
					<a href="mailto:ieee@ucsd.edu" className="text-ds-blue-700">
						ieee@ucsd.edu
					</a>
				</p>
			</div>
		</div>
	);
}
