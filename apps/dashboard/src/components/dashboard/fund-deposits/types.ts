import { Id } from "@convex/_generated/dataModel";
import { Clock, Check, AlertTriangle } from "lucide-react";

export type FundDepositStatus = "pending" | "verified" | "rejected";
export type DepositMethod = "cash" | "check" | "bank_transfer" | "other";
export type IeeeDepositSource = "upp" | "section" | "region" | "global" | "society" | "other";

export interface AuditLog {
    action: string;
    createdBy: string;
    createdByName?: string;
    timestamp: number;
    note?: string;
    previousData?: unknown;
    newData?: unknown;
}

export interface FundDeposit {
    _id: Id<"fundDeposits">;
    _creationTime: number;
    title: string;
    amount: number;
    depositDate: number;
    status: FundDepositStatus;
    depositedBy: string;
    depositedByName?: string;
    depositedByEmail?: string;
    depositMethod?: DepositMethod;
    otherDepositMethod?: string;
    purpose?: string;
    receiptFiles?: string[];
    description?: string;
    submittedAt?: number;
    verifiedBy?: string;
    verifiedByName?: string;
    verifiedAt?: number;
    notes?: string;
    rejectionReason?: string;
    auditLogs?: AuditLog[];
    referenceNumber?: string;
    source?: string;
    isIeeeDeposit?: boolean;
    ieeeDepositSource?: IeeeDepositSource;
    needsBankTransfer?: boolean;
    bankTransferInstructions?: string;
    bankTransferFiles?: string[];
    editedBy?: string;
    editedByName?: string;
    editedAt?: number;
}

export const STATUS_COLORS: Record<FundDepositStatus, string> = {
    pending:
        "bg-yellow-100 text-yellow-800 border-yellow-200",
    verified:
        "bg-blue-100 text-blue-800 border-blue-200",
    rejected:
        "bg-red-100 text-red-800 border-red-200",
};

export const STATUS_LABELS: Record<FundDepositStatus, string> = {
    pending: "Pending",
    verified: "Verified",
    rejected: "Rejected",
};

export const STATUS_ICONS: Record<FundDepositStatus, React.ElementType> = {
    pending: Clock,
    verified: Check,
    rejected: AlertTriangle,
};
