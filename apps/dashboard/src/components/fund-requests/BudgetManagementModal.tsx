import { useState, useEffect } from "react";
import { useAuthedQuery, useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Trash2, Loader2, DollarSign, Calendar, Briefcase } from "lucide-react";
import { toast } from "sonner";

const DEPARTMENTS = [
  { value: "events", label: "Events" },
  { value: "projects", label: "Projects" },
  { value: "internal", label: "Internal" },
  { value: "other", label: "Other" },
] as const;

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatDateForInput = (timestamp: number): string => {
  return new Date(timestamp).toISOString().split("T")[0];
};

interface BudgetManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  logtoId: string;
}

export default function BudgetManagementModal({
  isOpen,
  onClose,
  logtoId,
}: BudgetManagementModalProps) {
  const [selectedDepartment, setSelectedDepartment] =
    useState<(typeof DEPARTMENTS)[number]["value"]>("events");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [startDate, setStartDate] = useState("");

  const [newAdjustmentAmount, setNewAdjustmentAmount] = useState("");
  const [newAdjustmentDescription, setNewAdjustmentDescription] = useState("");
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isAddingAdjustment, setIsAddingAdjustment] = useState(false);

  const budgetConfigs = useAuthedQuery(api.fundRequests.getAllBudgetConfigs, logtoId ? { logtoId } : "skip");
  const budgetAdjustments = useAuthedQuery(
    api.fundRequests.getBudgetAdjustments,
    logtoId ? { logtoId, department: selectedDepartment } : "skip",
  );

  const updateBudgetConfig = useAuthedMutation(api.fundRequests.updateBudgetConfig);
  const createBudgetAdjustment = useAuthedMutation(api.fundRequests.createBudgetAdjustment);
  const deleteBudgetAdjustment = useAuthedMutation(api.fundRequests.deleteBudgetAdjustment);

  const currentConfig = budgetConfigs?.find(
    (c) => c.department === selectedDepartment,
  );

  useEffect(() => {
    if (currentConfig) {
      setBudgetAmount(currentConfig.totalBudget.toString());
      setStartDate(formatDateForInput(currentConfig.startDate));
    } else {
      setBudgetAmount("");
      setStartDate("");
    }
  }, [selectedDepartment, currentConfig]);

  const handleSaveBudget = async () => {
    if (!logtoId) return;
    const amount = parseFloat(budgetAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid budget amount");
      return;
    }
    if (!startDate) {
      toast.error("Please select a start date");
      return;
    }

    setIsSavingBudget(true);
    try {
      await updateBudgetConfig({
        logtoId,
        department: selectedDepartment,
        totalBudget: amount,
        startDate: new Date(startDate).getTime(),
      });
      toast.success(`${DEPARTMENTS.find((d) => d.value === selectedDepartment)?.label} budget updated`);
    } catch (error: any) {
      toast.error("Failed to save budget configuration");
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleAddAdjustment = async () => {
    if (!logtoId) return;
    const amount = parseFloat(newAdjustmentAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid adjustment amount");
      return;
    }
    if (!newAdjustmentDescription.trim()) {
      toast.error("Please enter a description for the adjustment");
      return;
    }

    setIsAddingAdjustment(true);
    try {
      await createBudgetAdjustment({
        logtoId,
        department: selectedDepartment,
        amount,
        description: newAdjustmentDescription.trim(),
      });
      setNewAdjustmentAmount("");
      setNewAdjustmentDescription("");
      toast.success("Budget adjustment added");
    } catch (error: any) {
      toast.error("Failed to add budget adjustment");
    } finally {
      setIsAddingAdjustment(false);
    }
  };

  const handleDeleteAdjustment = async (id: Id<"budgetAdjustments">) => {
    if (!logtoId) return;
    try {
      await deleteBudgetAdjustment({ logtoId, id });
      toast.success("Adjustment deleted");
    } catch (error: any) {
      toast.error("Failed to delete adjustment");
    }
  };

  const totalAdjustments = budgetAdjustments?.reduce((sum, adj) => sum + adj.amount, 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Budget Management
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Tabs
            value={selectedDepartment}
            onValueChange={(v) =>
              setSelectedDepartment(v as (typeof DEPARTMENTS)[number]["value"])
            }
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              {DEPARTMENTS.slice(0, 3).map((dept) => (
                <TabsTrigger key={dept.value} value={dept.value} className="text-sm">
                  {dept.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold mb-3">Budget Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budgetAmount">Total Budget</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="budgetAmount"
                      type="number"
                      step="0.01"
                      placeholder="5000.00"
                      value={budgetAmount}
                      onChange={(e) => {
                        const sanitized = e.target.value.replace(/[^0-9.]/g, "");
                        setBudgetAmount(sanitized);
                      }}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Budget Start Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveBudget} disabled={isSavingBudget}>
                  {isSavingBudget && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Configuration
                </Button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
               <div className="flex items-center justify-between">
                 <div>
                   <h3 className="text-sm font-semibold">Manual Adjustments</h3>
                   <p className="text-xs text-muted-foreground">
                     External expenses counting against budget
                   </p>
                 </div>
                 {totalAdjustments > 0 && (
                   <span className="text-sm font-semibold text-orange-600">
                     Total: {formatCurrency(totalAdjustments)}
                   </span>
                 )}
               </div>

              <div className="flex gap-2 items-start">
                <div className="relative w-32">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newAdjustmentAmount}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(/[^0-9.]/g, "");
                      setNewAdjustmentAmount(sanitized);
                    }}
                    className="pl-9"
                  />
                </div>
                <Input
                  placeholder="e.g. Catering for Fall GBM"
                  value={newAdjustmentDescription}
                  onChange={(e) => setNewAdjustmentDescription(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="icon"
                  onClick={handleAddAdjustment}
                  disabled={isAddingAdjustment}
                >
                  {isAddingAdjustment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-lg">+</span>
                  )}
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {budgetAdjustments && budgetAdjustments.length > 0 ? (
                  budgetAdjustments.map((adj) => (
                    <Card key={adj._id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{adj.description}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="bg-muted px-2 py-0.5 rounded">
                              {formatDateForInput(adj.createdAt)}
                            </span>
                            <span>by {adj.createdByName || "Unknown"}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          <span className="font-semibold text-orange-600">
                            {formatCurrency(adj.amount)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteAdjustment(adj._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No manual adjustments recorded.
                  </p>
                )}
              </div>
            </div>
          </div>
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
