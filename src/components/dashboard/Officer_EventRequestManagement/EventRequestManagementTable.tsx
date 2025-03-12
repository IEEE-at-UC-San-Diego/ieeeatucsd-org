import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Get } from '../../../scripts/pocketbase/Get';
import { Update } from '../../../scripts/pocketbase/Update';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import toast from 'react-hot-toast';
import EventRequestDetails from './EventRequestDetails';
import type { EventRequest as SchemaEventRequest } from '../../../schemas/pocketbase/schema';
import { Collections } from '../../../schemas/pocketbase/schema';

// Extended EventRequest interface with additional properties needed for this component
interface ExtendedEventRequest extends SchemaEventRequest {
    requested_user_expand?: {
        name: string;
        email: string;
    };
    expand?: {
        requested_user?: {
            id: string;
            name: string;
            email: string;
            [key: string]: any;
        };
        [key: string]: any;
    };
    invoice_data?: any;
    invoice_files?: string[]; // Array of invoice file IDs
    status: "submitted" | "pending" | "completed" | "declined";
}

interface EventRequestManagementTableProps {
    eventRequests: ExtendedEventRequest[];
    onRequestSelect: (request: ExtendedEventRequest) => void;
    onStatusChange: (id: string, status: "submitted" | "pending" | "completed" | "declined") => Promise<void>;
}

const EventRequestManagementTable = ({
    eventRequests: initialEventRequests,
    onRequestSelect,
    onStatusChange
}: EventRequestManagementTableProps) => {
    const [eventRequests, setEventRequests] = useState<ExtendedEventRequest[]>(initialEventRequests);
    const [filteredRequests, setFilteredRequests] = useState<ExtendedEventRequest[]>(initialEventRequests);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sortField, setSortField] = useState<string>('created');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const dataSync = DataSyncService.getInstance();
    // Add state for update modal
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
    const [requestToUpdate, setRequestToUpdate] = useState<ExtendedEventRequest | null>(null);

    // Refresh event requests
    const refreshEventRequests = async () => {
        setIsRefreshing(true);
        try {
            const auth = Authentication.getInstance();

            // Don't check authentication here - try to fetch anyway
            // The token might be valid for the API even if isAuthenticated() returns false

            // console.log("Fetching event requests...");

            // Use DataSyncService to get data from IndexedDB with forced sync
            const updatedRequests = await dataSync.getData<ExtendedEventRequest>(
                Collections.EVENT_REQUESTS,
                true, // Force sync
                '', // No filter
                '-created',
                'requested_user'
            );

            // console.log(`Fetched ${updatedRequests.length} event requests`);

            setEventRequests(updatedRequests);
            applyFilters(updatedRequests);
        } catch (error) {
            // console.error('Error refreshing event requests:', error);
            toast.error('Failed to refresh event requests');
        } finally {
            setIsRefreshing(false);
        }
    };

    // Apply filters and sorting
    const applyFilters = (requests = eventRequests) => {
        let filtered = [...requests];

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(request =>
                request.status?.toLowerCase() === statusFilter.toLowerCase()
            );
        }

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(request =>
                request.name.toLowerCase().includes(term) ||
                request.location.toLowerCase().includes(term) ||
                request.event_description.toLowerCase().includes(term) ||
                request.expand?.requested_user?.name?.toLowerCase().includes(term) ||
                request.expand?.requested_user?.email?.toLowerCase().includes(term)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue: any = a[sortField as keyof ExtendedEventRequest];
            let bValue: any = b[sortField as keyof ExtendedEventRequest];

            // Handle special cases
            if (sortField === 'requested_user') {
                aValue = a.expand?.requested_user?.name || '';
                bValue = b.expand?.requested_user?.name || '';
            }

            // Handle date fields
            if (sortField === 'created' || sortField === 'updated' ||
                sortField === 'start_date_time' || sortField === 'end_date_time') {
                aValue = new Date(aValue || '').getTime();
                bValue = new Date(bValue || '').getTime();
            }

            // Compare values based on sort direction
            if (sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        setFilteredRequests(filtered);
    };

    // Update event request status
    const updateEventRequestStatus = async (id: string, status: "submitted" | "pending" | "completed" | "declined"): Promise<void> => {
        try {
            await onStatusChange(id, status);

            // Find the event request to get its name
            const eventRequest = eventRequests.find(req => req.id === id);
            const eventName = eventRequest?.name || 'Event';

            // Update local state
            setEventRequests(prev =>
                prev.map(request =>
                    request.id === id ? { ...request, status } : request
                )
            );

            setFilteredRequests(prev =>
                prev.map(request =>
                    request.id === id ? { ...request, status } : request
                )
            );

            // Force sync to update IndexedDB
            await dataSync.syncCollection<ExtendedEventRequest>(Collections.EVENT_REQUESTS);

            // Show success toast with event name
            toast.success(`"${eventName}" status updated to ${status}`);
        } catch (error) {
            // Find the event request to get its name
            const eventRequest = eventRequests.find(req => req.id === id);
            const eventName = eventRequest?.name || 'Event';

            // console.error('Error updating status:', error);
            toast.error(`Failed to update status for "${eventName}"`);
            throw error; // Re-throw the error to be caught by the caller
        }
    };

    // Format date for display
    const formatDate = (dateString: string) => {
        if (!dateString) return 'Not specified';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    // Get status badge class based on status
    const getStatusBadge = (status?: "submitted" | "pending" | "completed" | "declined") => {
        if (!status) return 'badge-warning';

        switch (status) {
            case 'completed':
                return 'badge-success';
            case 'declined':
                return 'badge-error';
            case 'pending':
                return 'badge-warning';
            case 'submitted':
                return 'badge-info';
            default:
                return 'badge-warning';
        }
    };

    // Helper function to truncate text
    const truncateText = (text: string, maxLength: number) => {
        if (!text) return '';
        return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
    };

    // Helper to get user display info - always show email address
    const getUserDisplayInfo = (request: ExtendedEventRequest) => {
        // First try to get from the expand object
        if (request.expand?.requested_user) {
            const user = request.expand.requested_user;
            // Show "Loading..." instead of "Unknown" while data is being fetched
            const name = user.name || 'Loading...';
            // Always show email regardless of emailVisibility
            const email = user.email || 'Loading...';
            return { name, email };
        }

        // Then try the requested_user_expand
        if (request.requested_user_expand) {
            const name = request.requested_user_expand.name || 'Loading...';
            const email = request.requested_user_expand.email || 'Loading...';
            return { name, email };
        }

        // Last fallback - don't use "Unknown" to avoid confusing users
        return { name: 'Loading...', email: 'Loading...' };
    };

    // Update openDetailModal to call the prop function
    const openDetailModal = (request: ExtendedEventRequest) => {
        onRequestSelect(request);
    };

    // Handle sort change
    const handleSortChange = (field: string) => {
        if (sortField === field) {
            // Toggle direction if same field
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // Set new field and default to descending
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Apply filters when filter state changes
    useEffect(() => {
        applyFilters();
    }, [statusFilter, searchTerm, sortField, sortDirection]);

    // Check authentication and refresh token if needed
    useEffect(() => {
        const checkAuth = async () => {
            const auth = Authentication.getInstance();

            // Check if we're authenticated
            if (!auth.isAuthenticated()) {
                // console.log("Authentication check failed - attempting to continue anyway");

                // Don't show error or redirect immediately - try to refresh first
                try {
                    // Try to refresh event requests anyway - the token might be valid
                    await refreshEventRequests();
                } catch (err) {
                    // console.error("Failed to refresh after auth check:", err);
                    toast.error("Authentication error. Please log in again.");

                    // Only redirect if refresh fails
                    setTimeout(() => {
                        window.location.href = "/login";
                    }, 2000);
                }
            } else {
                // console.log("Authentication check passed");
            }
        };

        checkAuth();
    }, []);

    // Auto refresh on component mount
    useEffect(() => {
        refreshEventRequests();
    }, []);

    // Listen for tab visibility changes and refresh data when tab becomes visible
    useEffect(() => {
        const handleTabVisible = () => {
            // console.log("Tab became visible, refreshing event requests...");
            refreshEventRequests();
        };

        // Add event listener for custom dashboardTabVisible event
        document.addEventListener("dashboardTabVisible", handleTabVisible);

        // Clean up event listener on component unmount
        return () => {
            document.removeEventListener("dashboardTabVisible", handleTabVisible);
        };
    }, []);

    if (filteredRequests.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-gradient-to-b from-base-200 to-base-300 rounded-xl p-8 text-center shadow-sm border border-base-300/30"
            >
                <div className="flex flex-col items-center justify-center py-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="text-xl font-semibold mb-3 text-white">No Event Requests Found</h3>
                    <p className="text-base-content/60 mb-6 max-w-md">
                        {statusFilter !== 'all' || searchTerm
                            ? 'No event requests match your current filters. Try adjusting your search criteria.'
                            : 'There are no event requests in the system yet.'}
                    </p>
                    <div className="flex gap-3">
                        <button
                            className="btn btn-primary btn-outline btn-sm gap-2"
                            onClick={refreshEventRequests}
                            disabled={isRefreshing}
                        >
                            {isRefreshing ? (
                                <>
                                    <span className="loading loading-spinner loading-xs"></span>
                                    Refreshing...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh
                                </>
                            )}
                        </button>
                        {(statusFilter !== 'all' || searchTerm) && (
                            <button
                                className="btn btn-ghost btn-sm gap-2"
                                onClick={() => {
                                    setStatusFilter('all');
                                    setSearchTerm('');
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Clear Filters
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
                style={{ minHeight: "500px" }}
            >
                {/* Filters and controls */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-4 bg-base-300/50 rounded-lg border border-base-100/10 mb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
                        <div className="relative flex items-center w-full sm:w-auto">
                            <input
                                type="text"
                                placeholder="Search events..."
                                className="input bg-[#1e2029] border-[#2a2d3a] focus:border-primary w-full sm:w-64 pr-10 rounded-lg"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button className="absolute right-0 top-0 btn btn-square bg-primary text-white hover:bg-primary/90 border-none rounded-l-none h-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </button>
                        </div>
                        <div className="relative w-full sm:w-auto">
                            <select
                                className="select bg-[#1e2029] border-[#2a2d3a] focus:border-primary w-full appearance-none pr-10 rounded-lg"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                                <option value="declined">Declined</option>
                            </select>

                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-between sm:justify-end">
                        <span className="text-sm text-gray-400">
                            {filteredRequests.length} {filteredRequests.length === 1 ? 'request' : 'requests'} found
                        </span>
                        <button
                            className="btn btn-primary btn-outline btn-sm gap-2"
                            onClick={refreshEventRequests}
                            disabled={isRefreshing}
                        >
                            {isRefreshing ? (
                                <>
                                    <span className="loading loading-spinner loading-xs"></span>
                                    Refreshing...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Event requests table */}
                <div
                    className="rounded-xl shadow-sm overflow-x-auto bg-base-100/10 border border-base-100/20"
                    style={{
                        maxHeight: "unset",
                        height: "auto"
                    }}
                >
                    <table className="table table-zebra w-full">
                        <thead className="bg-base-300/50 sticky top-0 z-10">
                            <tr>
                                <th
                                    className="cursor-pointer hover:bg-base-300 transition-colors"
                                    onClick={() => handleSortChange('name')}
                                >
                                    <div className="flex items-center gap-1">
                                        Event Name
                                        {sortField === 'name' && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="cursor-pointer hover:bg-base-300 transition-colors hidden md:table-cell"
                                    onClick={() => handleSortChange('start_date_time')}
                                >
                                    <div className="flex items-center gap-1">
                                        Date
                                        {sortField === 'start_date_time' && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="cursor-pointer hover:bg-base-300 transition-colors"
                                    onClick={() => handleSortChange('requested_user')}
                                >
                                    <div className="flex items-center gap-1">
                                        Requested By
                                        {sortField === 'requested_user' && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                                <th className="hidden lg:table-cell">PR Materials</th>
                                <th className="hidden lg:table-cell">AS Funding</th>
                                <th
                                    className="cursor-pointer hover:bg-base-300 transition-colors hidden md:table-cell"
                                    onClick={() => handleSortChange('created')}
                                >
                                    <div className="flex items-center gap-1">
                                        Submitted
                                        {sortField === 'created' && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="cursor-pointer hover:bg-base-300 transition-colors"
                                    onClick={() => handleSortChange('status')}
                                >
                                    <div className="flex items-center gap-1">
                                        Status
                                        {sortField === 'status' && (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map((request) => (
                                <tr key={request.id} className="hover transition-colors">
                                    <td className="font-medium">
                                        <div className="truncate max-w-[180px] md:max-w-[250px]" title={request.name}>
                                            {truncateText(request.name, 30)}
                                        </div>
                                    </td>
                                    <td className="hidden md:table-cell">{formatDate(request.start_date_time)}</td>
                                    <td>
                                        {(() => {
                                            const { name, email } = getUserDisplayInfo(request);
                                            return (
                                                <div className="flex flex-col">
                                                    <span>{name}</span>
                                                    <span className="text-xs text-gray-400">{email}</span>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="hidden lg:table-cell">
                                        {request.flyers_needed ? (
                                            <span className="badge badge-success badge-sm">Yes</span>
                                        ) : (
                                            <span className="badge badge-ghost badge-sm">No</span>
                                        )}
                                    </td>
                                    <td className="hidden lg:table-cell">
                                        {request.as_funding_required ? (
                                            <span className="badge badge-success badge-sm">Yes</span>
                                        ) : (
                                            <span className="badge badge-ghost badge-sm">No</span>
                                        )}
                                    </td>
                                    <td className="hidden md:table-cell">{formatDate(request.created)}</td>
                                    <td>
                                        <span className={`badge ${getStatusBadge(request.status)}`}>
                                            {request.status?.charAt(0).toUpperCase() + request.status?.slice(1) || 'Pending'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="btn btn-sm btn-primary btn-outline btn-sm gap-2"
                                                onClick={() => openDetailModal(request)}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                View
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </>
    );
};

export default EventRequestManagementTable; 