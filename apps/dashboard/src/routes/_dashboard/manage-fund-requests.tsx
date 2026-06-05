import { createFileRoute } from "@tanstack/react-router";
import { useAuthedQuery, useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Search,
  Settings,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ExternalLink,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { type ReactElement } from "react";
import { Pagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { sendNotification } from "@/lib/send-notification";
import { cn } from "@/lib/utils";
import {
  formatCurrencyUSD,
  formatDateDisplay,
  formatDateTimeDisplay,
} from "@/lib/formatters";
import BudgetManagementModal from "@/components/fund-requests/BudgetManagementModal";

export const Route = createFileRoute("/_dashboard/manage-fund-requests")({
  component: ManageFundRequestsPage,
});

const ITEMS_PER_PAGE = 10;

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800",
  needs_info: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  completed: "bg-purple-100 text-purple-800",
};

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  needs_info: "Needs Info",
  approved: "Approved",
  denied: "Denied",
  completed: "Completed",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  events: "Events",
  projects: "Projects",
  internal: "Internal",
  other: "Other",
};

const STATUS_ICONS: Record<string, ReactElement> = {
  submitted: <Clock className="w-3.5 h-3.5" />,
  needs_info: <AlertCircle className="w-3.5 h-3.5" />,
  approved: <CheckCircle className="w-3.5 h-3.5" />,
  denied: <XCircle className="w-3.5 h-3.5" />,
  completed: <CheckCircle className="w-3.5 h-3.5" />,
};

const FUND_SOURCE_LABELS: Record<string, string> = {
  ece: "ECE Department",
  ieee: "IEEE Funding",
  other: "Other",
};

interface FundRequestData {
  _id: string;
  title: string;
  purpose: string;
  amount: number;
  category: string;
  department: string;
  status: string;
  fundSource?: "ece" | "ieee" | "other";
  submittedByName?: string;
  submittedByEmail?: string;
  createdAt?: number;
  submittedAt?: number;
  vendorLinks?: Array<{ id: string; url: string; itemName?: string }>;
  attachments?: Array<{ id: string; url: string; name: string; size: number }>;
  reviewNotes?: string;
  infoRequestNotes?: string;
  auditLogs?: Array<{
    id: string;
    action: string;
    performedBy: string;
    performedByName?: string;
    timestamp: number;
    newStatus?: string;
    notes?: string;
  }>;
}

// Detail View Component
function FundRequestDetailView({
  request,
  onBack,
  logtoId,
  authHeaders,
}: {
  request: FundRequestData;
  onBack: () => void;
  logtoId: string;
  authHeaders: Record<string, string>;
}) {
  const updateStatus = useAuthedMutation(api.fundRequests.updateStatus);
  const updateFundSource = useAuthedMutation(api.fundRequests.updateFundSource);

  const [selectedStatus, setSelectedStatus] = useState<string>("approve");
  const [selectedFundSource, setSelectedFundSource] = useState<string>(
    request.fundSource || "other",
  );
  const [reviewNotes, setReviewNotes] = useState(request.reviewNotes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!logtoId) return;

    setIsSubmitting(true);
    try {
      const statusToSet =
        selectedStatus === "approve"
          ? "approved"
          : selectedStatus === "deny"
            ? "denied"
            : "needs_info";

      // Update status if changed
      const statusChanged = statusToSet !== request.status;
      const fundSourceChanged = selectedFundSource !== request.fundSource;
      const notesChanged = reviewNotes !== request.reviewNotes;

      if (!statusChanged && !fundSourceChanged && !notesChanged) {
        toast.info("No changes to save");
        return;
      }

      // Update fund source first if changed
      if (fundSourceChanged) {
        await updateFundSource({
          logtoId,
          id: request._id as any,
          fundSource: selectedFundSource as "ece" | "ieee" | "other",
        });
      }

      // Update status and notes if status changed
      if (statusChanged || notesChanged) {
        await updateStatus({
          logtoId,
          id: request._id as any,
          status: statusToSet as any,
          reviewNotes: notesChanged ? reviewNotes : undefined,
        });
      }

      // Send email notification for status changes
      if (statusChanged) {
        sendNotification(authHeaders, "fund_request_status_changed", {
          requestId: request._id,
          title: request.title,
          amount: request.amount,
          newStatus: statusToSet,
          previousStatus: request.status,
          reviewNotes: reviewNotes || undefined,
          selectedFundingSource: selectedFundSource,
          submitterName: request.submittedByName,
          submitterEmail: request.submittedByEmail,
        });
      }

      toast.success("Request updated successfully");
      onBack();
    } catch (error: any) {
      toast.error(error.message || "Failed to update request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-muted/30 border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold truncate" title={request.title}>
                {request.title}
              </h2>
              <Badge
                className={cn("shrink-0", STATUS_COLORS[request.status] || "")}
                variant="secondary"
              >
                <span className="mr-1">{STATUS_ICONS[request.status]}</span>
                {STATUS_LABELS[request.status]}
              </Badge>
              {request.fundSource && (
                <Badge variant="outline" className="shrink-0">
                  {FUND_SOURCE_LABELS[request.fundSource]}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground flex-wrap">
              {request.submittedByName && (
                <>
                  <span className="font-medium text-foreground">{request.submittedByName}</span>
                  <span className="text-muted-foreground/40">·</span>
                </>
              )}
              <span className="capitalize">{DEPARTMENT_LABELS[request.department] || request.department}</span>
              <span className="text-muted-foreground/40">·</span>
              <span>{formatDateTimeDisplay(request.createdAt || Date.now())}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
            Requested Amount
          </p>
          <p className="text-xl font-bold tabular-nums">{formatCurrencyUSD(request.amount)}</p>
        </div>
      </div>

      {/* Content - Split Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 min-h-0 overflow-hidden">
        {/* Left Panel: Details & Actions (5/12) */}
        <div className="lg:col-span-5 border-r border-gray-200 overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Officer Actions Section */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold border-b pb-2 uppercase tracking-wide text-muted-foreground">
                Officer Actions
              </h3>

              {/* Fund Source Selection */}
              <div className="space-y-2">
                <Label htmlFor="fundSource">Fund Source</Label>
                <Select value={selectedFundSource} onValueChange={setSelectedFundSource}>
                  <SelectTrigger id="fundSource">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ece">ECE Department</SelectItem>
                    <SelectItem value="ieee">IEEE Funding</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Actions */}
              <div className="space-y-2">
                <Label>Status Action</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 border-green-200 text-green-700 hover:bg-green-50",
                      selectedStatus === "approve" &&
                        "bg-green-100 border-green-300"
                    )}
                    onClick={() => setSelectedStatus("approve")}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 border-yellow-200 text-yellow-700 hover:bg-yellow-50",
                      selectedStatus === "needs_info" &&
                        "bg-yellow-100 border-yellow-300"
                    )}
                    onClick={() => setSelectedStatus("needs_info")}
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Needs Info
                  </Button>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 border-red-200 text-red-700 hover:bg-red-50",
                      selectedStatus === "deny" &&
                        "bg-red-100 border-red-300"
                    )}
                    onClick={() => setSelectedStatus("deny")}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Deny
                  </Button>
                </div>
              </div>

              {/* Review Notes */}
              <div className="space-y-2">
                <Label htmlFor="reviewNotes">Review Notes</Label>
                <Textarea
                  id="reviewNotes"
                  placeholder="Add comments or notes for the requester..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={isSubmitting}
                className="w-full"
                size="lg"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </section>

            {/* Request Details */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold border-b pb-2 uppercase tracking-wide text-muted-foreground">
                Request Details
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Title</p>
                  <p className="font-medium">{request.title}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Purpose</p>
                  <p className="text-sm">{request.purpose}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs">Category</p>
                    <p className="font-medium capitalize">{request.category}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Department</p>
                    <p className="font-medium">{DEPARTMENT_LABELS[request.department] || request.department}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Amount</p>
                    <p className="font-medium">{formatCurrencyUSD(request.amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Submitted On</p>
                    <p className="font-medium">{formatDateDisplay(request.submittedAt || request.createdAt)}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Vendor Links */}
            {request.vendorLinks && request.vendorLinks.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-bold border-b pb-2 uppercase tracking-wide text-muted-foreground">
                  Purchase Links
                </h3>
                <div className="space-y-2">
                  {request.vendorLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline p-2 rounded hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{link.itemName || link.url}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Existing Review Notes */}
            {(request.reviewNotes || request.infoRequestNotes) && (
              <section className="space-y-3">
                <h3 className="text-xs font-bold border-b pb-2 uppercase tracking-wide text-muted-foreground">
                  Previous Review Notes
                </h3>
                <div className="text-sm bg-muted/50 p-3 rounded-lg">
                  <p>{request.reviewNotes || request.infoRequestNotes}</p>
                </div>
              </section>
            )}

            {/* Audit Log */}
            {request.auditLogs && request.auditLogs.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-xs font-bold border-b pb-2 uppercase tracking-wide text-muted-foreground">
                  Audit Log
                </h3>
                <div className="space-y-2">
                  {request.auditLogs.map((entry) => (
                    <div
                      key={entry.id}
                      className="text-sm p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{entry.action.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTimeDisplay(entry.timestamp)}
                        </span>
                      </div>
                      {entry.performedByName && (
                        <p className="text-xs text-muted-foreground mt-1">by {entry.performedByName}</p>
                      )}
                      {entry.newStatus && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Status: {STATUS_LABELS[entry.newStatus] || entry.newStatus}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Right Panel: Attachments/Documents (7/12) */}
        <div className="lg:col-span-7 bg-muted/20 min-h-[500px] lg:min-h-0 overflow-y-auto">
          <div className="p-5">
            {/* Attachments Section */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold border-b pb-2 uppercase tracking-wide text-muted-foreground">
                Attachments
              </h3>
              {request.attachments && request.attachments.length > 0 ? (
                <div className="space-y-2">
                  {request.attachments.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No attachments</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManageFundRequestsPage() {
  const { hasOfficerAccess, hasAdminAccess, logtoId, getAuthHeaders, isLoading } = usePermissions();
  const allRequests = useAuthedQuery(
    api.fundRequests.listAll,
    logtoId ? { logtoId } : "skip",
  );

  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [expandedRequestId] = useState<string | null>(null);

  const selectedRequest = (allRequests || []).find((r) => r._id === selectedRequestId);

  const handleViewDetail = (request: FundRequestData) => {
    setSelectedRequestId(request._id);
    setView("detail");
  };

  const handleBackToList = () => {
    setView("list");
    setSelectedRequestId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasOfficerAccess) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        You don't have permission to access this page.
      </div>
    );
  }

  // Detail view
  if (view === "detail" && selectedRequest && logtoId) {
    return (
      <div className="w-full h-full">
        <FundRequestDetailView
          request={selectedRequest}
          onBack={handleBackToList}
          logtoId={logtoId}
          authHeaders={getAuthHeaders()}
        />
      </div>
    );
  }

  const filteredRequests = (allRequests || [])
    .filter((r) => r.status !== "draft")
    .filter((r) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.submittedByName && r.submittedByName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        r.amount.toString().includes(searchQuery);
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesDepartment = departmentFilter === "all" || r.department === departmentFilter;
      return matchesSearch && matchesStatus && matchesDepartment;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  const getStats = () => {
    const pendingCount = filteredRequests.filter((r) => r.status === "submitted").length;
    const needsInfoCount = filteredRequests.filter((r) => r.status === "needs_info").length;
    const pendingValue = filteredRequests
      .filter((r) => r.status === "submitted")
      .reduce((sum, r) => sum + r.amount, 0);
    const approvedValue = filteredRequests
      .filter((r) => r.status === "approved" || r.status === "completed")
      .reduce((sum, r) => sum + r.amount, 0);

    return { pendingCount, needsInfoCount, pendingValue, approvedValue };
  };

  const stats = getStats();

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manage Fund Requests</h1>
          <p className="text-muted-foreground">
            Review and manage funding requests from all departments.
          </p>
        </div>
        {hasAdminAccess && (
          <Button variant="outline" onClick={() => setIsBudgetModalOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configure Budgets
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pending Review</p>
              <p className="text-xl font-bold mt-1 text-blue-600">{stats.pendingCount}</p>
            </div>
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Needs Information</p>
              <p className="text-xl font-bold mt-1 text-orange-600">{stats.needsInfoCount}</p>
            </div>
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pending Amount</p>
              <p className="text-xl font-bold mt-1 text-gray-900">{formatCurrencyUSD(stats.pendingValue)}</p>
            </div>
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Approved</p>
              <p className="text-xl font-bold mt-1 text-green-600">{formatCurrencyUSD(stats.approvedValue)}</p>
            </div>
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
          >
            All
          </Button>
          <Button
            variant={statusFilter === "submitted" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter("submitted");
              setPage(1);
            }}
          >
            Submitted
          </Button>
          <Button
            variant={statusFilter === "needs_info" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter("needs_info");
              setPage(1);
            }}
          >
            Needs Info
          </Button>
          <Button
            variant={statusFilter === "approved" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter("approved");
              setPage(1);
            }}
          >
            Approved
          </Button>
          <Button
            variant={statusFilter === "denied" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter("denied");
              setPage(1);
            }}
          >
            Denied
          </Button>
          <Button
            variant={statusFilter === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter("completed");
              setPage(1);
            }}
          >
            Completed
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap border-l pl-3">
          <Button
            variant={departmentFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setDepartmentFilter("all");
              setPage(1);
            }}
          >
            All Depts
          </Button>
          <Button
            variant={departmentFilter === "events" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setDepartmentFilter("events");
              setPage(1);
            }}
          >
            Events
          </Button>
          <Button
            variant={departmentFilter === "projects" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setDepartmentFilter("projects");
              setPage(1);
            }}
          >
            Projects
          </Button>
          <Button
            variant={departmentFilter === "internal" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setDepartmentFilter("internal");
              setPage(1);
            }}
          >
            Internal
          </Button>
          <Button
            variant={departmentFilter === "other" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setDepartmentFilter("other");
              setPage(1);
            }}
          >
            Other
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {!allRequests ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : paginatedRequests.length > 0 ? (
          <div className="divide-y">
            {paginatedRequests.map((request) => {
              const isExpanded = expandedRequestId === request._id;
              return (
                <div key={request._id}>
                  <div
                    className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleViewDetail(request as FundRequestData)}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Request Info */}
                      <div className="col-span-12 md:col-span-4 min-w-0">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm">{request.title}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {request.purpose}
                          </span>
                        </div>
                      </div>

                      {/* Requester */}
                      <div className="col-span-6 md:col-span-2">
                        <div className="text-sm">
                          <div className="font-medium text-xs">{request.submittedByName || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{formatDateDisplay(request.createdAt || Date.now())}</div>
                        </div>
                      </div>

                      {/* Department */}
                      <div className="col-span-6 md:col-span-2">
                        <Badge variant="outline" className="capitalize text-xs">
                          {DEPARTMENT_LABELS[request.department] || request.department}
                        </Badge>
                      </div>

                      {/* Amount */}
                      <div className="col-span-4 md:col-span-1">
                        <span className="font-semibold text-sm">{formatCurrencyUSD(request.amount)}</span>
                      </div>

                      {/* Status */}
                      <div className="col-span-4 md:col-span-2">
                        <Badge className={STATUS_COLORS[request.status] || ""} variant="secondary">
                          <span className="mr-1">{STATUS_ICONS[request.status]}</span>
                          {STATUS_LABELS[request.status]}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="col-span-8 md:col-span-1 flex justify-end">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetail(request as FundRequestData);
                            }}
                          >
                            <ArrowLeft className="h-4 w-4 rotate-180" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground mt-2" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground mt-2" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-4 bg-muted/30 border-t">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Request ID</p>
                          <p className="font-mono text-xs">{request._id.slice(0, 8)}...</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Requester Email</p>
                          <p className="font-medium">{request.submittedByEmail || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Category</p>
                          <p className="font-medium capitalize">{request.category}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Submitted</p>
                          <p className="font-medium">{new Date(request.createdAt || Date.now()).toLocaleString()}</p>
                        </div>
                      </div>

                      {request.vendorLinks && request.vendorLinks.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">Purchase Links</p>
                          <div className="flex flex-wrap gap-2">
                            {request.vendorLinks.map((link) => (
                              <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                {link.itemName || link.url}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {request.attachments && request.attachments.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            Attachments ({request.attachments.length})
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {request.attachments.map((file) => (
                              <a
                                key={file.id}
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                {file.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {(request.reviewNotes || request.infoRequestNotes) && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground mb-1">Review Notes</p>
                          <p className="text-sm">{request.reviewNotes || request.infoRequestNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            No requests found matching your filters.
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex justify-center">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Modals */}
      {logtoId && (
        <BudgetManagementModal
          isOpen={isBudgetModalOpen}
          onClose={() => setIsBudgetModalOpen(false)}
          logtoId={logtoId}
        />
      )}
    </div>
  );
}
