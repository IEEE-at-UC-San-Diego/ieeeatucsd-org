import { useState, useEffect, useCallback } from 'react';
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    query,
    orderBy,
    limit,
    onSnapshot,
    Timestamp,
    getDoc
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../firebase/client';
import type { ConstitutionAuditEntry, ConstitutionSection } from '../types/firestore';

export const useConstitutionAudit = (constitutionId: string) => {
    const [user] = useAuthState(auth);
    const [auditEntries, setAuditEntries] = useState<ConstitutionAuditEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const db = getFirestore();

    // Load audit entries with real-time updates
    useEffect(() => {
        if (!constitutionId) return;

        const auditQuery = query(
            collection(db, 'constitutions', constitutionId, 'auditLog'),
            orderBy('timestamp', 'desc'),
            limit(100) // Load latest 100 entries
        );

        const unsubscribe = onSnapshot(auditQuery, (snapshot) => {
            const entries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ConstitutionAuditEntry[];
            setAuditEntries(entries);
            setIsLoading(false);
        });

        return unsubscribe;
    }, [constitutionId, db]);

    // Helper function to get user display name
    const getUserDisplayName = useCallback(async (userId: string): Promise<string> => {
        try {
            // Try to get user info from Firestore users collection
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData.displayName || userData.name || userData.email || 'Unknown User';
            }
            return 'Unknown User';
        } catch (error) {
            console.error('Error fetching user display name:', error);
            return 'Unknown User';
        }
    }, [db]);

    // Generate human-readable change description
    const generateChangeDescription = useCallback((
        changeType: ConstitutionAuditEntry['changeType'],
        beforeValue?: ConstitutionAuditEntry['beforeValue'],
        afterValue?: ConstitutionAuditEntry['afterValue']
    ): string => {
        // Helper to get display name for section type
        const getDisplayName = (value: any) => {
            if (!value) return 'section';
            
            switch (value.type) {
                case 'preamble':
                    return 'Preamble';
                case 'article':
                    return value.articleNumber ? `Article ${value.articleNumber}` : 'Article';
                case 'section':
                    return value.sectionNumber ? `Section ${value.sectionNumber}` : 'Section';
                case 'subsection':
                    return value.subsectionLetter ? `Subsection ${value.subsectionLetter}` : 'Subsection';
                case 'amendment':
                    return value.amendmentNumber ? `Amendment ${value.amendmentNumber}` : 'Amendment';
                default:
                    return value.type || 'section';
            }
        };

        switch (changeType) {
            case 'create':
                const displayName = getDisplayName(afterValue);
                if (afterValue?.title) {
                    return `Created ${displayName}: "${afterValue.title}"`;
                }
                return `Created ${displayName}`;

            case 'delete':
                const deletedDisplayName = getDisplayName(beforeValue);
                if (beforeValue?.title) {
                    return `Deleted ${deletedDisplayName}: "${beforeValue.title}"`;
                }
                return `Deleted ${deletedDisplayName}`;

            case 'update':
                const updatedDisplayName = getDisplayName(afterValue || beforeValue);
                const changes: string[] = [];
                
                if (beforeValue?.title !== afterValue?.title) {
                    if (!beforeValue?.title && afterValue?.title) {
                        changes.push(`added title "${afterValue.title}"`);
                    } else if (beforeValue?.title && !afterValue?.title) {
                        changes.push(`removed title "${beforeValue.title}"`);
                    } else {
                        changes.push(`changed title from "${beforeValue?.title || ''}" to "${afterValue?.title || ''}"`);
                    }
                }
                
                if (beforeValue?.content !== afterValue?.content) {
                    const beforeLength = beforeValue?.content?.length || 0;
                    const afterLength = afterValue?.content?.length || 0;
                    
                    if (beforeLength === 0 && afterLength > 0) {
                        changes.push(`added content (${afterLength} characters)`);
                    } else if (beforeLength > 0 && afterLength === 0) {
                        changes.push(`removed all content (was ${beforeLength} characters)`);
                    } else {
                        const diff = afterLength - beforeLength;
                        const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
                        changes.push(`modified content (${beforeLength} → ${afterLength} characters, ${diffStr})`);
                    }
                }
                
                if (beforeValue?.type !== afterValue?.type) {
                    changes.push(`changed type from "${beforeValue?.type || ''}" to "${afterValue?.type || ''}"`);
                }
                
                if (beforeValue?.order !== afterValue?.order) {
                    changes.push(`changed position from ${beforeValue?.order || 0} to ${afterValue?.order || 0}`);
                }

                if (changes.length > 0) {
                    return `Updated ${updatedDisplayName}: ${changes.join(', ')}`;
                }
                return `Updated ${updatedDisplayName}`;

            case 'reorder':
                const reorderedDisplayName = getDisplayName(afterValue || beforeValue);
                return `Reordered ${reorderedDisplayName} from position ${beforeValue?.order || 0} to ${afterValue?.order || 0}`;

            default:
                return 'Unknown change';
        }
    }, []);

    // Create audit entry
    const createAuditEntry = useCallback(async (
        changeType: ConstitutionAuditEntry['changeType'],
        sectionId?: string,
        beforeValue?: ConstitutionSection,
        afterValue?: ConstitutionSection | Partial<ConstitutionSection>
    ) => {
        if (!user) return;

        try {
            const userName = await getUserDisplayName(user.uid);
            
            // Convert full section objects to audit format, filtering out undefined values
            const beforeAuditValue = beforeValue ? Object.fromEntries(
                Object.entries({
                    title: beforeValue.title,
                    content: beforeValue.content,
                    type: beforeValue.type,
                    order: beforeValue.order,
                    parentId: beforeValue.parentId,
                    articleNumber: beforeValue.articleNumber,
                    sectionNumber: beforeValue.sectionNumber,
                    subsectionLetter: beforeValue.subsectionLetter,
                    amendmentNumber: beforeValue.amendmentNumber
                }).filter(([_, value]) => value !== undefined)
            ) : undefined;

            const afterAuditValue = afterValue ? Object.fromEntries(
                Object.entries({
                    title: afterValue.title,
                    content: afterValue.content,
                    type: afterValue.type,
                    order: afterValue.order,
                    parentId: afterValue.parentId,
                    articleNumber: afterValue.articleNumber,
                    sectionNumber: afterValue.sectionNumber,
                    subsectionLetter: afterValue.subsectionLetter,
                    amendmentNumber: afterValue.amendmentNumber
                }).filter(([_, value]) => value !== undefined)
            ) : undefined;

            const changeDescription = generateChangeDescription(changeType, beforeAuditValue, afterAuditValue);

            const auditEntry: Omit<ConstitutionAuditEntry, 'id'> = {
                constitutionId,
                sectionId,
                changeType,
                changeDescription,
                ...(beforeAuditValue && { beforeValue: beforeAuditValue }),
                ...(afterAuditValue && { afterValue: afterAuditValue }),
                userId: user.uid,
                userName,
                timestamp: Timestamp.now(),
                ipAddress: 'Not tracked', // Could be enhanced with actual IP tracking
                userAgent: navigator.userAgent
            };

            await addDoc(collection(db, 'constitutions', constitutionId, 'auditLog'), auditEntry);
        } catch (error) {
            console.error('Error creating audit entry:', error);
        }
    }, [user, constitutionId, db, getUserDisplayName, generateChangeDescription]);

    return {
        auditEntries,
        isLoading,
        createAuditEntry
    };
}; 