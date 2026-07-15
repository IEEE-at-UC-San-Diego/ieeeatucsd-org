import type { Id } from "@convex/_generated/dataModel";
import { AlertTriangle, Check, Clock } from "lucide-react";

export type FundDepositStatus = "pending" | "verified" | "rejected";
export type DepositMethod = "cash" | "check" | "bank_transfer" | "other";
export type IeeeDepositSource =
	| "upp"
	| "section"
	| "region"
	| "global"
	| "society"
	| "other";

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
	pending: "bg-ds-amber-100 text-ds-amber-900 border-ds-amber-100",
	verified: "bg-ds-blue-100 text-ds-blue-700 border-ds-blue-100",
	rejected: "bg-ds-red-100 text-ds-red-800 border-ds-red-100",
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
