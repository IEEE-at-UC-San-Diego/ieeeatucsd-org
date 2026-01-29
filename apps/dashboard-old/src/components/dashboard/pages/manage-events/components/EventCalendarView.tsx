import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader, Button, Chip, Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react';
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';

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
    published?: boolean;
    [key: string]: any;
}

interface EventCalendarViewProps {
    eventRequests: EventRequest[];
    onCreateEvent: (date: Date) => void;
    onViewEvent: (event: EventRequest) => void;
    onEditEvent: (event: EventRequest) => void;
    onConvertDraftToFull?: (event: EventRequest) => void;
    currentUserRole: string;
}

export function EventCalendarView({
    eventRequests,
    onCreateEvent,
    onViewEvent,
    onEditEvent,
    onConvertDraftToFull,
    currentUserRole
}: EventCalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showEventModal, setShowEventModal] = useState(false);

    // Get calendar days for the current month
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const calendarStart = startOfWeek(monthStart);
        const calendarEnd = endOfWeek(monthEnd);

        return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }, [currentMonth]);

    // Group events by date
    const eventsByDate = useMemo(() => {
        const grouped: { [key: string]: EventRequest[] } = {};

        eventRequests.forEach(event => {
            const eventDate = event.startDateTime?.toDate ? event.startDateTime.toDate() : new Date(event.startDateTime);
            const dateKey = format(eventDate, 'yyyy-MM-dd');

            if (!grouped[dateKey]) {
                grouped[dateKey] = [];
            }
            grouped[dateKey].push(event);
        });

        return grouped;
    }, [eventRequests]);

    // Get events for a specific date
    const getEventsForDate = (date: Date): EventRequest[] => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return eventsByDate[dateKey] || [];
    };

    // Determine event status color
    const getEventColor = (event: EventRequest): string => {
        // Check if event is published (approved)
        if (event.published) {
            return 'bg-green-100 border-green-400 text-green-800';
        }

        // Draft events - special styling
        if (isDraftEvent(event)) {
            return 'bg-gray-100 border-gray-400 text-gray-700 border-dashed';
        }

        // Other event statuses
        switch (event.status?.toLowerCase()) {
            case 'completed':
            case 'approved':
                return 'bg-blue-100 border-blue-400 text-blue-800';
            case 'submitted':
                return 'bg-purple-100 border-purple-400 text-purple-800';
            case 'pending':
                return 'bg-yellow-100 border-yellow-400 text-yellow-800';
            case 'needs_review':
                return 'bg-orange-100 border-orange-400 text-orange-800';
            case 'declined':
                return 'bg-red-100 border-red-400 text-red-800';
            default:
                return 'bg-gray-100 border-gray-400 text-gray-800';
        }
    };

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        const events = getEventsForDate(date);
        if (events.length > 0) {
            setShowEventModal(true);
        } else {
            // Create new event for this date
            onCreateEvent(date);
        }
    };

    const handleCreateEventOnSelectedDate = () => {
        if (selectedDate) {
            setShowEventModal(false);
            onCreateEvent(selectedDate);
        }
    };

    const handlePreviousMonth = () => {
        setCurrentMonth(prev => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(prev => addMonths(prev, 1));
    };

    const handleToday = () => {
        setCurrentMonth(new Date());
    };

    // Helper function to check if an event is a draft (case-insensitive)
    const isDraftEvent = (event: EventRequest): boolean => {
        return event.isDraft || event.status?.toLowerCase() === 'draft';
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="space-y-4">
            {/* Calendar Header */}
            <Card shadow="sm" className="border border-gray-200">
                <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <CalendarIcon className="w-6 h-6 text-[#0A2463]" />
                        <h2 className="text-xl font-semibold text-gray-900">
                            {format(currentMonth, 'MMMM yyyy')}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="flat"
                            onPress={handleToday}
                        >
                            Today
                        </Button>
                        <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={handlePreviousMonth}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={handleNextMonth}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            {/* Legend */}
            <Card shadow="sm" className="border border-gray-200">
                <CardBody className="px-6 py-3">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="font-medium text-gray-700">Legend:</span>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-gray-100 border-2 border-gray-400 border-dashed"></div>
                            <span className="text-gray-600">Draft</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-400"></div>
                            <span className="text-gray-600">Published</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-400"></div>
                            <span className="text-gray-600">Approved</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-purple-100 border-2 border-purple-400"></div>
                            <span className="text-gray-600">Submitted</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-yellow-100 border-2 border-yellow-400"></div>
                            <span className="text-gray-600">Pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-orange-100 border-2 border-orange-400"></div>
                            <span className="text-gray-600">Needs Review</span>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Calendar Grid */}
            <Card shadow="sm" className="border border-gray-200">
                <CardBody className="p-0">
                    {/* Week day headers */}
                    <div className="grid grid-cols-7 border-b border-gray-200">
                        {weekDays.map(day => (
                            <div
                                key={day}
                                className="px-2 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar days */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map((day, index) => {
                            const events = getEventsForDate(day);
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const isToday = isSameDay(day, new Date());

                            return (
                                <div
                                    key={index}
                                    className={`min-h-[120px] border-r border-b border-gray-200 p-2 cursor-pointer hover:bg-gray-50 transition-colors ${!isCurrentMonth ? 'bg-gray-50/50' : ''
                                        } ${isToday ? 'bg-blue-50' : ''}`}
                                    onClick={() => handleDateClick(day)}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span
                                            className={`text-sm font-medium ${!isCurrentMonth
                                                ? 'text-gray-400'
                                                : isToday
                                                    ? 'text-blue-600 font-bold'
                                                    : 'text-gray-700'
                                                }`}
                                        >
                                            {format(day, 'd')}
                                        </span>
                                        {isCurrentMonth && events.length === 0 && (
                                            <Plus className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                                        )}
                                    </div>

                                    {/* Events for this day */}
                                    <div className="space-y-1">
                                        {events.slice(0, 3).map((event, eventIndex) => (
                                            <div
                                                key={eventIndex}
                                                className={`text-xs px-2 py-1 rounded border-l-2 truncate ${getEventColor(event)}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Always use view handler - it will determine which modal to show
                                                    onViewEvent(event);
                                                }}
                                            >
                                                {event.name}
                                            </div>
                                        ))}
                                        {events.length > 3 && (
                                            <div className="text-xs text-gray-500 px-2">
                                                +{events.length - 3} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardBody>
            </Card>

            {/* Event List Modal for Selected Date */}
            <Modal
                isOpen={showEventModal}
                onClose={() => setShowEventModal(false)}
                size="2xl"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <h2 className="text-xl font-semibold">
                            Events on {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
                        </h2>
                        <p className="text-sm text-gray-600 font-normal">
                            You can create additional draft events on this date for planning purposes.
                        </p>
                    </ModalHeader>
                    <ModalBody className="pb-6">
                        <div className="space-y-3">
                            {/* Create New Draft Event Button */}
                            <Button
                                color="primary"
                                variant="flat"
                                startContent={<Plus className="w-4 h-4" />}
                                onPress={handleCreateEventOnSelectedDate}
                                className="w-full"
                            >
                                Create New Draft Event on This Date
                            </Button>

                            {/* Existing Events List */}
                            {selectedDate && getEventsForDate(selectedDate).map(event => (
                                <Card key={event.id} shadow="sm" className="border border-gray-200">
                                    <CardBody className="p-4">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900">{event.name}</h3>
                                                <p className="text-sm text-gray-600 mt-1">{event.location}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <Chip
                                                        size="sm"
                                                        variant="flat"
                                                        className={getEventColor(event)}
                                                    >
                                                        {event.published ? 'Published' : event.status}
                                                    </Chip>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                {isDraftEvent(event) && onConvertDraftToFull ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="flat"
                                                            onPress={() => {
                                                                setShowEventModal(false);
                                                                onViewEvent(event);
                                                            }}
                                                        >
                                                            View
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            color="primary"
                                                            variant="flat"
                                                            onPress={() => {
                                                                setShowEventModal(false);
                                                                onConvertDraftToFull(event);
                                                            }}
                                                        >
                                                            Convert to Full Event
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="flat"
                                                            onPress={() => {
                                                                setShowEventModal(false);
                                                                onViewEvent(event);
                                                            }}
                                                        >
                                                            View
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            color="primary"
                                                            variant="flat"
                                                            onPress={() => {
                                                                setShowEventModal(false);
                                                                onEditEvent(event);
                                                            }}
                                                        >
                                                            Edit
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            ))}
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </div>
    );
}
