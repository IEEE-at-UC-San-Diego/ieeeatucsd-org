import React from 'react';
import { Edit, Trash2, Eye, ChevronUp, ChevronDown, ChevronsUpDown, MapPin, Calendar, FileUp } from 'lucide-react';
import { Button, Chip, Tooltip, Checkbox } from '@heroui/react';
import { getStatusColor, getStatusIcon } from '../utils/statusUtils';
import { canEditEvent as checkCanEditEvent, canDeleteEvent as checkCanDeleteEvent, canManageGraphics } from '../utils/permissionUtils';
import type { UserRole } from '../../../shared/types/firestore';

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
    needsGraphics?: boolean;
    needsAsFunding?: boolean;
    graphicsCompleted?: boolean;
    graphicsFiles?: string[];
    published?: boolean;
    isDraft?: boolean;
}

interface EventsTableProps {
    eventRequests: EventRequest[];
    sortBy: string;
    currentUserRole: UserRole;
    currentUserId: string | undefined;
    onSort: (column: string) => void;
    onViewRequest: (request: EventRequest) => void;
    onEditRequest: (request: EventRequest) => void;
    onDeleteRequest: (requestId: string, eventName: string) => void;
    onGraphicsToggle: (requestId: string, isCompleted: boolean) => void;
    onConvertDraftToFull?: (request: EventRequest) => void;
    getUserName: (userId: string) => string;
}

export function EventsTable({
    eventRequests,
    sortBy,
    currentUserRole,
    currentUserId,
    onSort,
    onViewRequest,
    onEditRequest,
    onDeleteRequest,
    onGraphicsToggle,
    onConvertDraftToFull,
    getUserName
}: EventsTableProps) {
    const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
        <th
            className="px-2 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100/80 hover:text-gray-700 transition-colors select-none group"
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1">
                <span>{children}</span>
                {(sortBy === `${field}-asc` || sortBy === `${field}-desc`) ? (
                    <div className="p-0.5 bg-gray-200 rounded text-gray-700">
                        {sortBy === `${field}-asc` ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                ) : (
                    <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                )}
            </div>
        </th>
    );

    const canEditEvent = (request: EventRequest) => checkCanEditEvent(request, currentUserId, currentUserRole);
    const canDeleteEvent = (request: EventRequest) => checkCanDeleteEvent(request, currentUserId, currentUserRole);

    // Helper to format date
    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'No date';
        const date = timestamp?.toDate?.() || new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    // Helper to truncate text
    const truncateText = (text: string, maxLength: number) => {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    // Helper to get status chip color
    const getChipColor = (status: string): "success" | "primary" | "warning" | "danger" | "default" | "secondary" => {
        switch (status) {
            case 'approved':
                return 'success';
            case 'draft':
                return 'default';
            case 'submitted':
                return 'secondary';
            case 'pending':
            case 'needs_review':
                return 'warning';
            case 'declined':
            case 'rejected':
                return 'danger';
            default:
                return 'default';
        }
    };

    return (
        <div className="relative overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                        <SortableHeader field="name">Event Details</SortableHeader>
                        <SortableHeader field="date">Date</SortableHeader>
                        <th className="px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                            Location
                        </th>
                        <SortableHeader field="status">Status</SortableHeader>
                        <th className="px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                            Published
                        </th>
                        <th className="px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hidden xl:table-cell">
                            Requirements
                        </th>
                        <th className="px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                            Submitted By
                        </th>
                        <th className="px-2 py-2 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                    {eventRequests.map((request) => {
                        const StatusIcon = getStatusIcon(request.status);

                        return (
                            <tr key={request.id} className="group hover:bg-gray-50/80 transition-colors duration-200">
                                {/* Event Details Column */}
                                <td className="px-2 py-2">
                                    <div className="max-w-[180px]">
                                        <Tooltip content={request.name} delay={500} closeDelay={0}>
                                            <div className="text-xs font-semibold text-gray-900 truncate">
                                                {truncateText(request.name, 30)}
                                            </div>
                                        </Tooltip>
                                        <Tooltip content={request.eventDescription} delay={500} closeDelay={0}>
                                            <div className="text-xs text-gray-500 truncate mt-0.5">
                                                {truncateText(request.eventDescription, 40)}
                                            </div>
                                        </Tooltip>
                                        {/* Show location on mobile */}
                                        <div className="lg:hidden flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                                            <MapPin className="w-3 h-3" />
                                            <span className="truncate">{truncateText(request.location, 20)}</span>
                                        </div>
                                    </div>
                                </td>

                                {/* Date Column */}
                                <td className="px-2 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-1 text-xs text-gray-700">
                                        <Calendar className="w-3 h-3 text-gray-400" />
                                        <span>{formatDate(request.startDateTime)}</span>
                                    </div>
                                </td>

                                {/* Location Column (hidden on mobile) */}
                                <td className="px-2 py-2 hidden lg:table-cell">
                                    <Tooltip content={request.location} delay={500} closeDelay={0}>
                                        <div className="flex items-center gap-1 max-w-[120px]">
                                            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                            <span className="text-xs text-gray-700 truncate">{truncateText(request.location, 25)}</span>
                                        </div>
                                    </Tooltip>
                                </td>

                                {/* Status Column */}
                                <td className="px-2 py-2">
                                    <Chip
                                        color={getChipColor(request.status)}
                                        variant="flat"
                                        size="sm"
                                        startContent={<StatusIcon className="w-3 h-3 flex-shrink-0" />}
                                        classNames={{
                                            base: "h-5 px-1 gap-1",
                                            content: "text-xs font-medium capitalize"
                                        }}
                                    >
                                        {request.status.replace('_', ' ')}
                                    </Chip>
                                </td>

                                {/* Published Status Column */}
                                <td className="px-2 py-2 hidden sm:table-cell">
                                    <Chip
                                        color={request.published ? "success" : (request.isDraft ? "default" : "default")}
                                        variant={request.isDraft ? "bordered" : "flat"}
                                        size="sm"
                                        classNames={{
                                            base: "h-5 px-1",
                                            content: "text-xs font-medium"
                                        }}
                                    >
                                        {request.published ? "Published" : (request.isDraft ? "DRAFT" : "Unpublished")}
                                    </Chip>
                                </td>

                                {/* Requirements Column (hidden on smaller screens) */}
                                <td className="px-2 py-2 hidden xl:table-cell">
                                    <div className="flex flex-col gap-1.5">
                                        {request.needsGraphics && (
                                            <div
                                                className="flex items-center gap-2 cursor-pointer select-none group/check"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (canManageGraphics(currentUserRole)) {
                                                        onGraphicsToggle(request.id, request.graphicsCompleted || false);
                                                    }
                                                }}
                                            >
                                                <div className="pointer-events-none">
                                                    <Checkbox
                                                        size="sm"
                                                        isSelected={request.graphicsCompleted}
                                                        isDisabled={!canManageGraphics(currentUserRole)}
                                                        isReadOnly
                                                        classNames={{
                                                            wrapper: "after:bg-secondary after:text-secondary-foreground"
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs font-medium text-gray-600 group-hover/check:text-gray-900 transition-colors">Graphics</span>
                                            </div>
                                        )}
                                        {request.needsAsFunding && (
                                            <Chip
                                                color="success"
                                                variant="flat"
                                                size="sm"
                                                className="h-5 text-xs px-1"
                                            >
                                                Funding
                                            </Chip>
                                        )}
                                        {!request.needsGraphics && !request.needsAsFunding && (
                                            <span className="text-xs text-gray-400 italic">None</span>
                                        )}
                                    </div>
                                </td>

                                {/* Submitted By Column (hidden on mobile) */}
                                <td className="px-2 py-2 hidden md:table-cell">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-gray-900">
                                            {getUserName(request.requestedUser)}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {formatDate(request.createdAt)}
                                        </span>
                                    </div>
                                </td>

                                {/* Actions Column */}
                                <td className="px-2 py-2 whitespace-nowrap text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <Tooltip content="View Details" delay={300} closeDelay={0}>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                onPress={() => onViewRequest(request)}
                                                className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 data-[hover=true]:bg-blue-50 w-8 h-8 min-w-8"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </Tooltip>

                                        {request.isDraft && request.status === 'draft' && onConvertDraftToFull && (
                                            <Tooltip content="Convert to Full Event Request" delay={300} closeDelay={0}>
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    onPress={() => onConvertDraftToFull(request)}
                                                    className="text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 data-[hover=true]:bg-indigo-50 w-8 h-8 min-w-8"
                                                >
                                                    <FileUp className="w-4 h-4" />
                                                </Button>
                                            </Tooltip>
                                        )}

                                        {canEditEvent(request) && (
                                            <Tooltip content="Edit Event" delay={300} closeDelay={0}>
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    onPress={() => onEditRequest(request)}
                                                    className="text-gray-500 hover:text-orange-600 hover:bg-orange-50 data-[hover=true]:bg-orange-50 w-8 h-8 min-w-8"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Tooltip>
                                        )}

                                        {canDeleteEvent(request) && (
                                            <Tooltip content="Delete Event" delay={300} closeDelay={0}>
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    color="danger"
                                                    onPress={() => onDeleteRequest(request.id, request.name)}
                                                    className="text-gray-400 hover:text-red-600 hover:bg-red-50 data-[hover=true]:bg-red-50 w-8 h-8 min-w-8"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

