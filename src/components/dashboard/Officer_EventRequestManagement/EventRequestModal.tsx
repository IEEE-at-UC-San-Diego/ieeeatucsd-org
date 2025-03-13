import React, { useState, useEffect, useLayoutEffect } from 'react';
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
    isLoadingUserData?: boolean;
}> = ({ eventRequests, handleSelectRequest, handleStatusChange, isLoadingUserData = false }) => {
    return (
        <EventRequestManagementTable
            eventRequests={eventRequests}
            onRequestSelect={handleSelectRequest}
            onStatusChange={handleStatusChange}
            isLoadingUserData={isLoadingUserData}
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

    // Fix scrollbar flashing when modal opens/closes
    useLayoutEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        const originalPaddingRight = window.getComputedStyle(document.body).paddingRight;

        if (isModalOpen) {
            // Store scroll position
            const scrollY = window.scrollY;

            // Measure the scrollbar width
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

            // Add padding to prevent layout shift
            document.body.style.paddingRight = `${scrollbarWidth}px`;

            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
        } else {
            // Restore scrolling
            const scrollY = document.body.style.top;
            document.body.style.overflow = originalStyle;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.paddingRight = originalPaddingRight;

            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        }

        return () => {
            // Clean up
            document.body.style.overflow = originalStyle;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            document.body.style.paddingRight = originalPaddingRight;
        };
    }, [isModalOpen]);

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

    // Immediately load user data on mount and when eventRequests change
    useEffect(() => {
        if (eventRequests && eventRequests.length > 0) {
            // First update with existing data from props
            setLocalEventRequests(eventRequests);
            // Then refresh user data
            refreshUserDataAndUpdate(eventRequests);
        }
    }, [eventRequests]);

    // Ensure user data is loaded immediately when component mounts
    useEffect(() => {
        // Refresh user data immediately on mount
        refreshUserDataAndUpdate();

        // Set up auto-refresh every 30 seconds
        const refreshInterval = setInterval(() => {
            refreshUserDataAndUpdate();
        }, 30000); // 30 seconds

        // Clear interval on unmount
        return () => {
            clearInterval(refreshInterval);
        };
    }, []);

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
    }, []);

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
            {/* Table component with modernized UI */}
            <div
                className="bg-gradient-to-b from-base-200 to-base-300 rounded-xl shadow-xl overflow-hidden dashboard-card card-enter event-table-container border border-base-300/30"
                style={{ animationDelay: ANIMATION_DELAY }}
            >
                <div className="p-4 md:p-6 h-auto">

                    <div id="event-request-table-container" className="relative">
                        <TableWrapper
                            eventRequests={localEventRequests}
                            handleSelectRequest={handleSelectRequest}
                            handleStatusChange={handleStatusChange}
                            isLoadingUserData={isLoadingUserData}
                        />
                    </div>
                </div>
            </div>

            {/* Modal with improved styling */}
            <AnimatePresence>
                {isModalOpen && selectedRequest && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200]"
                    >
                        <div className="flex items-center justify-center min-h-screen p-4 overflow-hidden">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-base-200 to-base-300 rounded-xl shadow-2xl border border-base-100/20 relative"
                            >
                                <div className="sticky top-0 right-0 z-[201] flex justify-between items-center p-4 bg-base-300/80 backdrop-blur-md border-b border-base-100/10">
                                    <h2 className="text-xl font-bold text-white">{selectedRequest.name}</h2>
                                    <button
                                        onClick={closeModal}
                                        className="btn btn-circle btn-sm bg-base-100/20 hover:bg-base-100/40 border-none text-white"
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
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default EventRequestModal; 