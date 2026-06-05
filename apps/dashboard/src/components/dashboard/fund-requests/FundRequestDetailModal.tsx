import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Calendar,
  FileText,
  ExternalLink,
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Eye,
  Briefcase,
  Tag,
  History,
  Link as LinkIcon,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, type FundRequestStatus } from "@/types/fund-requests";
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, DEPARTMENT_LABELS } from "@/types/fund-requests";

const getStatusIcon = (status: FundRequestStatus) => {
  switch (status) {
    case "draft":
      return <FileText className="w-3.5 h-3.5" />;
    case "submitted":
      return <Clock className="w-3.5 h-3.5" />;
    case "needs_info":
      return <AlertCircle className="w-3.5 h-3.5" />;
    case "approved":
      return <CheckCircle className="w-3.5 h-3.5" />;
    case "denied":
      return <XCircle className="w-3.5 h-3.5" />;
    case "completed":
      return <CheckCircle className="w-3.5 h-3.5" />;
    default:
      return <FileText className="w-3.5 h-3.5" />;
  }
};

interface VendorLink {
  id: string;
  url: string;
  itemName?: string;
  quantity?: number;
}

interface FundRequestAttachment {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
}

interface FundRequestAuditLog {
  id: string;
  action: string;
  performedBy: string;
  performedByName?: string;
  timestamp: number;
  notes?: string;
  previousStatus?: string;
  newStatus?: string;
}

interface FundRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: {
    _id: string;
    title: string;
    purpose: string;
    category: string;
    department?: string;
    amount: number;
    status: FundRequestStatus;
    submittedByName?: string;
    submittedByEmail?: string;
    createdAt: number;
    submittedAt?: number;
    reviewNotes?: string;
    infoRequestNotes?: string;
    infoResponseNotes?: string;
    vendorLinks?: VendorLink[];
    attachments?: FundRequestAttachment[];
    auditLogs?: FundRequestAuditLog[];
    [key: string]: unknown;
  } | null;
  onEdit?: () => void;
}

export function FundRequestDetailModal({ isOpen, onClose, request, onEdit }: FundRequestDetailModalProps) {
  if (!request) return null;

  const canEdit = request.status === "draft" || request.status === "needs_info";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{request.title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Created on {formatDate(request.createdAt)}
          </DialogDescription>
          {request && (
            <div className="flex items-center gap-2 mt-1.5 h-6">
              <Badge className={`${STATUS_COLORS[request.status]} px-2 py-0.5 h-full`} variant="secondary">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  {getStatusIcon(request.status)}
                  {STATUS_LABELS[request.status]}
                </span>
              </Badge>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Alerts for Needs Info / Denied / Approved */}
            {request.status === "needs_info" && request.infoRequestNotes && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 flex flex-row gap-3">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800 text-sm mb-0.5">
                    Information Requested
                  </h4>
                  <p className="text-xs text-yellow-700 leading-relaxed">
                    {request.infoRequestNotes}
                  </p>
                </div>
              </div>
            )}

            {request.status === "denied" && request.reviewNotes && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-row gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-800 text-sm mb-1">Request Denied</h4>
                  <p className="text-sm text-red-700 leading-relaxed">{request.reviewNotes}</p>
                </div>
              </div>
            )}

            {request.status === "approved" && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex flex-row gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-800 text-sm mb-1">Request Approved</h4>
                  <div className="space-y-1">
                    {request.reviewNotes && <p className="text-sm text-green-700 leading-relaxed">{request.reviewNotes}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Purpose */}
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Purpose
              </h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 p-3 rounded-lg border">
                {request.purpose}
              </p>
            </div>

            {request.infoResponseNotes && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-yellow-600 uppercase tracking-wide flex items-center gap-2">
                  <Briefcase className="w-4 h-4" /> Additional Context
                </h3>
                <div className="bg-yellow-50/30 p-4 rounded-xl border border-yellow-100">
                  <p className="text-xs font-semibold text-yellow-700 mb-2">Response to Info Request:</p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{request.infoResponseNotes}</p>
                </div>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-muted/50">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Amount
                </span>
                <div className="flex items-center gap-1 mt-0.5 text-green-600 font-bold text-base">
                  {formatCurrency(request.amount)}
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-background">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Department
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 text-sm font-medium text-foreground">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                  {request.department
                    ? DEPARTMENT_LABELS[
                    request.department as keyof typeof DEPARTMENT_LABELS
                    ]
                    : "N/A"}
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-background">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Category
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 text-sm font-medium text-foreground">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  {
                    CATEGORY_LABELS[
                    request.category as keyof typeof CATEGORY_LABELS
                    ]
                  }
                </div>
              </div>
              <div className="p-3 rounded-lg border bg-background">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Submitted
                </span>
                <div className="flex items-center gap-1.5 mt-0.5 text-sm font-medium text-foreground">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  {formatDate(request.createdAt)}
                </div>
              </div>
            </div>

            {/* Vendor Links & Attachments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5" /> Links
                </h3>
                {request.vendorLinks && request.vendorLinks.length > 0 ? (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="h-8 hover:bg-transparent">
                          <TableHead className="h-8 py-0 text-[10px] font-semibold uppercase w-[60px]">
                            Qty
                          </TableHead>
                          <TableHead className="h-8 py-0 text-[10px] font-semibold uppercase">
                            Item / URL
                          </TableHead>
                          <TableHead className="h-8 py-0 w-[30px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {request.vendorLinks.map((link) => (
                          <TableRow key={link.id} className="h-9 hover:bg-muted/30">
                            <TableCell className="py-1 font-medium text-xs">
                              x{link.quantity || 1}
                            </TableCell>
                            <TableCell className="py-1">
                              <div className="flex flex-col">
                                {link.itemName && (
                                  <span className="text-xs font-medium truncate max-w-[200px]">
                                    {link.itemName}
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                  {link.url}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-1 text-right">
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center h-6 w-6 rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No links provided.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Attachments
                </h3>
                {request.attachments && request.attachments.length > 0 ? (
                  <div className="space-y-1.5">
                    {request.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="group flex items-center justify-between p-1.5 rounded-lg border bg-card hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded bg-muted text-muted-foreground">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate max-w-[140px]">
                              {attachment.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {(attachment.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            asChild
                          >
                            <a
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye className="w-3 h-3" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            asChild
                          >
                            <a href={attachment.url} download={attachment.name}>
                              <Download className="w-3 h-3" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No attachments.
                  </p>
                )}
              </div>
            </div>

            {/* Audit Trail */}
            {request.auditLogs && request.auditLogs.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <History className="w-3.5 h-3.5" /> Activity History
                </h3>
                <div className="space-y-0 pl-2">
                  {request.auditLogs.map((log, _index) => (
                    <div
                      key={log.id}
                      className="relative pl-5 pb-5 last:pb-0 border-l border-border/60 last:border-l-0"
                    >
                      <div className="absolute top-0.5 left-0 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-background bg-muted-foreground/30 z-10 box-content" />
                      <div className="flex flex-col gap-0.5 -mt-1">
                        <p className="text-xs font-medium text-foreground">
                          <span className="capitalize">
                            {log.action.replace(/_/g, " ")}
                          </span>
                          {log.performedByName && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              by {log.performedByName}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(log.timestamp)}
                        </p>
                        {log.notes && (
                          <p className="text-xs text-foreground bg-muted/40 px-2 py-1 rounded inline-block mt-1">
                            {log.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t bg-background">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {canEdit && onEdit && (
            <Button onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              {request.status === "needs_info" ? "Respond & Resubmit" : "Edit Request"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
