import React from "react";
import {
  ExternalLink,
  Edit,
  Trash2,
  Calendar,
  Link as LinkIcon,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { Link } from "../../../shared/types/firestore";
import { getCategoryColor } from "../utils/linkPermissions";
import { Timestamp } from "firebase/firestore";

interface LinkCardProps {
  link: Link & { id: string };
  canManage: boolean;
  onEdit: (link: Link & { id: string }) => void;
  onDelete: (linkId: string) => void;
}

export default function LinkCard({
  link,
  canManage,
  onEdit,
  onDelete,
}: LinkCardProps) {
  const categoryInfo = getCategoryColor(link.category);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Check publish/expire status (for officers)
  const now = Timestamp.now();
  const isScheduled =
    link.publishDate && link.publishDate.toMillis() > now.toMillis();
  const isExpired =
    link.expireDate && link.expireDate.toMillis() < now.toMillis();

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 p-5 h-full flex flex-col no-underline block"
    >
      {/* Dynamic colored accent at the top */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${categoryInfo.bgColor.replace(
          "bg-",
          "bg-gradient-to-r from-transparent via-"
        )} opacity-70`}
      />

      {/* Header with Title and Category - No Icon */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-gray-900 text-lg leading-tight group-hover:text-blue-600 transition-colors break-words line-clamp-2">
            {link.title}
          </h3>
          <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
        </div>

        <div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${categoryInfo.bgColor} ${categoryInfo.color} ${categoryInfo.borderColor}`}
          >
            {link.category}
          </span>
        </div>
      </div>

      {/* Description */}
      {link.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed">
          {link.description}
        </p>
      )}

      <div className="mt-auto space-y-3">
        {/* Short URL */}
        {link.shortUrl && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg w-fit max-w-full">
            <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">ieeeatucsd.org/{link.shortUrl}</span>
          </div>
        )}

        {/* Status Badges (for officers only) */}
        {canManage && (isScheduled || isExpired) && (
          <div className="flex flex-wrap gap-2">
            {isScheduled && (
              <div className="flex items-center gap-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                <span>Scheduled: {formatDateTime(link.publishDate)}</span>
              </div>
            )}
            {isExpired && (
              <div className="flex items-center gap-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Expired: {formatDateTime(link.expireDate)}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {(canManage || link.createdAt) && (
          <>
            <div className="h-px bg-gray-100 w-full" />
            <div className="flex items-center justify-between gap-2 pt-1 h-8">
              {/* Date */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium whitespace-nowrap overflow-hidden">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Added {formatDate(link.createdAt)}</span>
              </div>

              {/* Actions */}
              {canManage && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEdit(link);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit link"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(link.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </a>
  );
}

