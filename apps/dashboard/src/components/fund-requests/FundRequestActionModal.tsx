import { useState, useEffect } from "react";
import { useAuthedQuery, useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  ExternalLink,
  Download,
  Megaphone,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  needs_info: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  completed: "bg-purple-100 text-purple-800",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  events: "Events",
  projects: "Projects",
  internal: "Internal",
  other: "Other",
};

const CATEGORY_LABELS: Record<string, string> = {
  event: "Event",
  travel: "Travel",
  equipment: "Equipment",
  software: "Software",
  other: "Other",
  general: "General",
  projects: "Projects",
};
void CATEGORY_LABELS;

const FUNDING_SOURCES = ["department", "general"] as const;

type FUNDING_SOURCE = (typeof FUNDING_SOURCES)[number];

const FUNDING_SOURCE_LABELS: Record<FUNDING_SOURCE, string> = {
  department: "Department Budget",
  general: "General Fund",
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface FundRequestActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestId: string;
  logtoId: string;
}

export default function FundRequestActionModal({
  isOpen,
  onClose,
  requestId,
  logtoId,
}: FundRequestActionModalProps) {
  const [action, setAction] = useState<"approve" | "deny" | "needs_info">("approve");
  const [notes, setNotes] = useState("");
  const [fundingSource, setFundingSource] = useState<FUNDING_SOURCE>("department");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fundRequest = useAuthedQuery(api.fundRequests.get, logtoId && requestId ? { logtoId, id: requestId as any } : "skip");
  const updateStatus = useAuthedMutation(api.fundRequests.updateStatus);

  useEffect(() => {
    if (isOpen) {
      setAction("approve");
      setNotes("");
      setFundingSource("department");
    }
  }, [isOpen, requestId]);

  const handleSubmit = async () => {
    if (!logtoId || !fundRequest) return;

    if (action === "approve" && !fundingSource) {
      toast.error("Please select a funding source");
      return;
    }

    if ((action === "deny" || action === "needs_info") && !notes.trim()) {
      toast.error("Please provide a reason/note");
      return;
    }

    setIsSubmitting(true);
    try {
      const newStatus = action === "approve" ? "approved" : action === "deny" ? "denied" : "needs_info";

      await updateStatus({
        logtoId,
        id: requestId as any,
        status: newStatus,
        reviewNotes: action === "approve" ? notes.trim() || undefined : undefined,
        infoRequestNotes: action === "needs_info" ? notes.trim() : undefined,
      });

      toast.success(`Request ${action === "needs_info" ? "returned for info" : action === "approve" ? "approved" : "denied"}`);
      onClose();
    } catch (error: any) {
      toast.error("Failed to process request");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!fundRequest) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2">
              Review Fund Request
            </DialogTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal">
              <span>ID: {fundRequest._id.slice(0, 8)}...</span>
              <span>•</span>
              <span>Submitted on {formatDate(fundRequest.createdAt || Date.now())}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6 min-h-0">
          {/* Left Column: Request Details */}
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {/* User & Financials */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
               <div>
                 <p className="text-xs font-semibold text-muted-foreground uppercase">Requested by</p>
                 <p className="font-medium">{fundRequest.submittedByName || "Unknown"}</p>
                 <p className="text-xs text-muted-foreground">{fundRequest.submittedByEmail}</p>
               </div>
               <div className="text-right">
                 <p className="text-xs font-semibold text-muted-foreground uppercase">Amount</p>
                 <p className="text-xl font-bold text-green-600">{formatCurrency(fundRequest.amount)}</p>
               </div>
             </div>

            {/* Title & Purpose */}
            <div className="space-y-2">
              <h3 className="text-lg font-bold">{fundRequest.title}</h3>
              <div className="flex gap-2">
                <Badge variant="outline" className="capitalize">
                  {DEPARTMENT_LABELS[fundRequest.department] || fundRequest.department}
                </Badge>
                <Badge className={STATUS_COLORS[fundRequest.status] || ""}>
                  {fundRequest.status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </Badge>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Justification
                </h4>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed p-3 rounded-lg border bg-card">
                  {fundRequest.purpose}
                </p>
              </div>
            </div>

            {/* Info Response */}
            {fundRequest.infoResponseNotes && (
              <div className="bg-yellow-50/50 p-4 rounded-lg border border-yellow-200">
                <h4 className="text-xs font-bold text-yellow-800 uppercase flex items-center gap-1 mb-2">
                  <Megaphone className="w-3 h-3" /> Additional Context
                </h4>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {fundRequest.infoResponseNotes}
                </p>
              </div>
            )}

            <Separator />

            {/* Attachments & Links */}
            {(fundRequest.vendorLinks?.length || fundRequest.attachments?.length) && (
              <div className="space-y-4">
                {fundRequest.vendorLinks && fundRequest.vendorLinks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Purchase Links</h4>
                    <ul className="space-y-1">
                      {fundRequest.vendorLinks.map((link) => (
                        <li key={link.id} className="text-sm flex items-center gap-2">
                          <span className="text-muted-foreground text-xs bg-muted px-1.5 py-0.5 rounded">
                            x{link.quantity || 1}
                          </span>
                          <a href={link.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            {link.itemName || link.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {fundRequest.attachments && fundRequest.attachments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Attachments</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {fundRequest.attachments.map((file) => (
                        <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="bg-primary/10 p-1.5 rounded text-primary">
                            <Download className="w-4 h-4" />
                          </div>
                          <div className="text-sm truncate flex-1">{file.name}</div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Decisions */}
          <div className="w-full md:w-[320px] space-y-6 flex-shrink-0">
            <div>
              <h3 className="font-semibold mb-4">Decision</h3>
               <RadioGroup value={action} onValueChange={(v) => setAction(v as typeof action)} className="space-y-3">
                 <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
                   <RadioGroupItem value="approve" id="approve" />
                   <Label htmlFor="approve" className="flex-1 cursor-pointer font-medium">
                     <div className="flex items-center gap-2">
                       <CheckCircle className="w-4 h-4 text-green-600" />
                       Approve Request
                     </div>
                     <span className="text-xs text-muted-foreground font-normal">Authorize funding</span>
                   </Label>
                 </div>
                 <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
                   <RadioGroupItem value="needs_info" id="needs_info" />
                   <Label htmlFor="needs_info" className="flex-1 cursor-pointer font-medium">
                     <div className="flex items-center gap-2">
                       <AlertCircle className="w-4 h-4 text-yellow-600" />
                       Request More Info
                     </div>
                     <span className="text-xs text-muted-foreground font-normal">Ask user for details</span>
                   </Label>
                 </div>
                 <div className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-muted/50 cursor-pointer">
                   <RadioGroupItem value="deny" id="deny" />
                   <Label htmlFor="deny" className="flex-1 cursor-pointer font-medium">
                     <div className="flex items-center gap-2">
                       <XCircle className="w-4 h-4 text-destructive" />
                       Deny Request
                     </div>
                     <span className="text-xs text-muted-foreground font-normal">Reject this request</span>
                   </Label>
                 </div>
               </RadioGroup>
            </div>

            {action === "approve" && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <Select value={fundingSource} onValueChange={(v) => setFundingSource(v as FUNDING_SOURCE)}>
                  <Label>Funding Source</Label>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNDING_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {FUNDING_SOURCE_LABELS[source]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-2">
                  <Label>Approval Notes (Optional)</Label>
                  <Textarea
                    placeholder="Any internal notes or instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="bg-background"
                  />
                </div>
              </div>
            )}

            {action === "needs_info" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label>Information Requested *</Label>
                <Textarea
                  placeholder="What information is missing? Be specific."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  required
                  className="bg-background"
                />
              </div>
            )}

            {action === "deny" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <Label>Rejection Reason *</Label>
                <Textarea
                  placeholder="Why is this request being denied?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  required
                  className="bg-background"
                />
              </div>
            )}
          </div>
        </div>

        <Separator />

        <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-muted-foreground italic text-center sm:text-left">
            An email notification will be sent to the user.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              variant={
                action === "approve" ? "default" :
                  action === "deny" ? "destructive" : "secondary"
              }
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {!isSubmitting && <Send className="h-4 w-4 mr-2" />}
              {action === "approve" ? "Approve" :
                action === "deny" ? "Deny" : "Send Request"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
