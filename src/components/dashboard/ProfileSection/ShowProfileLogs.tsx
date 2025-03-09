import { useEffect, useState, useCallback, useMemo } from "react";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { DataSyncService } from "../../../scripts/database/DataSyncService";
import { Collections } from "../../../schemas/pocketbase/schema";
import debounce from 'lodash/debounce';
import type { Log } from "../../../schemas/pocketbase";
import { SendLog } from "../../../scripts/pocketbase/SendLog";

const LOGS_PER_PAGE = 5;

export default function ShowProfileLogs() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [allLogs, setAllLogs] = useState<Log[]>([]);
    const [isFetchingAll, setIsFetchingAll] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Auto-refresh logs every 30 seconds if enabled
    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            if (!isFetchingAll) {
                fetchLogs(true);
            }
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [autoRefresh, isFetchingAll]);

    const fetchLogs = async (skipCache = false) => {
        setLoading(true);
        setError(null);

        const auth = Authentication.getInstance();
        const currentUser = auth.getPocketBase().authStore.model;
        const userId = currentUser?.id;

        if (!userId) {
            setError("Not authenticated");
            setLoading(false);
            return;
        }

        try {
            setIsFetchingAll(true);
            // console.log("Fetching logs for user:", userId);

            // Use DataSyncService to fetch logs
            const dataSync = DataSyncService.getInstance();

            // First sync logs for this user
            await dataSync.syncCollection(
                Collections.LOGS,
                `user = "${userId}"`,
                "-created",
                { expand: "user" }
            );

            // Then get all logs from IndexedDB
            const fetchedLogs = await dataSync.getData<Log>(
                Collections.LOGS,
                false, // Don't force sync again
                `user = "${userId}"`,
                "-created"
            );

            // console.log("Fetched logs:", fetchedLogs.length);

            if (fetchedLogs.length === 0) {
                // If no logs found, try to fetch directly from PocketBase
                // console.log("No logs found in IndexedDB, trying direct fetch from PocketBase");
                try {
                    const sendLog = SendLog.getInstance();
                    const directLogs = await sendLog.getUserLogs(userId);
                    // console.log("Direct fetch logs:", directLogs.length);

                    if (directLogs.length > 0) {
                        setAllLogs(directLogs);
                        setTotalPages(Math.ceil(directLogs.length / LOGS_PER_PAGE));
                        setTotalLogs(directLogs.length);
                    } else {
                        setAllLogs(fetchedLogs);
                        setTotalPages(Math.ceil(fetchedLogs.length / LOGS_PER_PAGE));
                        setTotalLogs(fetchedLogs.length);
                    }
                } catch (directError) {
                    // console.error("Failed to fetch logs directly:", directError);
                    setAllLogs(fetchedLogs);
                    setTotalPages(Math.ceil(fetchedLogs.length / LOGS_PER_PAGE));
                    setTotalLogs(fetchedLogs.length);
                }
            } else {
                setAllLogs(fetchedLogs);
                setTotalPages(Math.ceil(fetchedLogs.length / LOGS_PER_PAGE));
                setTotalLogs(fetchedLogs.length);
            }
        } catch (error) {
            // console.error("Failed to fetch logs:", error);
            setError("Error loading activity");
        } finally {
            setLoading(false);
            setIsFetchingAll(false);
        }
    };

    // Memoized search function
    const filteredLogs = useMemo(() => {
        if (!allLogs.length) return [];

        if (!searchQuery.trim()) {
            // When not searching, return only the current page of logs
            const startIndex = (currentPage - 1) * LOGS_PER_PAGE;
            const endIndex = startIndex + LOGS_PER_PAGE;
            return allLogs.slice(startIndex, endIndex);
        }

        const query = searchQuery.toLowerCase();
        return allLogs.filter(log => {
            return (
                log.message?.toLowerCase().includes(query) ||
                log.type?.toLowerCase().includes(query) ||
                log.part?.toLowerCase().includes(query) ||
                (log.created && new Date(log.created).toLocaleString().toLowerCase().includes(query))
            );
        });
    }, [searchQuery, allLogs, currentPage]);

    // Update displayed logs whenever filtered results change
    useEffect(() => {
        setLogs(filteredLogs);
        // console.log("Filtered logs updated:", filteredLogs.length, "logs");
    }, [filteredLogs]);

    // Debounced search handler
    const debouncedSearch = useCallback(
        debounce((query: string) => {
            setSearchQuery(query);
            // Reset to first page when searching
            if (query.trim()) {
                setCurrentPage(1);
            }
        }, 300),
        []
    );

    const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
        debouncedSearch(event.target.value);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handleRefresh = () => {
        fetchLogs(true);
    };

    useEffect(() => {
        const loadLogsWithRetry = async () => {
            try {
                await fetchLogs();

                // Wait a moment for state to update
                setTimeout(async () => {
                    // Check if logs were loaded
                    if (allLogs.length === 0) {
                        // console.log("No logs found after initial fetch, trying direct fetch");
                        await directFetchLogs();
                    }
                }, 1000);
            } catch (error) {
                // console.error("Failed to load logs with retry:", error);
            }
        };

        loadLogsWithRetry();
        checkLogsExist();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Check if there are any logs in the database at all
    const checkLogsExist = async () => {
        try {
            const auth = Authentication.getInstance();
            const pb = auth.getPocketBase();

            // Check if the logs collection exists and has any records
            const result = await pb.collection(Collections.LOGS).getList(1, 1);
            // console.log("Logs collection check:", {
            //     totalItems: result.totalItems,
            //     page: result.page,
            //     perPage: result.perPage,
            //     totalPages: result.totalPages
            // });
        } catch (error) {
            // console.error("Failed to check logs collection:", error);
        }
    };

    // Calculate log statistics
    const logStats = useMemo(() => {
        if (!allLogs.length) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        const todayLogs = allLogs.filter(log => new Date(log.created) >= today);
        const weekLogs = allLogs.filter(log => new Date(log.created) >= lastWeek);

        // Count by type
        const typeCount: Record<string, number> = {};
        allLogs.forEach(log => {
            const type = log.type || 'unknown';
            typeCount[type] = (typeCount[type] || 0) + 1;
        });

        return {
            total: allLogs.length,
            today: todayLogs.length,
            week: weekLogs.length,
            types: typeCount
        };
    }, [allLogs]);

    // Direct fetch from PocketBase as a fallback
    const directFetchLogs = async () => {
        try {
            setLoading(true);
            setError(null);

            const auth = Authentication.getInstance();
            const pb = auth.getPocketBase();
            const userId = auth.getPocketBase().authStore.model?.id;

            if (!userId) {
                setError("Not authenticated");
                setLoading(false);
                return;
            }

            // console.log("Direct fetching logs for user:", userId);

            // Fetch logs directly from PocketBase
            const result = await pb.collection(Collections.LOGS).getList<Log>(1, 100, {
                filter: `user = "${userId}"`,
                sort: "-created",
                expand: "user"
            });

            // console.log("Direct fetch result:", {
            //     totalItems: result.totalItems,
            //     items: result.items.length
            // });

            if (result.items.length > 0) {
                setAllLogs(result.items);
                setTotalPages(Math.ceil(result.items.length / LOGS_PER_PAGE));
                setTotalLogs(result.items.length);
            }
        } catch (error) {
            // console.error("Failed to direct fetch logs:", error);
            setError("Error loading activity");
        } finally {
            setLoading(false);
        }
    };

    // Add a button to try direct fetch
    const renderDirectFetchButton = () => (
        <button
            className="btn btn-sm btn-outline mt-4"
            onClick={directFetchLogs}
        >
            Try Direct Fetch
        </button>
    );

    if (loading && !allLogs.length) {
        return (
            <p className="text-base-content/70 flex items-center gap-2">
                <svg className="h-5 w-5 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
                {isFetchingAll ? 'Fetching your activity...' : 'Loading activity...'}
            </p>
        );
    }

    if (error) {
        return (
            <p className="text-base-content/70 flex items-center gap-2">
                <svg className="h-5 w-5 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
                {error}
            </p>
        );
    }

    // Debug logs
    // console.log("Render state:", {
    //     logsLength: logs.length,
    //     allLogsLength: allLogs.length,
    //     searchQuery,
    //     loading,
    //     currentPage
    // });

    if (allLogs.length === 0 && !searchQuery && !loading) {
        return (
            <div>
                <p className="text-base-content/70 flex items-center gap-2 mb-4">
                    <svg className="h-5 w-5 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                    No recent activity to display.
                </p>
                <div className="flex gap-2">
                    <button
                        className="btn btn-sm btn-primary"
                        onClick={async () => {
                            try {
                                const auth = Authentication.getInstance();
                                const userId = auth.getPocketBase().authStore.model?.id;
                                if (!userId) return;

                                const sendLog = SendLog.getInstance();
                                await sendLog.send(
                                    "create",
                                    "test",
                                    "Test log created for debugging",
                                    userId
                                );
                                // console.log("Created test log");
                                setTimeout(() => fetchLogs(true), 1000);
                            } catch (error) {
                                // console.error("Failed to create test log:", error);
                            }
                        }}
                    >
                        Create Test Log
                    </button>
                    <button
                        className="btn btn-sm btn-outline"
                        onClick={directFetchLogs}
                    >
                        Try Direct Fetch
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Activity Summary */}
            {logStats && !searchQuery && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="stat bg-base-200 rounded-lg p-4">
                        <div className="stat-title">Today</div>
                        <div className="stat-value">{logStats.today}</div>
                        <div className="stat-desc">Activities recorded today</div>
                    </div>
                    <div className="stat bg-base-200 rounded-lg p-4">
                        <div className="stat-title">This Week</div>
                        <div className="stat-value">{logStats.week}</div>
                        <div className="stat-desc">Activities in the last 7 days</div>
                    </div>
                    <div className="stat bg-base-200 rounded-lg p-4">
                        <div className="stat-title">Total</div>
                        <div className="stat-value">{logStats.total}</div>
                        <div className="stat-desc">All-time activities</div>
                    </div>
                </div>
            )}

            {/* Search and Refresh Controls */}
            <div className="flex gap-4 mb-4">
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Search activity..."
                        onChange={handleSearch}
                        className="input input-bordered w-full"
                    />
                </div>
                <div className="dropdown dropdown-end dropdown-hover">
                    <button
                        onClick={handleRefresh}
                        className={`btn btn-ghost btn-square ${isFetchingAll ? 'loading' : ''}`}
                        title="Refresh logs"
                        disabled={isFetchingAll}
                    >
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                        <li>
                            <button
                                onClick={() => setAutoRefresh(!autoRefresh)}
                                className="flex justify-between"
                            >
                                <span>Auto-refresh</span>
                                <input
                                    type="checkbox"
                                    className="toggle toggle-primary toggle-sm"
                                    checked={autoRefresh}
                                    onChange={() => { }}
                                />
                            </button>
                        </li>
                        <li><button onClick={directFetchLogs}>Direct fetch from server</button></li>
                    </ul>
                </div>
            </div>

            {isFetchingAll && (
                <div className="mb-4">
                    <p className="text-sm opacity-70">Fetching all activity, please wait...</p>
                </div>
            )}

            {/* Search Results Message */}
            {searchQuery && (
                <p className="text-sm opacity-70 mb-4">
                    Found {logs.length} results for "{searchQuery}"
                </p>
            )}

            {/* Logs Display */}
            <div className="space-y-2">
                {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 p-4 rounded-lg hover:bg-base-200 transition-colors duration-200">
                        <div className="flex-shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getLogTypeColor(log.type)}`}>
                                {getLogTypeIcon(log.type)}
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-medium">{log.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                                {log.part && (
                                    <span className="badge badge-sm">{log.part}</span>
                                )}
                                <p className="text-sm opacity-50">
                                    {new Date(log.created).toLocaleString(undefined, {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination Controls */}
            {!searchQuery && totalLogs > LOGS_PER_PAGE && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-base-200">
                    <div className="flex items-center gap-2">
                        <span className="text-sm opacity-70">
                            Showing {totalLogs ? (currentPage - 1) * LOGS_PER_PAGE + 1 : 0}-{Math.min(currentPage * LOGS_PER_PAGE, totalLogs)} of {totalLogs} results
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage === 1}
                            className="btn btn-sm btn-ghost"
                        >
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                            Previous
                        </button>
                        <button
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages}
                            className="btn btn-sm btn-ghost"
                        >
                            Next
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function getLogTypeColor(type: string): string {
    switch (type?.toLowerCase()) {
        case 'error':
            return 'bg-error/10 text-error';
        case 'update':
            return 'bg-info/10 text-info';
        case 'delete':
            return 'bg-warning/10 text-warning';
        case 'create':
            return 'bg-success/10 text-success';
        case 'login':
        case 'logout':
            return 'bg-primary/10 text-primary';
        default:
            return 'bg-base-300/50 text-base-content';
    }
}

function getLogTypeIcon(type: string) {
    switch (type?.toLowerCase()) {
        case 'error':
            return (
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
            );
        case 'update':
            return (
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
                    <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
                </svg>
            );
        case 'delete':
            return (
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
                </svg>
            );
        case 'create':
            return (
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                </svg>
            );
        case 'login':
            return (
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
            );
        case 'logout':
            return (
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm5.03 4.72a.75.75 0 010 1.06l-1.72 1.72h10.94a.75.75 0 010 1.5H10.81l1.72 1.72a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 011.06 0z" clipRule="evenodd" />
                </svg>
            );
        default:
            return (
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm1-13h-2v6l5.25 3.15.75-1.23-4-2.37z" />
                </svg>
            );
    }
}
