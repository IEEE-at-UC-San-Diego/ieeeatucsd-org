import React, { useState } from 'react';
import { X, Check, Trash2, Download, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';
import { getFirestore, collection, doc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { app } from '../../../../firebase/client';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { Alert, AlertDescription } from '../../../ui/alert';
import { Separator } from '../../../ui/separator';

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
}

interface BulkActionsModalProps {
    events: EventRequest[];
    users: Record<string, { name: string; email: string }>;
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

export default function BulkActionsModal({ events, users, onClose, onSuccess, onError }: BulkActionsModalProps) {
    const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
    const [bulkAction, setBulkAction] = useState<string>('');
    const [newStatus, setNewStatus] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [selectAll, setSelectAll] = useState(false);

    const db = getFirestore(app);

    const handleEventSelection = (eventId: string) => {
        setSelectedEvents(prev =>
            prev.includes(eventId)
                ? prev.filter(id => id !== eventId)
                : [...prev, eventId]
        );
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedEvents([]);
        } else {
            setSelectedEvents(events.map(event => event.id));
        }
        setSelectAll(!selectAll);
    };

    const handleBulkAction = async () => {
        if (selectedEvents.length === 0) {
            onError('Please select at least one event');
            return;
        }

        if (!bulkAction) {
            onError('Please select an action');
            return;
        }

        try {
            setLoading(true);

            switch (bulkAction) {
                case 'update-status':
                    if (!newStatus) {
                        onError('Please select a status');
                        return;
                    }
                    await updateEventStatuses();
                    break;
                case 'publish':
                    await publishEvents(true);
                    break;
                case 'unpublish':
                    await publishEvents(false);
                    break;
                case 'delete':
                    await deleteEvents();
                    break;
                case 'export':
                    await exportEvents();
                    break;
                default:
                    onError('Invalid action selected');
                    return;
            }

        } catch (error) {
            console.error('Bulk action error:', error);
            onError('Failed to perform bulk action');
        } finally {
            setLoading(false);
        }
    };

    const updateEventStatuses = async () => {
        for (const eventId of selectedEvents) {
            await updateDoc(doc(db, 'event_requests', eventId), {
                status: newStatus,
                updatedAt: new Date()
            });
        }
        onSuccess(`Updated status to ${newStatus} for ${selectedEvents.length} events`);
        onClose();
    };

    const publishEvents = async (published: boolean) => {
        for (const eventId of selectedEvents) {
            // Find and update the corresponding event in events collection
            const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', eventId));
            const eventsSnapshot = await getDocs(eventsQuery);

            if (!eventsSnapshot.empty) {
                const eventDoc = eventsSnapshot.docs[0];
                await updateDoc(doc(db, 'events', eventDoc.id), {
                    published: published,
                    updatedAt: new Date()
                });
            }
        }
        onSuccess(`${published ? 'Published' : 'Unpublished'} ${selectedEvents.length} events`);
        onClose();
    };

    const deleteEvents = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedEvents.length} events? This action cannot be undone.`)) {
            return;
        }

        for (const eventId of selectedEvents) {
            // Delete from event_requests collection
            await deleteDoc(doc(db, 'event_requests', eventId));

            // Find and delete corresponding event from events collection
            const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', eventId));
            const eventsSnapshot = await getDocs(eventsQuery);

            for (const eventDoc of eventsSnapshot.docs) {
                await deleteDoc(doc(db, 'events', eventDoc.id));
            }
        }
        onSuccess(`Deleted ${selectedEvents.length} events`);
        onClose();
    };

    const exportEvents = async () => {
        const selectedEventData = events.filter(event => selectedEvents.includes(event.id));
        const csvContent = generateCSV(selectedEventData);

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `events_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        onSuccess(`Exported ${selectedEvents.length} events to CSV`);
        onClose();
    };

    const generateCSV = (events: EventRequest[]) => {
        const headers = ['Event Name', 'Location', 'Start Date', 'End Date', 'Status', 'Requested By', 'Created Date'];
        const rows = events.map(event => [
            event.name,
            event.location,
            new Date(event.startDateTime.toDate()).toLocaleString(),
            new Date(event.endDateTime.toDate()).toLocaleString(),
            event.status,
            users[event.requestedUser]?.name || event.requestedUser,
            new Date(event.createdAt.toDate()).toLocaleString()
        ]);

        return [headers, ...rows].map(row =>
            row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-800 border-green-200';
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Bulk Actions</h2>
                        <p className="text-sm text-gray-600">Perform actions on multiple events</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Action Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Select Action</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Bulk Action</label>
                                    <Select value={bulkAction} onValueChange={setBulkAction}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select action" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="update-status">Update Status</SelectItem>
                                            <SelectItem value="publish">Publish Events</SelectItem>
                                            <SelectItem value="unpublish">Unpublish Events</SelectItem>
                                            <SelectItem value="delete">Delete Events</SelectItem>
                                            <SelectItem value="export">Export to CSV</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {bulkAction === 'update-status' && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">New Status</label>
                                        <Select value={newStatus} onValueChange={setNewStatus}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="pending">Pending</SelectItem>
                                                <SelectItem value="approved">Approved</SelectItem>
                                                <SelectItem value="rejected">Rejected</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-600">
                                    {selectedEvents.length} of {events.length} events selected
                                </p>
                                <Button
                                    onClick={handleBulkAction}
                                    disabled={loading || selectedEvents.length === 0 || !bulkAction}
                                    className="ml-4"
                                >
                                    {loading ? 'Processing...' : 'Apply Action'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Separator />

                    {/* Event Selection */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Select Events</CardTitle>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSelectAll}
                                    className="flex items-center space-x-2"
                                >
                                    {selectAll ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                    <span>{selectAll ? 'Deselect All' : 'Select All'}</span>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {events.map((event) => (
                                    <div
                                        key={event.id}
                                        className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${selectedEvents.includes(event.id)
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:bg-gray-50'
                                            }`}
                                        onClick={() => handleEventSelection(event.id)}
                                    >
                                        <div className="flex-shrink-0">
                                            {selectedEvents.includes(event.id) ? (
                                                <CheckSquare className="w-5 h-5 text-blue-600" />
                                            ) : (
                                                <Square className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-gray-900 truncate">{event.name}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {event.location} • {new Date(event.startDateTime.toDate()).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Badge className={getStatusColor(event.status)}>
                                                        {event.status}
                                                    </Badge>
                                                    {event.published && (
                                                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                                            Published
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
} 