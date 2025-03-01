import { useEffect, useState, useCallback, useMemo } from "react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { DataSyncService } from "../../../scripts/database/DataSyncService";
import { Collections } from "../../../schemas/pocketbase/schema";
import debounce from 'lodash/debounce';
import type { Log } from "../../../schemas/pocketbase";

interface PaginatedResponse {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
    items: Log[];
}

interface CacheEntry {
    timestamp: number;
    data: Log[];
    totalItems: number;
    totalPages: number;
    lastFetched: string; // ISO date string to track when we last fetched all logs
}

const LOGS_PER_PAGE = 5;
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_PREFIX = 'logs_cache_';
const BATCH_SIZE = 100; // Number of logs to fetch per batch

export default function ShowProfileLogs() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [cachedLogs, setCachedLogs] = useState<Log[]>([]);
    const [isFetchingAll, setIsFetchingAll] = useState(false);

    const getCacheKey = (userId: string) => `${CACHE_KEY_PREFIX}${userId}`;

    const saveToCache = (userId: string, data: CacheEntry) => {
        try {
            localStorage.setItem(getCacheKey(userId), JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save to cache:', error);
        }
    };

    const getFromCache = (userId: string): CacheEntry | null => {
        try {
            const cached = localStorage.getItem(getCacheKey(userId));
            if (!cached) return null;

            const parsedCache = JSON.parse(cached) as CacheEntry;
            if (Date.now() - parsedCache.timestamp > CACHE_EXPIRY) {
                localStorage.removeItem(getCacheKey(userId));
                return null;
            }

            return parsedCache;
        } catch (error) {
            console.warn('Failed to read from cache:', error);
            return null;
        }
    };

    const fetchAllLogs = async (userId: string): Promise<Log[]> => {
        const dataSync = DataSyncService.getInstance();
        let allLogs: Log[] = [];
        let page = 1;
        let hasMore = true;

        // First, sync all logs for this user
        await dataSync.syncCollection(
            Collections.LOGS,
            `user_id = "${userId}"`,
            "-created"
        );

        // Then get all logs from IndexedDB
        allLogs = await dataSync.getData<Log>(
            Collections.LOGS,
            false, // Don't force sync again
            `user_id = "${userId}"`,
            "-created"
        );

        return allLogs;
    };

    const fetchLogs = async (page: number, skipCache = false) => {
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
            // Check cache first if not skipping
            if (!skipCache) {
                const cached = getFromCache(userId);
                if (cached) {
                    setCachedLogs(cached.data);
                    setTotalPages(Math.ceil(cached.data.length / LOGS_PER_PAGE));
                    setTotalLogs(cached.data.length);
                    setLoading(false);
                    return;
                }
            }

            setIsFetchingAll(true);
            const allLogs = await fetchAllLogs(userId);

            // Save to cache
            saveToCache(userId, {
                timestamp: Date.now(),
                data: allLogs,
                totalItems: allLogs.length,
                totalPages: Math.ceil(allLogs.length / LOGS_PER_PAGE),
                lastFetched: new Date().toISOString()
            });

            setCachedLogs(allLogs);
            setCurrentPage(page);
            setTotalPages(Math.ceil(allLogs.length / LOGS_PER_PAGE));
            setTotalLogs(allLogs.length);
        } catch (error) {
            console.error("Failed to fetch logs:", error);
            setError("Error loading activity");
        } finally {
            setLoading(false);
            setIsFetchingAll(false);
        }
    };

    // Memoized search function
    const filteredLogs = useMemo(() => {
        if (!searchQuery.trim()) {
            // When not searching, return only the current page of logs
            const startIndex = (currentPage - 1) * LOGS_PER_PAGE;
            const endIndex = startIndex + LOGS_PER_PAGE;
            return cachedLogs.slice(startIndex, endIndex);
        }

        const query = searchQuery.toLowerCase();
        return cachedLogs.filter(log => {
            return (
                log.message.toLowerCase().includes(query) ||
                new Date(log.created).toLocaleString().toLowerCase().includes(query)
            );
        });
    }, [searchQuery, cachedLogs, currentPage]);

    // Update displayed logs whenever filtered results change
    useEffect(() => {
        setLogs(filteredLogs);
    }, [filteredLogs]);

    // Debounced search handler
    const debouncedSearch = useCallback(
        debounce((query: string) => {
            setSearchQuery(query);
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
        fetchLogs(currentPage, true);
    };

    useEffect(() => {
        fetchLogs(1);
    }, []);

    if (loading && !cachedLogs.length) {
        return (
            <p className="text-base-content/70 flex items-center gap-2">
                <svg className="h-5 w-5 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
                {isFetchingAll ? 'Fetching all activity...' : 'Loading activity...'}
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

    if (logs.length === 0 && !searchQuery) {
        return (
            <p className="text-base-content/70 flex items-center gap-2">
                <svg className="h-5 w-5 opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
                No recent activity to display.
            </p>
        );
    }

    return (
        <div>
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
                <button
                    onClick={handleRefresh}
                    className={`btn btn-ghost btn-square `}
                    title="Refresh logs"
                    disabled={isFetchingAll}
                >
                    <svg className={`h-5 w-5 ${isFetchingAll ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" fill="currentColor">
                        <path fill="currentColor" d="M771.776 794.88A384 384 0 0 1 128 512h64a320 320 0 0 0 555.712 216.448H654.72a32 32 0 1 1 0-64h149.056a32 32 0 0 1 32 32v148.928a32 32 0 1 1-64 0v-50.56zM276.288 295.616h92.992a32 32 0 0 1 0 64H220.16a32 32 0 0 1-32-32V178.56a32 32 0 0 1 64 0v50.56A384 384 0 0 1 896.128 512h-64a320 320 0 0 0-555.776-216.384z" />
                    </svg>
                </button>
            </div>

            {isFetchingAll && (
                <div className="mb-4">
                    <p className="text-sm opacity-70">Fetching all logs, please wait...</p>
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
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm1-13h-2v6l5.25 3.15.75-1.23-4-2.37z" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-medium">{log.message}</p>
                            <p className="text-sm opacity-50 mt-1">
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
                ))}
            </div>

            {/* Pagination Controls */}
            {!searchQuery && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-base-200">
                    <div className="flex items-center gap-2">
                        <span className="text-sm opacity-70">
                            Showing {(currentPage - 1) * LOGS_PER_PAGE + 1}-{Math.min(currentPage * LOGS_PER_PAGE, totalLogs)} of {totalLogs} results
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
