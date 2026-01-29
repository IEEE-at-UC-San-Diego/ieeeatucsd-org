import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Switch } from '@heroui/react';
import { AlertTriangle, Calendar, CheckCircle2, Clock, MapPin, Megaphone, Settings, Users } from 'lucide-react';
import { canApproveOrPublish } from '../utils/permissionUtils';
import { formatDate, formatDateTime, getStatusColor, getUserName } from './utils';
import type { EventRequest, UserDirectory, UserOption } from './types';
import type { UserRole } from '../../../shared/types/firestore';

interface EventDetailsTabProps {
    request: EventRequest;
    eventCode: string;
    pointsToReward: number;
    publishStatus: boolean;
    isPublishUpdating: boolean;
    onPublishToggle: () => void;
    onStatusChange: (status: string) => void;
    currentUserRole: string;
    availableUsers: UserOption[];
    onRequestedUserChange: (userId: string) => Promise<void>;
    users: UserDirectory;
}

export default function EventDetailsTab({
    request,
    eventCode,
    pointsToReward,
    publishStatus,
    isPublishUpdating,
    onPublishToggle,
    onStatusChange,
    currentUserRole,
    availableUsers,
    onRequestedUserChange,
    users
}: EventDetailsTabProps) {
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(request.requestedUser);

    useEffect(() => {
        setSelectedUserId(request.requestedUser);
        setIsEditingUser(false);
        setUserSearchQuery('');
        setShowUserDropdown(false);
    }, [request.id, request.requestedUser]);

    const filteredUsers = useMemo(() => {
        const query = userSearchQuery.trim().toLowerCase();
        if (!query) return availableUsers;
        return availableUsers.filter(user =>
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
        );
    }, [availableUsers, userSearchQuery]);

    const handleUserSelect = (userId: string) => {
        const selectedUser = availableUsers.find(user => user.id === userId);
        setSelectedUserId(userId);
        setUserSearchQuery(selectedUser ? `${selectedUser.name} (${selectedUser.email})` : '');
        setShowUserDropdown(false);
    };

    const handleSubmittedUserSave = async () => {
        if (!selectedUserId || selectedUserId === request.requestedUser) {
            setIsEditingUser(false);
            setUserSearchQuery('');
            return;
        }

        try {
            await onRequestedUserChange(selectedUserId);
        } finally {
            setIsEditingUser(false);
            setUserSearchQuery('');
        }
    };

    const handleSubmittedUserCancel = () => {
        setIsEditingUser(false);
        setUserSearchQuery('');
        setSelectedUserId(request.requestedUser);
        setShowUserDropdown(false);
    };

    const canManageStatus = canApproveOrPublish(currentUserRole as UserRole);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <Card shadow="sm" className="border border-gray-200">
                        <CardHeader className="flex gap-2 pb-3">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <h3 className="text-lg font-semibold text-gray-900">Event Details</h3>
                        </CardHeader>
                        <CardBody className="space-y-3 pt-0">
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Event Name</label>
                                <p className="text-sm text-gray-900 mt-1">{request.name}</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Description</label>
                                <p className="text-sm text-gray-900 mt-1 whitespace-pre-line">{request.eventDescription}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Department</label>
                                <Chip color="primary" variant="flat" size="sm">
                                    {request.department || 'General'}
                                </Chip>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Location</label>
                                <p className="text-sm text-gray-900 flex items-center gap-1.5 mt-1">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    {request.location}
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Attendance</label>
                                <p className="text-sm text-gray-900 flex items-center gap-1.5 mt-1">
                                    <Users className="w-4 h-4 text-gray-400" />
                                    {request.expectedAttendance || 'Not specified'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Event Code</label>
                                <p className="text-sm text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">
                                    {eventCode || 'Not specified'}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Points to Reward</label>
                                <Chip color="success" variant="flat" size="sm">
                                    {pointsToReward} points
                                </Chip>
                            </div>
                        </CardBody>
                    </Card>

                    <Card shadow="sm" className="border border-gray-200">
                        <CardHeader className="flex gap-2 pb-3">
                            <Settings className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-lg font-semibold text-gray-900">Publication Settings</h3>
                        </CardHeader>
                        <CardBody className="pt-0">
                            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex-1">
                                    <label className="text-sm font-semibold text-gray-900">Event Published</label>
                                    <p className="text-xs text-gray-600 mt-1">
                                        {publishStatus ? 'Event is visible to members on the events page' : 'Event is hidden from members'}
                                    </p>
                                    {request.status !== 'approved' && (
                                        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" />
                                            Publishing is only available for approved events
                                        </p>
                                    )}
                                </div>
                                <Switch
                                    isSelected={publishStatus}
                                    onValueChange={onPublishToggle}
                                    isDisabled={isPublishUpdating || request.status !== 'approved'}
                                    color="success"
                                    size="lg"
                                    aria-label="Toggle event publication"
                                />
                            </div>
                        </CardBody>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card shadow="sm" className="border border-gray-200">
                        <CardHeader className="flex gap-2 pb-3">
                            <Users className="w-5 h-5 text-purple-600" />
                            <h3 className="text-lg font-semibold text-gray-900">Request Information</h3>
                        </CardHeader>
                        <CardBody className="space-y-3 pt-0">
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</label>
                                {currentUserRole === 'Administrator' && !isEditingUser ? (
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-sm text-gray-900">{getUserName(users, request.requestedUser)}</p>
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                            color="primary"
                                            onPress={() => setIsEditingUser(true)}
                                            aria-label="Edit submitted user"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : currentUserRole === 'Administrator' && isEditingUser ? (
                                    <div className="space-y-2 mt-1">
                                        <div className="relative">
                                            <Input
                                                type="text"
                                                value={userSearchQuery}
                                                onChange={(e) => {
                                                    setUserSearchQuery(e.target.value);
                                                    setShowUserDropdown(true);
                                                }}
                                                onFocus={() => setShowUserDropdown(true)}
                                                placeholder="Search users by name or email..."
                                                size="sm"
                                            />
                                            {showUserDropdown && filteredUsers.length > 0 && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg max-h-48 overflow-y-auto">
                                                    {filteredUsers.map(user => (
                                                        <button
                                                            key={user.id}
                                                            onClick={() => handleUserSelect(user.id)}
                                                            className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none text-sm border-b border-gray-100 last:border-b-0"
                                                        >
                                                            <div className="font-medium text-gray-900">{user.name}</div>
                                                            <div className="text-gray-600 text-xs">{user.email}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {showUserDropdown && userSearchQuery && filteredUsers.length === 0 && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-2xl shadow-lg p-3 text-sm text-gray-500">
                                                    No users found
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" color="primary" onPress={handleSubmittedUserSave}>
                                                Save
                                            </Button>
                                            <Button size="sm" variant="bordered" onPress={handleSubmittedUserCancel}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-900 mt-1">{getUserName(users, request.requestedUser)}</p>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted On</label>
                                <p className="text-sm text-gray-900 mt-1">{formatDate(request.createdAt)}</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block">Status</label>
                                {canManageStatus ? (
                                    <Select
                                        selectedKeys={[request.status]}
                                        onChange={(e) => onStatusChange(e.target.value)}
                                        size="sm"
                                        className="mt-1"
                                        aria-label="Event Status"
                                    >
                                        <SelectItem key="submitted">Submitted</SelectItem>
                                        <SelectItem key="needs_review">Needs Review</SelectItem>
                                        <SelectItem key="approved">Approved</SelectItem>
                                        <SelectItem key="declined">Declined</SelectItem>
                                    </Select>
                                ) : (
                                    <Chip color={getStatusColor(request.status)} variant="flat" size="sm" className="mt-1 capitalize">
                                        {request.status.replace('_', ' ')}
                                    </Chip>
                                )}
                            </div>
                            {request.declinedReason && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                    <label className="text-xs font-medium text-red-700 uppercase tracking-wider">Declined Reason</label>
                                    <p className="text-sm text-red-900 mt-1">{request.declinedReason}</p>
                                </div>
                            )}
                            {request.reviewFeedback && (
                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                                    <label className="text-xs font-medium text-orange-700 uppercase tracking-wider">Review Feedback</label>
                                    <p className="text-sm text-orange-900 mt-1">{request.reviewFeedback}</p>
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    <Card shadow="sm" className="border border-gray-200">
                        <CardHeader className="flex gap-2 pb-3">
                            <Clock className="w-5 h-5 text-green-600" />
                            <h3 className="text-lg font-semibold text-gray-900">Schedule</h3>
                        </CardHeader>
                        <CardBody className="pt-0 space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date &amp; Time</label>
                                <p className="text-sm text-gray-900 mt-1">{formatDateTime(request.startDateTime)}</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">End Date &amp; Time</label>
                                <p className="text-sm text-gray-900 mt-1">{formatDateTime(request.endDateTime)}</p>
                            </div>
                        </CardBody>
                    </Card>
                </div>
            </div>

            <Card shadow="sm" className="border border-gray-200">
                <CardHeader className="flex gap-2 pb-3">
                    <Megaphone className="w-5 h-5 text-orange-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Requirements &amp; Logistics</h3>
                </CardHeader>
                <CardBody className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                            {request.needsGraphics ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                            )}
                            <span className="text-sm text-gray-700">Graphics Required</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {request.needsAsFunding ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                            )}
                            <span className="text-sm text-gray-700">AS Funding Required</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {(request.flyersNeeded || (request.flyerType && request.flyerType.length > 0)) ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                            )}
                            <span className="text-sm text-gray-700">Flyers Needed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {request.photographyNeeded ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                            )}
                            <span className="text-sm text-gray-700">Photography Needed</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {((request.hasRoomBooking ?? request.willOrHaveRoomBooking) &&
                                (request.roomBookingFiles && request.roomBookingFiles.length > 0)) ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                            )}
                            <span className="text-sm text-gray-700">Room Booking</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {(request.servingFoodDrinks ?? request.foodDrinksBeingServed) ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                            )}
                            <span className="text-sm text-gray-700">Food &amp; Drinks Served</span>
                        </div>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
