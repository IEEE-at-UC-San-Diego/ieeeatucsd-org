import { useState } from 'react';
import { Plus, List, CalendarDays, Search } from 'lucide-react';
import { Card, CardHeader, CardBody, Button, Tabs, Tab, Switch } from '@heroui/react';
import { auth } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { showToast } from '../../shared/utils/toast';
import { EventManagementStats } from './EventManagementStats';
import EventRequestModal from './EventRequestModal';
import EventViewModal from './EventViewModal';
import FileManagementModal from './FileManagementModal';
import BulkActionsModal from './BulkActionsModal';
import GraphicsUploadModal from './GraphicsUploadModal';
import { TableSkeleton } from '../../../ui/loading';
import { EventsTable } from './components/EventsTable';
import { EventsPagination } from './components/EventsPagination';
import { EventCalendarView } from './components/EventCalendarView';
import { DateRangeFilter } from './components/DateRangeFilter';
import { StatusFilter } from './components/StatusFilter';
import DraftEventModal from './components/DraftEventModal';
import { DraftViewModal } from './components/DraftViewModal';
import { useEventManagement } from './hooks/useEventManagement';
import { canCreateEvent, canManageGraphics } from './utils/permissionUtils';

interface EventRequest {
    id: string;
    name: string;
    location: string;
    startDateTime: any;
    endDateTime: any;
    eventDescription: string;
    status: string;
    requestedUser: string;
    createdAt: any;
    department?: string;
    needsGraphics?: boolean;
    needsAsFunding?: boolean;
    graphicsCompleted?: boolean;
    graphicsFiles?: string[];
    flyersNeeded?: boolean;
    flyersCompleted?: boolean;
    [key: string]: any;
}

export default function ManageEventsContent() {
    const [user] = useAuthState(auth);

    // Tab state
    const [activeTab, setActiveTab] = useState<string>('list');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Modal states
    const [showEventRequestModal, setShowEventRequestModal] = useState(false);
    const [showDraftEventModal, setShowDraftEventModal] = useState(false);
    const [showDraftViewModal, setShowDraftViewModal] = useState(false);
    const [showEventViewModal, setShowEventViewModal] = useState(false);
    const [showFileManagementModal, setShowFileManagementModal] = useState(false);
    const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
    const [showEventTemplatesModal, setShowEventTemplatesModal] = useState(false);
    const [showGraphicsUploadModal, setShowGraphicsUploadModal] = useState(false);
    const [graphicsUploadRequest, setGraphicsUploadRequest] = useState<EventRequest | null>(null);
    const [editingRequest, setEditingRequest] = useState<EventRequest | null>(null);
    const [editingDraft, setEditingDraft] = useState<EventRequest | null>(null);
    const [viewingRequest, setViewingRequest] = useState<EventRequest | null>(null);
    const [viewingDraft, setViewingDraft] = useState<EventRequest | null>(null);
    const [managingFilesRequest, setManagingFilesRequest] = useState<EventRequest | null>(null);

    // Use custom hook for event management
    const {
        paginatedEventRequests,
        sortedEventRequests,
        users,
        loading,
        attendanceLoading,
        currentUserRole,
        searchTerm,
        sortBy,
        currentPage,
        totalPages,
        startIndex,
        endIndex,
        stats,
        dateRangeFilter,
        statusFilter,
        setSearchTerm,
        setSortBy,
        setCurrentPage,
        setDateRangeFilter,
        setStatusFilter,
        handleDeleteRequest,
        getUserName
    } = useEventManagement(user?.uid);

    // Event handlers
    const handleEditRequest = (request: EventRequest) => {
        // Check if this is a draft event
        const isDraftEvent = request.isDraft === true || request.status === 'draft';

        if (isDraftEvent) {
            // Open draft edit modal for draft events
            setEditingDraft(request);
            setShowDraftEventModal(true);
        } else {
            // Open full event request modal for non-draft events
            setEditingRequest(request);
            setShowEventRequestModal(true);
        }
    };

    const handleViewRequest = (request: EventRequest) => {
        // Check if this is a draft event
        const isDraftEvent = request.isDraft === true || request.status === 'draft';

        if (isDraftEvent) {
            setViewingDraft(request);
            setShowDraftViewModal(true);
        } else {
            setViewingRequest(request);
            setShowEventViewModal(true);
        }
    };

    const handleFileManagement = (request: EventRequest) => {
        setManagingFilesRequest(request);
        setShowFileManagementModal(true);
    };

    const handleGraphicsToggle = async (requestId: string, isCompleted: boolean) => {
        // Any officer can toggle graphics completion and upload files
        if (['General Officer', 'Executive Officer', 'Administrator'].includes(currentUserRole)) {
            // Always show upload modal for any toggle (check or uncheck)
            const request = sortedEventRequests.find(req => req.id === requestId);
            if (request) {
                setGraphicsUploadRequest(request);
                setShowGraphicsUploadModal(true);
            }
        } else {
            showToast.error('You do not have permission to manage graphics');
        }
    };

    const handleSearch = (term: string) => {
        setSearchTerm(term);
        setCurrentPage(1);
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setSortBy('date-desc');
        setDateRangeFilter('all');
        setStatusFilter('all');
        setCurrentPage(1);
    };

    const handleSort = (column: string) => {
        let newSortBy = '';
        switch (column) {
            case 'name':
                newSortBy = sortBy === 'name-asc' ? 'name-desc' : 'name-asc';
                break;
            case 'date':
                newSortBy = sortBy === 'date-asc' ? 'date-desc' : 'date-asc';
                break;
            case 'status':
                newSortBy = sortBy === 'status-asc' ? 'status-desc' : 'status-asc';
                break;
            default:
                newSortBy = 'date-desc';
        }
        setSortBy(newSortBy);
        setCurrentPage(1);
    };

    const handleCreateEventFromCalendar = (date: Date) => {
        setSelectedDate(date);
        setShowDraftEventModal(true);
    };

    const handleConvertDraftToFull = (request: EventRequest) => {
        setEditingRequest(request);
        setShowEventRequestModal(true);
    };

    const handleConvertDraftFromView = () => {
        if (viewingDraft) {
            setShowDraftViewModal(false);
            setEditingRequest(viewingDraft);
            setShowEventRequestModal(true);
            setViewingDraft(null); // Clear the viewingDraft state
        }
    };

    const handleEditDraftFromView = () => {
        if (viewingDraft) {
            setShowDraftViewModal(false);
            setEditingDraft(viewingDraft);
            setShowDraftEventModal(true);
        }
    };

    const handleDeleteDraft = async () => {
        if (viewingDraft) {
            try {
                await handleDeleteRequest(viewingDraft.id, viewingDraft.name);
                setShowDraftViewModal(false);
                setViewingDraft(null);
            } catch (error) {
                // handleDeleteRequest likely sets error state internally,
                // but keep modal open so user can retry
                console.error('Failed to delete draft:', error);
            }
        }
    };

    return (
        <div className="flex-1 overflow-auto">
            <main className="p-4 md:p-6">
                <div className="space-y-6">
                    {/* Stats Overview */}
                    <EventManagementStats stats={stats} loading={loading} attendanceLoading={attendanceLoading} />

                    {/* Tabs for View Switcher */}
                    <Card shadow="sm" className="border border-gray-200">
                        <CardBody className="p-0">
                            <Tabs
                                selectedKey={activeTab}
                                onSelectionChange={(key) => setActiveTab(key as string)}
                                aria-label="Event management views"
                                variant="underlined"
                                color="primary"
                                classNames={{
                                    base: "w-full",
                                    tabList: "w-full px-6 pt-6 gap-8 relative",
                                    tab: "px-0 py-4 h-12 font-semibold text-gray-600 data-[selected=true]:text-primary data-[hover=true]:text-primary transition-all duration-200 ease-in-out",
                                    tabContent: "group-data-[selected=true]:text-primary group-data-[selected=true]:font-semibold",
                                    cursor: "bg-primary rounded-full h-0.5 transition-all duration-200 ease-in-out",
                                    panel: "px-6 py-6 mt-2"
                                }}
                            >
                                <Tab
                                    key="list"
                                    title={
                                        <div className="flex items-center gap-2">
                                            <List className="w-4 h-4" />
                                            <span className="font-medium">Events List</span>
                                        </div>
                                    }
                                >


                                    {/* Event Requests Table */}
                                    <Card key={currentUserRole} shadow="sm" className="border border-gray-200">
                                        <CardHeader className="flex flex-col sm:flex-row gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50 items-center justify-between">
                                            {/* Title Section */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <h2 className="text-sm font-bold text-gray-900">
                                                    Event Requests
                                                </h2>
                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                                                    {sortedEventRequests.length}
                                                </span>
                                            </div>

                                            {/* Controls Section */}
                                            <div className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
                                                <div className="relative flex-1 w-full sm:w-[240px]">
                                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                                    <input
                                                        id="event-search"
                                                        type="text"
                                                        placeholder="Search events..."
                                                        value={searchTerm}
                                                        onChange={(e) => handleSearch(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-xs h-9"
                                                    />
                                                </div>
                                                <div className="flex gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0 items-center w-full sm:w-auto">
                                                    <DateRangeFilter
                                                        selectedRange={dateRangeFilter}
                                                        onRangeChange={setDateRangeFilter}
                                                    />
                                                    <StatusFilter
                                                        selectedStatus={statusFilter}
                                                        onStatusChange={setStatusFilter}
                                                    />
                                                    {searchTerm && (
                                                        <Button
                                                            isIconOnly
                                                            variant="flat"
                                                            color="danger"
                                                            size="sm"
                                                            onPress={handleClearFilters}
                                                            className="h-9 w-9 min-w-9"
                                                            title="Clear filters"
                                                        >
                                                            ✕
                                                        </Button>
                                                    )}
                                                    {canCreateEvent(currentUserRole) && (
                                                        <Button
                                                            color="primary"
                                                            size="sm"
                                                            startContent={<Plus className="w-3.5 h-3.5" />}
                                                            onPress={() => setShowEventRequestModal(true)}
                                                            className="font-medium shadow-md shadow-primary/20 h-9"
                                                        >
                                                            Request Event
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardBody className="p-0">
                                            <div className="overflow-x-auto">
                                                {loading ? (
                                                    <TableSkeleton rows={5} columns={7} />
                                                ) : paginatedEventRequests.length === 0 ? (
                                                    <div className="p-6 text-center">
                                                        <p className="text-gray-500">
                                                            {sortedEventRequests.length === 0 ? 'No event requests found' : 'No events match the current filters'}
                                                        </p>
                                                        {sortedEventRequests.length > 0 && (
                                                            <Button
                                                                variant="light"
                                                                color="primary"
                                                                onPress={handleClearFilters}
                                                                className="mt-2"
                                                            >
                                                                Clear filters
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <EventsTable
                                                        eventRequests={paginatedEventRequests}
                                                        sortBy={sortBy}
                                                        currentUserRole={currentUserRole}
                                                        currentUserId={user?.uid}
                                                        onSort={handleSort}
                                                        onViewRequest={handleViewRequest}
                                                        onEditRequest={handleEditRequest}
                                                        onDeleteRequest={handleDeleteRequest}
                                                        onGraphicsToggle={handleGraphicsToggle}
                                                        onConvertDraftToFull={handleConvertDraftToFull}
                                                        getUserName={getUserName}
                                                    />
                                                )}
                                            </div>
                                        </CardBody>
                                    </Card>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="mt-4">
                                            <EventsPagination
                                                currentPage={currentPage}
                                                totalPages={totalPages}
                                                totalItems={sortedEventRequests.length}
                                                startIndex={startIndex}
                                                endIndex={endIndex}
                                                onPageChange={setCurrentPage}
                                            />
                                        </div>
                                    )}
                                </Tab>

                                <Tab
                                    key="calendar"
                                    title={
                                        <div className="flex items-center gap-2">
                                            <CalendarDays className="w-4 h-4" />
                                            <span className="font-medium">Event Planning</span>
                                        </div>
                                    }
                                >
                                    <EventCalendarView
                                        eventRequests={sortedEventRequests}
                                        onCreateEvent={handleCreateEventFromCalendar}
                                        onViewEvent={handleViewRequest}
                                        onEditEvent={handleEditRequest}
                                        onConvertDraftToFull={handleConvertDraftToFull}
                                        currentUserRole={currentUserRole}
                                    />
                                </Tab>
                            </Tabs>
                        </CardBody>
                    </Card>

                    {/* Draft Event Modal */}
                    <DraftEventModal
                        isOpen={showDraftEventModal}
                        onClose={() => {
                            setShowDraftEventModal(false);
                            setSelectedDate(null);
                            setEditingDraft(null);
                        }}
                        preselectedDate={selectedDate}
                        editingDraft={editingDraft}
                        onSuccess={() => {
                            setShowDraftEventModal(false);
                            setSelectedDate(null);
                            setEditingDraft(null);
                        }}
                    />

                    {/* Event Request Modal */}
                    {showEventRequestModal && (
                        <EventRequestModal
                            onClose={() => {
                                setShowEventRequestModal(false);
                                setEditingRequest(null);
                                setSelectedDate(null);
                            }}
                            editingRequest={editingRequest}
                            preselectedDate={selectedDate}
                            onSuccess={() => {
                                // Real-time updates will handle the refresh automatically
                                showToast.success(editingRequest ? 'Event request updated successfully' : 'Event request created successfully');
                                setSelectedDate(null);
                            }}
                        />
                    )
                    }

                    {/* Draft View Modal */}
                    {
                        showDraftViewModal && viewingDraft && (
                            <DraftViewModal
                                isOpen={showDraftViewModal}
                                onClose={() => {
                                    setShowDraftViewModal(false);
                                    setViewingDraft(null);
                                }}
                                draftEvent={viewingDraft}
                                onConvertToFull={handleConvertDraftFromView}
                                onEdit={handleEditDraftFromView}
                                onDelete={handleDeleteDraft}
                                userName={getUserName(viewingDraft.requestedUser)}
                            />
                        )
                    }

                    {/* Event View Modal */}
                    {
                        showEventViewModal && (
                            <EventViewModal
                                request={viewingRequest}
                                users={users}
                                onClose={() => {
                                    setShowEventViewModal(false);
                                    setViewingRequest(null);
                                }}
                                onSuccess={() => {
                                    // The real-time listener will automatically update the data
                                    // No need to manually refresh since we're using onSnapshot
                                }}
                            />
                        )
                    }

                    {/* File Management Modal */}
                    {
                        showFileManagementModal && (
                            <FileManagementModal
                                request={managingFilesRequest}
                                onClose={() => {
                                    setShowFileManagementModal(false);
                                    setManagingFilesRequest(null);
                                }}
                            />
                        )
                    }

                    {/* Bulk Actions Modal */}
                    {
                        showBulkActionsModal && (
                            <BulkActionsModal
                                events={sortedEventRequests}
                                users={users}
                                onClose={() => setShowBulkActionsModal(false)}
                                onSuccess={(message: string) => showToast.success(message)}
                                onError={(message: string) => showToast.error(message)}
                            />
                        )
                    }

                    {/* Graphics Upload Modal */}
                    {
                        showGraphicsUploadModal && graphicsUploadRequest && (
                            <GraphicsUploadModal
                                request={graphicsUploadRequest}
                                onClose={() => {
                                    setShowGraphicsUploadModal(false);
                                    setGraphicsUploadRequest(null);
                                }}
                                onSuccess={() => {
                                    showToast.success('Graphics files uploaded and marked as completed');
                                    // Real-time listener will automatically update the data
                                }}
                            />
                        )
                    }

                </div>
            </main>
        </div>
    );
}