import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SponsorDomain, SponsorFormData, SponsorTier } from "./types";

const SPONSOR_TIERS: SponsorTier[] = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];

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
  const [formData, setFormData] = useState<SponsorFormData>({
    domain: "",
    organizationName: "",
    sponsorTier: "Bronze",
  });
  const [domainError, setDomainError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingSponsor) {
        setFormData({
          domain: editingSponsor.domain,
          organizationName: editingSponsor.organizationName,
          sponsorTier: editingSponsor.sponsorTier,
        });
      } else {
        setFormData({
          domain: "",
          organizationName: "",
          sponsorTier: "Bronze",
        });
      }
      setDomainError(null);
    }
  }, [isOpen, editingSponsor]);

  const validateDomain = (domain: string): string | null => {
    if (!domain) {
      return "Domain is required";
    }
    if (!domain.startsWith("@")) {
      return "Domain must start with @";
    }
    if (domain.length < 3) {
      return "Domain must have at least one character after @";
    }
    const domainPart = domain.substring(1);
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domainPart)) {
      return "Invalid domain format (e.g., @example.com)";
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
      setDomainError("Organization name is required");
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md gap-6">
        <DialogHeader>
          <DialogTitle>
            {editingSponsor ? "Edit Sponsor Domain" : "Add Sponsor Domain"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Email Domain</Label>
            <Input
              id="domain"
              placeholder="@example.com"
              value={formData.domain}
              onChange={(e) => handleDomainChange(e.target.value)}
              disabled={loading}
              className={domainError ? "border-destructive" : ""}
            />
            {domainError && (
              <p className="text-sm text-destructive">{domainError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Enter the email domain (e.g., @tsmc.com)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationName">Organization Name</Label>
            <Input
              id="organizationName"
              placeholder="e.g. TSMC"
              value={formData.organizationName}
              onChange={(e) =>
                setFormData({ ...formData, organizationName: e.target.value })
              }
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sponsorTier">Sponsor Tier</Label>
            <Select
              value={formData.sponsorTier}
              onValueChange={(value) =>
                setFormData({ ...formData, sponsorTier: value as SponsorTier })
              }
              disabled={loading}
            >
              <SelectTrigger id="sponsorTier">
                <SelectValue placeholder="Select tier" />
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

          <DialogFooter className="mt-6 flex justify-between sm:justify-between">
            {editingSponsor && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDelete(editingSponsor._id)}
                disabled={loading}
                className="mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !!domainError}>
                {editingSponsor ? "Update" : "Add"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
