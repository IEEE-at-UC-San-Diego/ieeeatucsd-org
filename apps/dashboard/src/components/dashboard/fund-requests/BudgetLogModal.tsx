import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, DollarSign, User, Calendar, Wrench } from "lucide-react";
import { formatCurrency, formatDate, type FundRequestDepartment } from "@/types/fund-requests";
import { DEPARTMENT_LABELS, STATUS_COLORS, STATUS_LABELS } from "@/types/fund-requests";

interface FundRequestLog {
  _id: string;
  title: string;
  submittedByName?: string;
  amount: number;
  status: string;
  _creationTime: number;
}

interface BudgetAdjustment {
  _id: string;
  description: string;
  createdByName?: string;
  amount: number;
  createdAt: number;
}

interface BudgetLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: FundRequestDepartment;
  requests: FundRequestLog[];
  adjustments: BudgetAdjustment[];
  budgetStartDate?: Date;
  isLoading?: boolean;
}

type TabValue = "all" | "approved" | "pending" | "adjustments";

export function BudgetLogModal({
  isOpen,
  onClose,
  department,
  requests,
  adjustments,
  budgetStartDate,
  isLoading = false,
}: BudgetLogModalProps) {
  const [selectedTab, setSelectedTab] = useState<TabValue>("all");

  const getFilteredRequests = (): FundRequestLog[] => {
    switch (selectedTab) {
      case "approved":
        return requests.filter((r) => r.status === "approved" || r.status === "completed");
      case "pending":
        return requests.filter((r) => r.status === "submitted" || r.status === "needs_info");
      case "adjustments":
        return [];
      default:
        return requests;
    }
  };

  const filteredRequests = getFilteredRequests();

  const adjustmentsTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);

  const stats = {
    approved:
      requests.filter((r) => r.status === "approved" || r.status === "completed").reduce(
        (sum, r) => sum + r.amount,
        0,
      ) + adjustmentsTotal,
    pending: requests
      .filter((r) => r.status === "submitted" || r.status === "needs_info")
      .reduce((sum, r) => sum + r.amount, 0),
    total: requests.reduce((sum, r) => sum + r.amount, 0) + adjustmentsTotal,
    adjustmentsTotal,
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{DEPARTMENT_LABELS[department]} Budget Log</DialogTitle>
          <DialogDescription className="sr-only">
            View budget history, approved requests, and manual adjustments
          </DialogDescription>
          {budgetStartDate && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                Since {budgetStartDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border bg-green-50/50 p-4">
                  <div className="flex items-center gap-2 mb-2 text-green-600">
                    <User className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Approved</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(stats.approved)}</p>
                </div>
                <div className="rounded-xl border bg-yellow-50/50 p-4">
                  <div className="flex items-center gap-2 mb-2 text-yellow-600">
                    <Loader2 className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Pending</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-700">{formatCurrency(stats.pending)}</p>
                </div>
                <div className="rounded-xl border bg-muted p-4">
                  <div className="flex items-center gap-2 mb-2 text-foreground">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wide">Total</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.total)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as TabValue)}>
                  <TabsList>
                    <TabsTrigger value="all">All ({requests.length + adjustments.length})</TabsTrigger>
                    <TabsTrigger value="approved">
                      Approved ({requests.filter((r) => r.status === "approved" || r.status === "completed").length})
                    </TabsTrigger>
                    <TabsTrigger value="pending">
                      Pending ({requests.filter((r) => r.status === "submitted" || r.status === "needs_info").length})
                    </TabsTrigger>
                    <TabsTrigger value="adjustments">Adjustments ({adjustments.length})</TabsTrigger>
                  </TabsList>

                             {/* Requests Table */}
                   {selectedTab !== "adjustments" && (
                      <TabsContent value={selectedTab} className="mt-4">
                        {filteredRequests.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <div className="p-4 bg-muted rounded-full mb-3">
                              <DollarSign className="w-6 h-6" />
                            </div>
                            <p>No requests found for this period.</p>
                          </div>
                        ) : (
                          <div className="rounded-xl border overflow-hidden bg-card">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-left">Request</TableHead>
                                  <TableHead className="text-left">Requester</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                                  <TableHead className="text-center">Status</TableHead>
                                  <TableHead className="text-right">Date</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredRequests.map((request) => (
                                  <TableRow key={request._id} className="hover:bg-muted/50">
                                    <TableCell className="font-medium text-sm truncate max-w-[200px]">{request.title}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                          <User className="w-3 h-3" />
                                        </div>
                                        <span className="text-sm text-muted-foreground">{request.submittedByName || "Unknown"}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className="font-bold text-green-600">{formatCurrency(request.amount)}</span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge className={STATUS_COLORS[request.status as keyof typeof STATUS_COLORS] || ""}>
                                        {STATUS_LABELS[request.status as keyof typeof STATUS_LABELS] || request.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">{formatDate(request._creationTime)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </TabsContent>
                    )}

                  {/* Adjustments Table */}
                  {(selectedTab === "all" || selectedTab === "adjustments") && (
                    <TabsContent value={selectedTab === "all" ? "all" : "adjustments"} className="mt-4">
                      {adjustments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <div className="p-4 bg-muted rounded-full mb-3">
                            <Wrench className="w-6 h-6" />
                          </div>
                          <p>No manual adjustments for this period.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedTab === "all" && (
                            <div className="flex items-center gap-2">
                              <Wrench className="w-4 h-4 text-yellow-600" />
                              <span className="text-sm font-semibold text-foreground">Manual Adjustments</span>
                            </div>
                          )}
                          <div className="rounded-xl border overflow-hidden bg-card">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-left">Description</TableHead>
                                  <TableHead className="text-left">Added By</TableHead>
                                  <TableHead className="text-right">Amount</TableHead>
                                  <TableHead className="text-right">Date</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {adjustments.map((adjustment) => (
                                  <TableRow key={adjustment._id} className="hover:bg-muted/50">
                                    <TableCell>
                                      <p className="font-semibold text-sm text-foreground">{adjustment.description}</p>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                          <User className="w-3 h-3" />
                                        </div>
                                        <span className="text-sm text-muted-foreground">{adjustment.createdByName || "Unknown"}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className="font-bold text-yellow-600">
                                        {formatCurrency(adjustment.amount)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right text-sm text-muted-foreground">{formatDate(adjustment.createdAt)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
