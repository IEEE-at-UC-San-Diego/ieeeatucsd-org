import type { Id } from "@convex/_generated/dataModel";
import { Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { SponsorDomain, SponsorFormData, SponsorTier } from "./types";

const SPONSOR_TIERS: SponsorTier[] = [
	"Bronze",
	"Silver",
	"Gold",
	"Platinum",
	"Diamond",
];

interface SponsorModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (data: SponsorFormData) => void;
	onDelete?: (id: Id<"sponsorDomains">) => void;
	editingSponsor: SponsorDomain | null;
	loading?: boolean;
}

export function SponsorModal({
	isOpen,
	onClose,
	onSave,
	onDelete,
	editingSponsor,
	loading = false,
}: SponsorModalProps) {
	const formId = useId();
	const [formData, setFormData] = useState<SponsorFormData>({
		domain: "",
		organizationName: "",
		sponsorTier: "Bronze",
	});
	const [domainError, setDomainError] = useState<string | null>(null);
	const [organizationError, setOrganizationError] = useState<string | null>(
		null,
	);

	const initialData = useMemo<SponsorFormData>(
		() =>
			editingSponsor
				? {
						domain: editingSponsor.domain,
						organizationName: editingSponsor.organizationName,
						sponsorTier: editingSponsor.sponsorTier,
					}
				: { domain: "", organizationName: "", sponsorTier: "Bronze" },
		[editingSponsor],
	);
	const isDirty =
		isOpen &&
		(formData.domain !== initialData.domain ||
			formData.organizationName !== initialData.organizationName ||
			formData.sponsorTier !== initialData.sponsorTier);
	const confirmDiscard = useUnsavedChangesGuard(isDirty);

	const handleClose = async () => {
		if (!(await confirmDiscard())) return;
		onClose();
	};

	useEffect(() => {
		if (isOpen) {
			setFormData(initialData);
			setDomainError(null);
			setOrganizationError(null);
		}
	}, [isOpen, initialData]);

	const validateDomain = (domain: string): string | null => {
		if (!domain) {
			return "Enter an email domain, e.g. @example.com.";
		}
		if (!domain.startsWith("@")) {
			return "Start the domain with @, e.g. @example.com.";
		}
		if (domain.length < 3) {
			return "Add the domain name after @, e.g. @example.com.";
		}
		const domainPart = domain.substring(1);
		if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domainPart)) {
			return "Use a full domain with an extension, e.g. @example.com.";
		}
		return null;
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const domainValidationError = validateDomain(formData.domain);
		if (domainValidationError) {
			setDomainError(domainValidationError);
			return;
		}

		if (!formData.organizationName.trim()) {
			setOrganizationError("Enter the organization’s name, e.g. TSMC.");
			return;
		}

		onSave(formData);
	};

	const handleDomainChange = (value: string) => {
		let processedValue = value.trim();
		if (processedValue && !processedValue.startsWith("@")) {
			processedValue = "@" + processedValue;
		}
		setFormData({ ...formData, domain: processedValue });
		setDomainError(validateDomain(processedValue));
	};

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) void handleClose();
			}}
			title={editingSponsor ? "Edit Sponsor Domain" : "Add Sponsor Domain"}
			variant="large-sheet"
			className="sm:max-w-md"
			footer={
				<div className="flex w-full flex-wrap items-center justify-between gap-2">
					{editingSponsor && onDelete ? (
						<Button
							type="button"
							variant="destructive"
							className="h-11 sm:h-9"
							onClick={() => onDelete(editingSponsor._id)}
							disabled={loading}
						>
							<Trash2 className="w-4 h-4 mr-2" />
							Delete Domain
						</Button>
					) : (
						<span />
					)}
					<div className="flex flex-1 justify-end gap-2 sm:flex-none">
						<Button
							type="button"
							variant="outline"
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							onClick={() => void handleClose()}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							form={`${formId}-sponsor-form`}
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							disabled={loading || !!domainError}
						>
							{editingSponsor ? "Save Changes" : "Add Domain"}
						</Button>
					</div>
				</div>
			}
		>
			<form
				id={`${formId}-sponsor-form`}
				onSubmit={handleSubmit}
				className="space-y-4 pb-2"
			>
				<div className="space-y-2">
					<Label htmlFor={`${formId}-domain`}>Email Domain</Label>
					<Input
						id={`${formId}-domain`}
						name="domain"
						placeholder="@example.com"
						value={formData.domain}
						onChange={(e) => handleDomainChange(e.target.value)}
						disabled={loading}
						className={`h-11 text-base sm:h-9 sm:text-sm ${domainError ? "border-destructive" : ""}`}
						autoComplete="off"
						inputMode="url"
						spellCheck={false}
						aria-invalid={!!domainError}
						aria-describedby={`${formId}-domain-error ${formId}-domain-hint`}
					/>
					<output
						id={`${formId}-domain-error`}
						aria-live="polite"
						className="block text-sm text-destructive empty:hidden"
					>
						{domainError}
					</output>
					<p
						id={`${formId}-domain-hint`}
						className="text-xs text-muted-foreground"
					>
						Enter the email domain (e.g., @tsmc.com)
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-organizationName`}>
						Organization Name
					</Label>
					<Input
						id={`${formId}-organizationName`}
						name="organizationName"
						placeholder="e.g. TSMC"
						value={formData.organizationName}
						onChange={(e) => {
							setFormData({ ...formData, organizationName: e.target.value });
							setOrganizationError(null);
						}}
						disabled={loading}
						className={`h-11 text-base sm:h-9 sm:text-sm ${organizationError ? "border-destructive" : ""}`}
						autoComplete="organization"
						aria-invalid={!!organizationError}
						aria-describedby={`${formId}-organizationName-error`}
					/>
					<output
						id={`${formId}-organizationName-error`}
						aria-live="polite"
						className="block text-sm text-destructive empty:hidden"
					>
						{organizationError}
					</output>
				</div>

				<div className="space-y-2">
					<Label htmlFor={`${formId}-sponsorTier`}>Sponsor Tier</Label>
					<Select
						value={formData.sponsorTier}
						onValueChange={(value) =>
							setFormData({ ...formData, sponsorTier: value as SponsorTier })
						}
						disabled={loading}
					>
						<SelectTrigger id={`${formId}-sponsorTier`} className="h-11 sm:h-9">
							<SelectValue placeholder="Select tier…" />
						</SelectTrigger>
						<SelectContent>
							{SPONSOR_TIERS.map((tier) => (
								<SelectItem key={tier} value={tier}>
									{tier}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</form>
		</ResponsiveOverlay>
	);
}
