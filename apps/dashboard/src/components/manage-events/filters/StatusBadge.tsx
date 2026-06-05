import { Badge } from "@/components/ui/badge";
import type { EventStatus } from "../types";

interface StatusBadgeProps {
  status: EventStatus;
  className?: string;
}

const statusStyles: Record<EventStatus, string> = {
  draft:
    "bg-gray-100 text-gray-800 border-gray-200",
  submitted:
    "bg-indigo-100 text-indigo-800 border-indigo-200",
  pending:
    "bg-yellow-100 text-yellow-800 border-yellow-200",
  needs_review:
    "bg-orange-100 text-orange-800 border-orange-200",
  approved:
    "bg-green-100 text-green-800 border-green-200",
  declined:
    "bg-red-100 text-red-800 border-red-200",
  published:
    "bg-pink-100 text-pink-800 border-pink-200",
};

const statusLabels: Record<EventStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending: "Pending",
  needs_review: "Needs Review",
  approved: "Approved",
  declined: "Declined",
  published: "Published",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium capitalize ${statusStyles[status]} ${className || ""}`}
    >
      {statusLabels[status]}
    </Badge>
  );
}
