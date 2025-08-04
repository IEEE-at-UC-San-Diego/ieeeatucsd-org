import { getFirestore, collection, addDoc, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { app } from '../../../../firebase/client';
import type { EventAuditLog, EventFieldChange, EventFileChange } from '../types/firestore';

export class EventAuditService {
    private static db = getFirestore(app);

    /**
     * Create an audit log entry for event creation
     */
    static async logEventCreation(
        eventRequestId: string,
        performedBy: string,
        performedByName?: string,
        metadata?: { [key: string]: any }
    ): Promise<void> {
        const auditLog: Omit<EventAuditLog, 'id'> = {
            eventRequestId,
            action: 'created',
            performedBy,
            performedByName,
            timestamp: new Date() as any,
            metadata
        };

        await this.addAuditLog(eventRequestId, auditLog);
    }

    /**
     * Create an audit log entry for event updates
     */
    static async logEventUpdate(
        eventRequestId: string,
        performedBy: string,
        changes: EventFieldChange[],
        performedByName?: string,
        fileChanges?: EventFileChange[],
        metadata?: { [key: string]: any }
    ): Promise<void> {
        const auditLog: Omit<EventAuditLog, 'id'> = {
            eventRequestId,
            action: 'updated',
            performedBy,
            performedByName,
            timestamp: new Date() as any,
            changes,
            fileChanges,
            metadata
        };

        await this.addAuditLog(eventRequestId, auditLog);
    }

    /**
     * Create an audit log entry for status changes
     */
    static async logStatusChange(
        eventRequestId: string,
        performedBy: string,
        oldStatus: string,
        newStatus: string,
        statusReason?: string,
        performedByName?: string,
        metadata?: { [key: string]: any }
    ): Promise<void> {
        const auditLog: Omit<EventAuditLog, 'id'> = {
            eventRequestId,
            action: 'status_changed',
            performedBy,
            performedByName,
            timestamp: new Date() as any,
            oldStatus,
            newStatus,
            statusReason,
            metadata
        };

        await this.addAuditLog(eventRequestId, auditLog);
    }

    /**
     * Create an audit log entry for file uploads
     */
    static async logFileUpload(
        eventRequestId: string,
        performedBy: string,
        fileChanges: EventFileChange[],
        performedByName?: string,
        metadata?: { [key: string]: any }
    ): Promise<void> {
        const auditLog: Omit<EventAuditLog, 'id'> = {
            eventRequestId,
            action: 'file_uploaded',
            performedBy,
            performedByName,
            timestamp: new Date() as any,
            fileChanges,
            metadata
        };

        await this.addAuditLog(eventRequestId, auditLog);
    }

    /**
     * Create an audit log entry for graphics updates
     */
    static async logGraphicsUpdate(
        eventRequestId: string,
        performedBy: string,
        performedByName?: string,
        fileChanges?: EventFileChange[],
        metadata?: { [key: string]: any }
    ): Promise<void> {
        const auditLog: Omit<EventAuditLog, 'id'> = {
            eventRequestId,
            action: 'graphics_updated',
            performedBy,
            performedByName,
            timestamp: new Date() as any,
            fileChanges,
            metadata
        };

        await this.addAuditLog(eventRequestId, auditLog);
    }

    /**
     * Create an audit log entry for publish/unpublish actions
     */
    static async logPublishAction(
        eventRequestId: string,
        performedBy: string,
        isPublished: boolean,
        performedByName?: string,
        metadata?: { [key: string]: any }
    ): Promise<void> {
        const auditLog: Omit<EventAuditLog, 'id'> = {
            eventRequestId,
            action: isPublished ? 'published' : 'unpublished',
            performedBy,
            performedByName,
            timestamp: new Date() as any,
            metadata
        };

        await this.addAuditLog(eventRequestId, auditLog);
    }

    /**
     * Add an audit log to the event request document
     */
    private static async addAuditLog(
        eventRequestId: string,
        auditLog: Omit<EventAuditLog, 'id'>
    ): Promise<void> {
        try {
            // Generate a unique ID for the audit log
            const logId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const fullAuditLog: EventAuditLog = {
                ...auditLog,
                id: logId
            };

            // Update the event request document with the new audit log
            const eventRequestRef = doc(this.db, 'event_requests', eventRequestId);
            await updateDoc(eventRequestRef, {
                auditLogs: arrayUnion(fullAuditLog),
                updatedAt: new Date()
            });

            console.log('Audit log added successfully:', logId);
        } catch (error) {
            console.error('Error adding audit log:', error);
            // Don't throw error to avoid breaking the main flow
        }
    }

    /**
     * Get user name from user ID
     */
    static async getUserName(userId: string): Promise<string> {
        try {
            const userDoc = await getDoc(doc(this.db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData.name || userData.displayName || userId;
            }
            return userId;
        } catch (error) {
            console.error('Error fetching user name:', error);
            return userId;
        }
    }

    /**
     * Compare two objects and generate field changes
     */
    static generateFieldChanges(
        oldData: any,
        newData: any,
        fieldMappings: { [key: string]: string }
    ): EventFieldChange[] {
        const changes: EventFieldChange[] = [];

        // Check for updated and added fields
        for (const [field, displayName] of Object.entries(fieldMappings)) {
            const oldValue = oldData[field];
            const newValue = newData[field];

            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                if (oldValue === undefined || oldValue === null) {
                    changes.push({
                        field,
                        fieldDisplayName: displayName,
                        oldValue: null,
                        newValue,
                        changeType: 'added'
                    });
                } else if (newValue === undefined || newValue === null) {
                    changes.push({
                        field,
                        fieldDisplayName: displayName,
                        oldValue,
                        newValue: null,
                        changeType: 'removed'
                    });
                } else {
                    changes.push({
                        field,
                        fieldDisplayName: displayName,
                        oldValue,
                        newValue,
                        changeType: 'updated'
                    });
                }
            }
        }

        return changes;
    }

    /**
     * Field mappings for event request fields
     */
    static readonly EVENT_FIELD_MAPPINGS = {
        name: 'Event Name',
        location: 'Location',
        startDateTime: 'Start Date & Time',
        endDateTime: 'End Date & Time',
        eventDescription: 'Event Description',
        department: 'Department',
        eventCode: 'Event Code',
        pointsToReward: 'Points to Reward',
        flyersNeeded: 'Flyers Needed',
        flyerType: 'Flyer Type',
        otherFlyerType: 'Other Flyer Type',
        flyerAdvertisingStartDate: 'Flyer Advertising Start Date',
        flyerAdditionalRequests: 'Flyer Additional Requests',
        flyersCompleted: 'Flyers Completed',
        photographyNeeded: 'Photography Needed',
        requiredLogos: 'Required Logos',
        otherLogos: 'Other Logos',
        advertisingFormat: 'Advertising Format',
        hasRoomBooking: 'Has Room Booking',
        expectedAttendance: 'Expected Attendance',
        servingFoodDrinks: 'Serving Food/Drinks',
        needsAsFunding: 'Needs AS Funding',
        needsGraphics: 'Needs Graphics',
        status: 'Status'
    };
}
