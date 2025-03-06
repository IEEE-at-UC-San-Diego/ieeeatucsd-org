import { useEffect, useState } from "react";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { Get } from "../../../scripts/pocketbase/Get";
import { Collections } from "../../../schemas/pocketbase";
import { Icon } from "astro-icon/components";
import type { Log } from "../../../schemas/pocketbase";

// Extend the Log type to include expand property
interface ExtendedLog extends Log {
    expand?: {
        user?: {
            name: string;
            email: string;
            id: string;
        };
    };
}

interface AdminSystemActivityProps {
    limit?: number;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export default function AdminSystemActivity({
    limit = 10,
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
}: AdminSystemActivityProps) {
    const [logs, setLogs] = useState<ExtendedLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const auth = Authentication.getInstance();
            const get = Get.getInstance();

            if (!auth.isAuthenticated()) {
                setError("Not authenticated");
                setLoading(false);
                return;
            }

            // Fetch logs with user expansion
            const logsResponse = await get.getList<ExtendedLog>(
                Collections.LOGS,
                1,
                limit,
                "",
                "-created",
                { expand: "user" }
            );

            setLogs(logsResponse.items);
            setError(null);
        } catch (err) {
            console.error("Error fetching logs:", err);
            setError("Failed to load system logs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchLogs();

        // Set up auto-refresh if enabled
        let intervalId: number | undefined;
        if (autoRefresh && typeof window !== 'undefined') {
            intervalId = window.setInterval(fetchLogs, refreshInterval);
        }

        // Cleanup interval on unmount
        return () => {
            if (intervalId !== undefined && typeof window !== 'undefined') {
                window.clearInterval(intervalId);
            }
        };
    }, [limit, autoRefresh, refreshInterval]);

    // Format date to a readable format
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);

        // Check if the date is today
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();

        if (isToday) {
            // If today, show time only
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            // Otherwise show date and time
            return date.toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };

    // Get appropriate icon for log type
    const getLogTypeIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case "login":
                return "heroicons:login";
            case "logout":
                return "heroicons:logout";
            case "create":
                return "heroicons:plus-circle";
            case "update":
                return "heroicons:pencil";
            case "delete":
                return "heroicons:trash";
            case "error":
                return "heroicons:exclamation-circle";
            default:
                return "heroicons:information-circle";
        }
    };

    // Get appropriate color for log type
    const getLogTypeColor = (type: string) => {
        switch (type.toLowerCase()) {
            case "login":
                return "text-success";
            case "logout":
                return "text-info";
            case "create":
                return "text-primary";
            case "update":
                return "text-secondary";
            case "delete":
                return "text-error";
            case "error":
                return "text-error";
            default:
                return "text-base-content";
        }
    };

    if (loading && logs.length === 0) {
        return (
            <div className="flex justify-center items-center p-4">
                <div className="loading loading-spinner loading-md"></div>
                <span className="ml-2">Loading system logs...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-error">
                <Icon name="heroicons:exclamation-circle" class="h-5 w-5" />
                <span>{error}</span>
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="alert alert-info">
                <Icon name="heroicons:information-circle" class="h-5 w-5" />
                <span>No system logs found</span>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-base-200 transition-colors">
                            <td className="text-sm whitespace-nowrap">
                                {formatDate(log.created)}
                            </td>
                            <td>
                                {log.expand?.user?.name || "System"}
                            </td>
                            <td>
                                <div className="flex items-center gap-1">
                                    <Icon
                                        name={getLogTypeIcon(log.type)}
                                        class={`h-4 w-4 ${getLogTypeColor(log.type)}`}
                                    />
                                    <span className="capitalize">{log.type}</span>
                                </div>
                            </td>
                            <td className="max-w-md truncate">{log.message}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {loading && logs.length > 0 && (
                <div className="flex justify-center items-center p-2 text-sm text-base-content/70">
                    <div className="loading loading-spinner loading-xs"></div>
                    <span className="ml-2">Refreshing...</span>
                </div>
            )}
        </div>
    );
} 