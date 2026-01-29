import React, { useEffect, useState } from 'react';
import { Calendar, FileText, DollarSign, Users, Clock } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, Tabs, Tab, Chip } from '@heroui/react';
import { collection, doc, updateDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../../firebase/client';
import { EventAuditService } from '../../shared/services/eventAuditService';
import { useAuthState } from 'react-firebase-hooks/auth';
import FilePreviewModal from './components/FilePreviewModal';
import EventDetailsTab from './event-view-modal/EventDetailsTab';
import FilesGraphicsTab from './event-view-modal/FilesGraphicsTab';
import FundingInvoicesTab from './event-view-modal/FundingInvoicesTab';
import AttendeesTab from './event-view-modal/AttendeesTab';
import ActivityHistoryTab from './event-view-modal/ActivityHistoryTab';
import ReviewFeedbackModal from './event-view-modal/ReviewFeedbackModal';
import { formatInvoiceData, getStatusColor, getUserName } from './event-view-modal/utils';
import type { EventViewModalProps, UserOption, AttendeeRecord } from './event-view-modal/types';
import { showToast } from '../../shared/utils/toast';

export default function EventViewModal({ request, users, onClose, onSuccess }: EventViewModalProps) {
    const [user] = useAuthState(auth);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [publishStatus, setPublishStatus] = useState(request?.published || false);
    const [updating, setUpdating] = useState(false);
    const [eventFiles, setEventFiles] = useState<string[]>([]);
    const [privateFiles, setPrivateFiles] = useState<string[]>([]);
    const [loadingEventFiles, setLoadingEventFiles] = useState(true); // Start true for better UX (no caching mechanism exists)
    const [eventCode, setEventCode] = useState<string>('');
    const [pointsToReward, setPointsToReward] = useState<number>(0);
    const [attendees, setAttendees] = useState<AttendeeRecord[]>([]);
    const [loadingAttendees, setLoadingAttendees] = useState(true); // Start true for better UX (no caching mechanism exists)
    const [copiedInvoice, setCopiedInvoice] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewFeedback, setReviewFeedback] = useState('');
    const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string>('Member');
    const [selectedTab, setSelectedTab] = useState<string>('details');

    // Use db from client

    useEffect(() => {
        if (!request) return;
        setPublishStatus(request.published || false);
    }, [request]);

    // Fetch current user role and available users for administrators
    useEffect(() => {
        if (!user) return;

        const fetchUserRoleAndUsers = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setCurrentUserRole(userData.role || 'Member');

                    if (userData.role === 'Administrator') {
                        const usersQuery = query(collection(db, 'users'));
                        const usersSnapshot = await getDocs(usersQuery);
                        const usersList = usersSnapshot.docs.map(doc => ({
                            id: doc.id,
                            name: doc.data().name || doc.data().email || 'Unknown User',
                            email: doc.data().email || ''
                        })) as UserOption[];
                        setAvailableUsers(usersList);
                    }
                } else {
                    setCurrentUserRole('Member');
                }
            } catch (error) {
                console.error('Error fetching user role:', error);
                setCurrentUserRole('Member');
            }
        };

        fetchUserRoleAndUsers();
    }, [db, user]);

    useEffect(() => {
        if (!request) return;

        const fetchEventFiles = async () => {
            try {
                setLoadingEventFiles(true);
                setLoadingAttendees(true);

                const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
                const eventsSnapshot = await getDocs(eventsQuery);

                if (!eventsSnapshot.empty) {
                    const eventDoc = eventsSnapshot.docs[0];
                    const eventData = eventDoc.data();

                    setEventFiles(eventData.files || []);
                    setPrivateFiles(eventData.privateFiles || []);
                    setEventCode(eventData.eventCode || '');
                    setPointsToReward(eventData.pointsToReward || 0);
                    setPublishStatus(eventData.published || false);

                    try {
                        const attendeesQuery = query(collection(db, 'events', eventDoc.id, 'attendees'));
                        const attendeesSnapshot = await getDocs(attendeesQuery);
                        const attendeesData = attendeesSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        })) as AttendeeRecord[];
                        setAttendees(attendeesData);
                    } catch (error) {
                        console.error('Error fetching attendees:', error);
                        setAttendees([]);
                    }
                } else {
                    setEventCode(request.eventCode || '');
                    setPointsToReward(request.pointsToReward || 0);
                    setAttendees([]);
                }
            } catch (error) {
                console.error('Error fetching event files:', error);
            } finally {
                setLoadingEventFiles(false);
                setLoadingAttendees(false);
            }
        };

        fetchEventFiles();
    }, [db, request]);

    if (!request) return null;

    const handlePublishToggle = async () => {
        if (request.status !== 'approved') {
            showToast.warning('Events can only be published when their status is "Approved"');
            return;
        }

        try {
            setUpdating(true);
            const newStatus = !publishStatus;

            const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
            const eventsSnapshot = await getDocs(eventsQuery);

            if (!eventsSnapshot.empty) {
                const eventDoc = eventsSnapshot.docs[0];
                await updateDoc(doc(db, 'events', eventDoc.id), {
                    published: newStatus,
                    updatedAt: new Date()
                });
                setPublishStatus(newStatus);
            } else {
                showToast.error('Error: No corresponding event found to update');
            }
        } catch (error) {
            console.error('Error updating publish status:', error);
            showToast.error('Error updating publish status: ' + (error as Error).message);
        } finally {
            setUpdating(false);
        }
    };

    const copyInvoiceData = async (invoiceIndex?: number) => {
        try {
            const invoiceData = formatInvoiceData(request, invoiceIndex);
            await navigator.clipboard.writeText(invoiceData);
            setCopiedInvoice(true);
            setTimeout(() => setCopiedInvoice(false), 2000);
        } catch (error) {
            console.error('Failed to copy invoice data:', error);
            showToast.error('Failed to copy invoice data to clipboard');
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        try {
            let declinedReason: string | undefined;

            if (newStatus === 'needs_review') {
                setShowReviewModal(true);
                return;
            }

            if (newStatus === 'declined') {
                const reason = prompt('Please provide a reason for declining this event:');
                if (!reason) {
                    return;
                }
                declinedReason = reason;

                const requestRef = doc(db, 'event_requests', request.id);
                await updateDoc(requestRef, {
                    status: newStatus,
                    declinedReason: reason
                });

                const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
                const eventsSnapshot = await getDocs(eventsQuery);

                if (!eventsSnapshot.empty) {
                    const eventDoc = eventsSnapshot.docs[0];
                    await updateDoc(doc(db, 'events', eventDoc.id), { published: false });
                    setPublishStatus(false);
                }
            } else {
                const requestRef = doc(db, 'event_requests', request.id);
                await updateDoc(requestRef, {
                    status: newStatus,
                    declinedReason: null
                });

                const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
                const eventsSnapshot = await getDocs(eventsQuery);

                if (!eventsSnapshot.empty) {
                    const eventDoc = eventsSnapshot.docs[0];
                    const shouldBePublished = newStatus === 'approved' ? publishStatus : false;
                    await updateDoc(doc(db, 'events', eventDoc.id), { published: shouldBePublished });
                }
            }

            try {
                const { EmailClient } = await import('../../../../scripts/email/EmailClient');
                await EmailClient.notifyFirebaseEventRequestStatusChange(
                    request.id,
                    newStatus,
                    request.status,
                    undefined,
                    declinedReason
                );
            } catch (emailError) {
                console.error('Failed to send status change email:', emailError);
            }

            try {
                const userName = await EventAuditService.getUserName(auth.currentUser?.uid || '');
                await EventAuditService.logStatusChange(
                    request.id,
                    auth.currentUser?.uid || '',
                    request.status,
                    newStatus,
                    declinedReason,
                    userName,
                    { eventName: request.name }
                );
            } catch (auditError) {
                console.error('Failed to log status change:', auditError);
            }

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast.error('Failed to update status: ' + (error as Error).message);
        }
    };

    const handleReviewSubmit = async () => {
        if (!reviewFeedback.trim()) {
            showToast.error('Please provide feedback for the review');
            return;
        }

        try {
            const requestRef = doc(db, 'event_requests', request.id);
            await updateDoc(requestRef, {
                status: 'needs_review',
                reviewFeedback: reviewFeedback,
                updatedAt: new Date()
            });

            try {
                const { EmailClient } = await import('../../../../scripts/email/EmailClient');
                await EmailClient.notifyFirebaseEventRequestStatusChange(
                    request.id,
                    'needs_review',
                    request.status,
                    undefined,
                    reviewFeedback
                );
            } catch (emailError) {
                console.error('Failed to send review notification email:', emailError);
            }

            try {
                const userName = await EventAuditService.getUserName(auth.currentUser?.uid || '');
                await EventAuditService.logStatusChange(
                    request.id,
                    auth.currentUser?.uid || '',
                    request.status,
                    'needs_review',
                    reviewFeedback,
                    userName,
                    { eventName: request.name }
                );
            } catch (auditError) {
                console.error('Failed to log review status change:', auditError);
            }

            setShowReviewModal(false);
            setReviewFeedback('');
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error submitting review:', error);
            showToast.error('Failed to submit review: ' + (error as Error).message);
        }
    };

    const handleRequestedUserUpdate = async (newUserId: string) => {
        if (!newUserId || newUserId === request.requestedUser) {
            return;
        }

        try {
            const requestRef = doc(db, 'event_requests', request.id);
            await updateDoc(requestRef, {
                requestedUser: newUserId,
                updatedAt: new Date()
            });

            try {
                const userName = await EventAuditService.getUserName(auth.currentUser?.uid || '');
                const oldUserName = getUserName(users, request.requestedUser);
                const newUserName = availableUsers.find(u => u.id === newUserId)?.name || newUserId;

                await EventAuditService.logEventUpdate(
                    request.id,
                    auth.currentUser?.uid || '',
                    [{
                        field: 'requestedUser',
                        fieldDisplayName: 'Submitted By',
                        oldValue: oldUserName,
                        newValue: newUserName,
                        changeType: 'updated'
                    }],
                    userName,
                    undefined,
                    { eventName: request.name, adminChange: true }
                );
            } catch (auditError) {
                console.error('Failed to log submitted user change:', auditError);
            }

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error updating submitted user:', error);
            showToast.error('Failed to update submitted user: ' + (error as Error).message);
        }
    };

    const formattedInvoiceData = (invoiceIndex?: number) => formatInvoiceData(request, invoiceIndex);

    return (
        <>
            <Modal
                isOpen
                onClose={selectedFile ? undefined : onClose}
                isDismissable={!selectedFile}
                size="5xl"
                scrollBehavior="inside"
                classNames={{
                    base: "max-h-[90vh]",
                    body: "p-6",
                    header: "border-b border-gray-200"
                }}
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-2 pb-3">
                        <h2 className="text-2xl font-bold text-gray-900">{request.name}</h2>
                        <Chip
                            color={getStatusColor(request.status)}
                            variant="flat"
                            size="md"
                            className="capitalize"
                        >
                            {request.status.replace('_', ' ')}
                        </Chip>
                    </ModalHeader>

                    <ModalBody className="px-0 pb-0">
                        <Tabs
                            selectedKey={selectedTab}
                            onSelectionChange={(key) => setSelectedTab(key as string)}
                            aria-label="Event details tabs"
                            classNames={{
                                base: "w-full",
                                tabList: "w-full px-6",
                                panel: "px-6 py-4"
                            }}
                        >
                            <Tab
                                key="details"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        <span>Event Details</span>
                                    </div>
                                }
                            >
                                <EventDetailsTab
                                    request={request}
                                    eventCode={eventCode}
                                    pointsToReward={pointsToReward}
                                    publishStatus={publishStatus}
                                    isPublishUpdating={updating}
                                    onPublishToggle={handlePublishToggle}
                                    onStatusChange={handleStatusChange}
                                    currentUserRole={currentUserRole}
                                    availableUsers={availableUsers}
                                    onRequestedUserChange={handleRequestedUserUpdate}
                                    users={users}
                                />
                            </Tab>

                            <Tab
                                key="files"
                                title={
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        <span>Files &amp; Graphics</span>
                                    </div>
                                }
                            >
                                <FilesGraphicsTab
                                    request={request}
                                    eventFiles={eventFiles}
                                    privateFiles={privateFiles}
                                    loadingEventFiles={loadingEventFiles}
                                    onPreviewFile={setSelectedFile}
                                />
                            </Tab>

                            <Tab
                                key="funding"
                                title={
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" />
                                        <span>Funding &amp; Invoices</span>
                                    </div>
                                }
                            >
                                <FundingInvoicesTab
                                    request={request}
                                    eventFiles={eventFiles}
                                    privateFiles={privateFiles}
                                    loadingEventFiles={loadingEventFiles}
                                    copiedInvoice={copiedInvoice}
                                    onCopyInvoice={copyInvoiceData}
                                    formatInvoiceData={formattedInvoiceData}
                                    onPreviewFile={setSelectedFile}
                                />
                            </Tab>

                            <Tab
                                key="attendees"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4" />
                                        <span>Attendees</span>
                                    </div>
                                }
                            >
                                <AttendeesTab
                                    attendees={attendees}
                                    loadingAttendees={loadingAttendees}
                                    users={users}
                                    eventName={request?.name}
                                />
                            </Tab>

                            <Tab
                                key="activity"
                                title={
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <span>Activity History</span>
                                    </div>
                                }
                            >
                                <ActivityHistoryTab auditLogs={request.auditLogs} />
                            </Tab>
                        </Tabs>
                    </ModalBody>
                </ModalContent>
            </Modal>

            {selectedFile && (
                <FilePreviewModal
                    url={selectedFile}
                    onClose={() => setSelectedFile(null)}
                />
            )}

            <ReviewFeedbackModal
                isOpen={showReviewModal}
                feedback={reviewFeedback}
                onFeedbackChange={setReviewFeedback}
                onCancel={() => {
                    setShowReviewModal(false);
                    setReviewFeedback('');
                }}
                onSubmit={handleReviewSubmit}
            />
        </>
    );
}
