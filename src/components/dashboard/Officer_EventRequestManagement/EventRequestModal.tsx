import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EventRequestDetails from './EventRequestDetails';
import EventRequestManagementTable from './EventRequestManagementTable';
import { Update } from '../../../scripts/pocketbase/Update';
import { Collections, EventRequestStatus } from '../../../schemas/pocketbase/schema';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Get } from '../../../scripts/pocketbase/Get';
import { toast } from 'react-hot-toast';
import type { EventRequest } from '../../../schemas/pocketbase/schema';

// Extended EventRequest interface to include expanded fields that might come from the API
interface ExtendedEventRequest extends Omit<EventRequest, 'status'> {
    status: "submitted" | "pending" | "completed" | "declined";
    requested_user_expand?: {
        name: string;
        email: string;
    };
    expand?: {
        requested_user?: {
            id: string;
            name: string;
            email: string;
            emailVisibility?: boolean;
            [key: string]: any;
        };
        [key: string]: any;
    };
}

interface EventRequestModalProps {
    eventRequests: ExtendedEventRequest[];
}

// Helper to refresh user data in request objects
const refreshUserData = async (requests: ExtendedEventRequest[]): Promise<ExtendedEventRequest[]> => {
    try {
        const get = Get.getInstance();
        const updatedRequests = [...requests];
        const userCache: Record<string, any> = {}; // Cache to avoid fetching the same user multiple times

        for (let i = 0; i < updatedRequests.length; i++) {
            const request = updatedRequests[i];

            if (request.requested_user) {
                try {
                    // Check if we've already fetched this user
                    let typedUserData;

                    if (userCache[request.requested_user]) {
                        typedUserData = userCache[request.requested_user];
                    } else {
                        // Fetch full user details for each request with expanded options
                        const userData = await get.getOne('users', request.requested_user);

                        // Type assertion to ensure we have the correct user data properties
                        typedUserData = userData as {
                            id: string;
                            name: string;
                            email: string;
                            [key: string]: any;
                        };

                        // Store in cache
                        userCache[request.requested_user] = typedUserData;
                    }

                    // Update expand object with user data
                    if (!request.expand) request.expand = {};
                    request.expand.requested_user = {
                        ...typedUserData,
                        emailVisibility: true // Force this to be true for UI purposes
                    };

                    // Update the requested_user_expand property
                    request.requested_user_expand = {
                        name: typedUserData.name || 'Unknown',
                        email: typedUserData.email || '(No email available)'
                    };
                } catch (err) {
                    console.error(`Error fetching user data for request ${request.id}:`, err);
                    // Ensure we have fallback values even if the API call fails
                    if (!request.expand) request.expand = {};
                    if (!request.expand.requested_user) {
                        request.expand.requested_user = {
                            id: request.requested_user,
                            name: 'Unknown',
                            email: 'Unknown',
                            emailVisibility: true
                        };
                    }

                    if (!request.requested_user_expand) {
                        request.requested_user_expand = {
                            name: 'Unknown',
                            email: 'Unknown'
                        };
                    }
                }
            }
        }

        return updatedRequests;
    } catch (err) {
        console.error('Error refreshing user data:', err);
        return requests;
    }
};

// Wrapper component for EventRequestManagementTable that handles string to function conversion
const TableWrapper: React.FC<{
    eventRequests: ExtendedEventRequest[];
    handleSelectRequest: (request: ExtendedEventRequest) => void;
    handleStatusChange: (id: string, status: "submitted" | "pending" | "completed" | "declined") => Promise<void>;
}> = ({ eventRequests, handleSelectRequest, handleStatusChange }) => {
    return (
        <EventRequestManagementTable
            eventRequests={eventRequests}
            onRequestSelect={handleSelectRequest}
            onStatusChange={handleStatusChange}
        />
    );
};

const EventRequestModal: React.FC<EventRequestModalProps> = ({ eventRequests }) => {
    // Define animation delay as a constant to keep it consistent
    const ANIMATION_DELAY = "0.3s";

    const [selectedRequest, setSelectedRequest] = useState<ExtendedEventRequest | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [localEventRequests, setLocalEventRequests] = useState<ExtendedEventRequest[]>(eventRequests);
    const [isLoadingUserData, setIsLoadingUserData] = useState(true); // Start as true to show loading immediately

    // Function to refresh user data
    const refreshUserDataAndUpdate = async (requests: ExtendedEventRequest[] = localEventRequests) => {
        setIsLoadingUserData(true);
        try {
            const updatedRequests = await refreshUserData(requests);
            setLocalEventRequests(updatedRequests);
        } catch (err) {
            console.error('Error refreshing event request data:', err);
        } finally {
            setIsLoadingUserData(false);
        }
    };

    // Immediately load user data on mount
    useEffect(() => {
        refreshUserDataAndUpdate(eventRequests);
    }, []);

    // Effect to update local state when props change
    useEffect(() => {
        // Only update if we have new eventRequests from props
        if (eventRequests.length > 0) {
            // First update with what we have from props
            setLocalEventRequests(prevRequests => {
                // Only replace if we have different data
                if (eventRequests.length !== prevRequests.length) {
                    return eventRequests;
                }
                return prevRequests;
            });

            // Then refresh user data
            refreshUserDataAndUpdate(eventRequests);
        }
    }, [eventRequests]);

    // Set up event listeners for communication with the table component
    useEffect(() => {
        const handleSelectRequest = (event: CustomEvent) => {
            setSelectedRequest(event.detail.request);
            setIsModalOpen(true);
        };

        const handleStatusUpdated = (event: CustomEvent) => {
            const { id, status } = event.detail;

            // Update local state
            setLocalEventRequests(prevRequests =>
                prevRequests.map(req =>
                    req.id === id ? { ...req, status } : req
                )
            );
        };

        // Add event listeners
        document.addEventListener('event-request-select', handleSelectRequest as EventListener);
        document.addEventListener('status-updated', handleStatusUpdated as EventListener);

        // Clean up
        return () => {
            document.removeEventListener('event-request-select', handleSelectRequest as EventListener);
            document.removeEventListener('status-updated', handleStatusUpdated as EventListener);
        };
    }, []);

    // Listen for dashboardTabVisible event to refresh user data
    useEffect(() => {
        const handleTabVisible = async () => {
            refreshUserDataAndUpdate();
        };

        document.addEventListener('dashboardTabVisible', handleTabVisible);

        return () => {
            document.removeEventListener('dashboardTabVisible', handleTabVisible);
        };
    }, [localEventRequests]);

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedRequest(null);
    };

    const handleStatusChange = async (id: string, status: "submitted" | "pending" | "completed" | "declined"): Promise<void> => {
        try {
            const update = Update.getInstance();
            await update.updateField("event_request", id, "status", status);

            // Force sync to update IndexedDB
            const dataSync = DataSyncService.getInstance();
            await dataSync.syncCollection(Collections.EVENT_REQUESTS);

            // Update local state
            setLocalEventRequests(prevRequests =>
                prevRequests.map(req =>
                    req.id === id ? { ...req, status } : req
                )
            );

            // Find the request to get its name
            const request = localEventRequests.find((req) => req.id === id);
            const eventName = request?.name || "Event";

            // Notify success
            toast.success(`"${eventName}" status updated to ${status}`);

            // Dispatch event for other components
            document.dispatchEvent(
                new CustomEvent("status-updated", {
                    detail: { id, status },
                })
            );

        } catch (err) {
            console.error("Error updating status:", err);
            toast.error(`Failed to update status`);
            throw err;
        }
    };

    // Function to handle request selection
    const handleSelectRequest = (request: ExtendedEventRequest) => {
        document.dispatchEvent(
            new CustomEvent("event-request-select", {
                detail: { request },
            })
        );
    };

    // Expose the functions globally for table component to use
    useEffect(() => {
        // @ts-ignore - Adding to window object
        window.handleSelectRequest = handleSelectRequest;
        // @ts-ignore - Adding to window object
        window.handleStatusChange = handleStatusChange;
        // @ts-ignore - Adding to window object
        window.refreshUserData = refreshUserDataAndUpdate;

        return () => {
            // @ts-ignore - Cleanup
            delete window.handleSelectRequest;
            // @ts-ignore - Cleanup
            delete window.handleStatusChange;
            // @ts-ignore - Cleanup
            delete window.refreshUserData;
        };
    }, [localEventRequests]);

    return (
        <>
            {/* Table component placed here */}
            <div
                className="bg-base-200 rounded-xl shadow-xl overflow-hidden dashboard-card card-enter event-table-container"
                style={{ animationDelay: ANIMATION_DELAY }}
            >
                <div className="p-4 md:p-6 h-auto">
                    <div className="flex justify-between items-center mb-4">
                        {isLoadingUserData ? (
                            <div className="flex items-center">
                                <div className="loading loading-spinner loading-sm mr-2"></div>
                                <span className="text-sm text-gray-400">Loading user data...</span>
                            </div>
                        ) : (
                            <div></div>
                        )}
                        <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => refreshUserDataAndUpdate()}
                            disabled={isLoadingUserData}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh User Data
                        </button>
                    </div>
                    <div id="event-request-table-container">
                        <TableWrapper
                            eventRequests={localEventRequests}
                            handleSelectRequest={handleSelectRequest}
                            handleStatusChange={handleStatusChange}
                        />
                    </div>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && selectedRequest && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto"
                    >
                        <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto relative">
                            <div className="absolute top-4 right-4 z-[201]">
                                <button
                                    onClick={closeModal}
                                    className="btn btn-circle btn-sm bg-base-300/90 hover:bg-base-300"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <EventRequestDetails
                                request={selectedRequest}
                                onClose={closeModal}
                                onStatusChange={handleStatusChange}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default EventRequestModal; 