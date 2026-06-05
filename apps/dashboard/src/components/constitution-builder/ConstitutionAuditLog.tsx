import React, { useState, useMemo, useCallback } from "react";
import { Clock, User, Search, Filter, Plus, Minus, Edit3, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConstitutionAuditEntry } from "./types";
import { formatDistanceToNow, format } from "date-fns";

interface ConstitutionAuditLogProps {
  constitutionId: string;
}

/**
 * Strips HTML tags and returns clean plain text.
 */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Truncates text to a max length with ellipsis.
 */
function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text || "";
  return text.slice(0, maxLen).trimEnd() + "…";
}

/**
 * Builds a human-readable summary of what changed between before and after values.
 */
function buildChangeSummary(entry: ConstitutionAuditEntry): string {
  const parts: string[] = [];
  const sectionType = entry.afterValue?.type || entry.beforeValue?.type || "section";
  const sectionTitle = entry.afterValue?.title || entry.beforeValue?.title || "Untitled";

  if (entry.changeType === "create") {
    return `Created new ${sectionType}: "${sectionTitle}"`;
  }
  if (entry.changeType === "delete") {
    return `Deleted ${sectionType}: "${sectionTitle}"`;
  }
  if (entry.changeType === "reorder") {
    return `Reordered ${sectionType}: "${sectionTitle}"`;
  }

  // Update — describe what changed
  if (entry.beforeValue?.title !== entry.afterValue?.title) {
    const before = entry.beforeValue?.title || "Untitled";
    const after = entry.afterValue?.title || "Untitled";
    parts.push(`Title: "${before}" → "${after}"`);
  }

  if (entry.beforeValue?.content !== entry.afterValue?.content) {
    const beforeClean = stripHtml(entry.beforeValue?.content || "");
    const afterClean = stripHtml(entry.afterValue?.content || "");
    if (!beforeClean && afterClean) {
      parts.push("Content added");
    } else if (beforeClean && !afterClean) {
      parts.push("Content removed");
    } else {
      parts.push("Content updated");
    }
  }

  if (parts.length === 0) {
    return `Updated ${sectionType}: "${sectionTitle}"`;
  }

  return parts.join(" · ");
}

export const ConstitutionAuditLog: React.FC<ConstitutionAuditLogProps> = ({
  constitutionId,
}) => {
  const auditLog = useQuery(api.constitutions.getAuditLog, {
    constitutionId: constitutionId as any,
  });

  const entries = auditLog || [];
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [changeTypeFilter, setChangeTypeFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const uniqueUsers = useMemo(() => {
    const users = new Set(entries.map((entry) => entry.userName));
    return Array.from(users).sort();
  }, [entries]);

  const searchInEntry = useCallback((entry: ConstitutionAuditEntry, query: string): boolean => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    const summary = buildChangeSummary(entry).toLowerCase();
    return (
      summary.includes(lowerQuery) ||
      entry.userName.toLowerCase().includes(lowerQuery) ||
      entry.changeType.toLowerCase().includes(lowerQuery) ||
      stripHtml(entry.beforeValue?.title || "").toLowerCase().includes(lowerQuery) ||
      stripHtml(entry.afterValue?.title || "").toLowerCase().includes(lowerQuery)
    );
  }, []);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch = searchInEntry(entry, debouncedSearchQuery);
      const matchesChangeType =
        changeTypeFilter === "all" || entry.changeType === changeTypeFilter;
      const matchesUser = userFilter === "all" || entry.userName === userFilter;
      return matchesSearch && matchesChangeType && matchesUser;
    });
  }, [entries, debouncedSearchQuery, changeTypeFilter, userFilter, searchInEntry]);

  const getChangeTypeIcon = (changeType: ConstitutionAuditEntry["changeType"]) => {
    switch (changeType) {
      case "create":
        return <Plus className="h-3.5 w-3.5 text-green-600" />;
      case "update":
        return <Edit3 className="h-3.5 w-3.5 text-blue-600" />;
      case "delete":
        return <Minus className="h-3.5 w-3.5 text-red-600" />;
      case "reorder":
        return <ArrowUpDown className="h-3.5 w-3.5 text-orange-600" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-gray-600" />;
    }
  };

  const getChangeTypeBadge = (changeType: ConstitutionAuditEntry["changeType"]) => {
    const variants: Record<string, string> = {
      create: "bg-green-50 text-green-700 border-green-200",
      update: "bg-blue-50 text-blue-700 border-blue-200",
      delete: "bg-red-50 text-red-700 border-red-200",
      reorder: "bg-orange-50 text-orange-700 border-orange-200",
    };
    return (
      <Badge variant="outline" className={`text-xs font-medium ${variants[changeType] || ""}`}>
        {changeType.charAt(0).toUpperCase() + changeType.slice(1)}
      </Badge>
    );
  };

  const formatRelativeTime = (timestamp: number) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  const formatFullTime = (timestamp: number) => {
    return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
  };

  if (entries.length === 0) {
    return (
      <Card className="border-0 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-gray-400" />
            Change History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-400">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No changes recorded yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-gray-400" />
          Change History
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          Read-only log of all constitution changes
        </p>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search changes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={changeTypeFilter} onValueChange={setChangeTypeFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="create">Created</SelectItem>
              <SelectItem value="update">Updated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
              <SelectItem value="reorder">Reordered</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-sm">
              <User className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {uniqueUsers.map((user) => (
                <SelectItem key={user} value={user}>
                  {user}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Entries */}
        <ScrollArea className="h-[500px]">
          <div className="space-y-1">
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No entries match your filters.
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <AuditEntryRow
                  key={entry.id}
                  entry={entry}
                  getChangeTypeIcon={getChangeTypeIcon}
                  getChangeTypeBadge={getChangeTypeBadge}
                  formatRelativeTime={formatRelativeTime}
                  formatFullTime={formatFullTime}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t text-xs text-gray-400">
          {filteredEntries.length === entries.length
            ? `${entries.length} total changes`
            : `${filteredEntries.length} of ${entries.length} changes`}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Individual audit entry row with expandable detail dialog.
 */
const AuditEntryRow: React.FC<{
  entry: ConstitutionAuditEntry;
  getChangeTypeIcon: (type: ConstitutionAuditEntry["changeType"]) => React.ReactNode;
  getChangeTypeBadge: (type: ConstitutionAuditEntry["changeType"]) => React.ReactNode;
  formatRelativeTime: (ts: number) => string;
  formatFullTime: (ts: number) => string;
}> = ({ entry, getChangeTypeIcon, getChangeTypeBadge, formatRelativeTime, formatFullTime }) => {
  const summary = useMemo(() => buildChangeSummary(entry), [entry]);

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50/80 transition-colors group">
      <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
        {getChangeTypeIcon(entry.changeType)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {getChangeTypeBadge(entry.changeType)}
          <span className="text-xs text-gray-500" title={formatFullTime(entry.timestamp)}>
            {formatRelativeTime(entry.timestamp)}
          </span>
          <span className="text-xs text-gray-400">
            by {entry.userName}
          </span>
        </div>

        <p className="text-sm text-gray-700 mt-0.5 leading-snug">
          {summary}
        </p>

        {(entry.beforeValue || entry.afterValue) && (
          <Dialog>
            <DialogTrigger asChild>
              <button className="text-xs text-blue-600 hover:text-blue-700 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                View details
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                  {getChangeTypeIcon(entry.changeType)}
                  Change Details
                </DialogTitle>
              </DialogHeader>
              <DetailContent entry={entry} formatFullTime={formatFullTime} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

/**
 * Clean detail content for the dialog — no raw HTML, human-readable.
 */
const DetailContent: React.FC<{
  entry: ConstitutionAuditEntry;
  formatFullTime: (ts: number) => string;
}> = ({ entry, formatFullTime }) => {
  const [expandedContent, setExpandedContent] = useState(false);

  const sectionType = entry.afterValue?.type || entry.beforeValue?.type || "section";
  const sectionTitle = entry.afterValue?.title || entry.beforeValue?.title || "Untitled";

  return (
    <div className="space-y-4 mt-2">
      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>{formatFullTime(entry.timestamp)}</span>
        <span>·</span>
        <span>by {entry.userName}</span>
      </div>

      {/* Section info */}
      <div className="bg-gray-50 rounded-lg px-3 py-2">
        <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">
          {sectionType}
        </div>
        <div className="text-sm font-medium text-gray-900">
          {sectionTitle}
        </div>
      </div>

      {/* Changes */}
      {entry.changeType === "create" && (
        <div className="space-y-2">
          {entry.afterValue?.content && (
            <ContentBlock
              label="Initial content"
              content={stripHtml(entry.afterValue.content)}
              expanded={expandedContent}
              onToggle={() => setExpandedContent(!expandedContent)}
              variant="green"
            />
          )}
        </div>
      )}

      {entry.changeType === "delete" && (
        <div className="space-y-2">
          {entry.beforeValue?.content && (
            <ContentBlock
              label="Deleted content"
              content={stripHtml(entry.beforeValue.content)}
              expanded={expandedContent}
              onToggle={() => setExpandedContent(!expandedContent)}
              variant="red"
            />
          )}
        </div>
      )}

      {entry.changeType === "update" && (
        <div className="space-y-3">
          {entry.beforeValue?.title !== entry.afterValue?.title && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Title changed</div>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-red-500 font-medium mt-0.5 shrink-0">Before</span>
                  <span className="text-sm text-gray-600 line-through">
                    {entry.beforeValue?.title || "Untitled"}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-green-600 font-medium mt-0.5 shrink-0">After</span>
                  <span className="text-sm text-gray-900 font-medium">
                    {entry.afterValue?.title || "Untitled"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {entry.beforeValue?.content !== entry.afterValue?.content && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Content changed</div>
              <ContentBlock
                label="Updated content"
                content={stripHtml(entry.afterValue?.content || "")}
                expanded={expandedContent}
                onToggle={() => setExpandedContent(!expandedContent)}
                variant="blue"
              />
            </div>
          )}
        </div>
      )}

      {entry.changeType === "reorder" && (
        <p className="text-sm text-gray-600">
          Section position was changed in the document.
        </p>
      )}
    </div>
  );
};

/**
 * Collapsible content block with truncation.
 */
const ContentBlock: React.FC<{
  label: string;
  content: string;
  expanded: boolean;
  onToggle: () => void;
  variant: "green" | "red" | "blue";
}> = ({ label: _label, content, expanded, onToggle, variant }) => {
  const MAX_LEN = 150;
  const needsTruncation = content.length > MAX_LEN;
  const displayText = expanded ? content : truncate(content, MAX_LEN);

  const borderColors = {
    green: "border-l-green-400",
    red: "border-l-red-400",
    blue: "border-l-blue-400",
  };

  return (
    <div className={`border-l-2 ${borderColors[variant]} pl-3`}>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {displayText}
      </p>
      {needsTruncation && (
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mt-1"
        >
          {expanded ? (
            <>Show less <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Show more <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  );
};
