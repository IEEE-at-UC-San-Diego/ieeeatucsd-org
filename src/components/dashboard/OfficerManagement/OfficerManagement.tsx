import React, { useState, useEffect, useRef } from 'react';
import { Authentication, Get, Update, Realtime } from '../../../scripts/pocketbase';
import { Collections, OfficerTypes } from '../../../schemas/pocketbase';
import type { User, Officer } from '../../../schemas/pocketbase/schema';
import { Button } from '../universal/Button';
import toast from 'react-hot-toast';
import { Toast } from '../universal/Toast';
import { EmailClient } from '../../../scripts/email/EmailClient';

// Interface for officer with expanded user data
interface OfficerWithUser extends Officer {
    expand?: {
        user: User;
    };
}

// Interface for user search results
interface UserSearchResult {
    id: string;
    name: string;
    email: string;
}

// Interface for JSON import data
interface ImportedOfficerData {
    name: string;
    email: string;
    role: string;
    type: string;
    pid?: string;
    major?: string;
    graduation_year?: number;
}

// Interface for matched user data
interface UserMatch {
    importedData: ImportedOfficerData;
    matchedUser: UserSearchResult | null;
    confidence: number;
    matchReason: string[];
    isApproved?: boolean;
    id: string; // Add stable ID for selection
}

// Export the component as default
export default function OfficerManagement() {
    // State for officers data
    const [officers, setOfficers] = useState<OfficerWithUser[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // State for filtering and searching
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');

    // State for new officer form
    const [userSearchTerm, setUserSearchTerm] = useState<string>('');
    const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
    const [newOfficerRole, setNewOfficerRole] = useState<string>('');
    const [newOfficerType, setNewOfficerType] = useState<string>(OfficerTypes.GENERAL);

    // State for bulk actions
    const [selectedOfficers, setSelectedOfficers] = useState<string[]>([]);
    const [bulkActionType, setBulkActionType] = useState<string>('');

    // State for JSON import
    const [jsonInput, setJsonInput] = useState<string>('');
    const [importedData, setImportedData] = useState<ImportedOfficerData[]>([]);
    const [userMatches, setUserMatches] = useState<UserMatch[]>([]);
    const [isProcessingImport, setIsProcessingImport] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [importError, setImportError] = useState<string | null>(null);
    const [showUnmatched, setShowUnmatched] = useState(false);

    // State for officer replacement confirmation
    const [officerToReplace, setOfficerToReplace] = useState<{
        existingOfficer: OfficerWithUser;
        newRole: string;
        newType: string;
    } | null>(null);

    // State for keyboard navigation
    const [currentHighlightedIndex, setCurrentHighlightedIndex] = useState(-1);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Get instances of services
    const getService = Get.getInstance();
    const updateService = Update.getInstance();
    const realtime = Realtime.getInstance();
    const auth = Authentication.getInstance();

    // State for current user's role
    const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState<boolean>(false);

    // Check if current user is an administrator
    const checkCurrentUserRole = async () => {
        try {
            const userId = auth.getUserId();
            if (!userId) return;

            // Get all officers where user is the current user and type is administrator
            const result = await getService.getFirst<Officer>(
                Collections.OFFICERS,
                `user = "${userId}" && type = "${OfficerTypes.ADMINISTRATOR}"`
            );

            setIsCurrentUserAdmin(!!result);
        } catch (err) {
            console.error('Failed to check user role:', err);
            setIsCurrentUserAdmin(false);
        }
    };

    // Fetch officers on component mount
    useEffect(() => {
        fetchOfficers();
        checkCurrentUserRole();

        // Subscribe to realtime updates for officers collection
        const subscriptionId = realtime.subscribeToCollection<{ action: string; record: OfficerWithUser }>(
            Collections.OFFICERS,
            (data) => {
                if (data.action === 'create' || data.action === 'update' || data.action === 'delete') {
                    fetchOfficers();
                }
            }
        );

        // Cleanup subscription on unmount
        return () => {
            realtime.unsubscribe(subscriptionId);
        };
    }, []);

    // Fetch officers data
    const fetchOfficers = async () => {
        try {
            setLoading(true);
            const result = await getService.getAll<OfficerWithUser>(
                Collections.OFFICERS,
                '',
                'created',
                { expand: 'user' }
            );
            setOfficers(result);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch officers:', err);
            setError('Failed to load officers. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Search for users when adding a new officer
    const searchUsers = async (term: string) => {
        if (!term || term.length < 2) {
            setUserSearchResults([]);
            return;
        }

        try {
            // Search for users by name or email
            const result = await getService.getAll<User>(
                Collections.USERS,
                `name ~ "${term}" || email ~ "${term}"`,
                'name'
            );

            // Map to search results format
            const searchResults: UserSearchResult[] = result.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email
            }));

            setUserSearchResults(searchResults);
        } catch (err) {
            console.error('Failed to search users:', err);
            toast.error('Failed to search users. Please try again.');
        }
    };

    // Handle user search input change
    const handleUserSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        setUserSearchTerm(term);
        setCurrentHighlightedIndex(-1);

        // Debounce search to avoid too many requests
        const debounceTimer = setTimeout(() => {
            searchUsers(term);
        }, 300);

        return () => clearTimeout(debounceTimer);
    };

    // Handle keyboard navigation in the dropdown
    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Only handle keys when results are showing
        if (userSearchResults.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setCurrentHighlightedIndex(prev =>
                    prev < userSearchResults.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setCurrentHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (currentHighlightedIndex >= 0 && currentHighlightedIndex < userSearchResults.length) {
                    handleSelectUser(userSearchResults[currentHighlightedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setUserSearchResults([]);
                break;
        }
    };

    // Handle selecting a user from search results
    const handleSelectUser = (user: UserSearchResult) => {
        // Toggle selection - add if not selected, remove if already selected
        setSelectedUsers(prev => {
            // Check if user is already in the array
            const exists = prev.some(u => u.id === user.id);
            if (exists) {
                return prev.filter(u => u.id !== user.id);
            }
            return [...prev, user];
        });

        // Keep the search results open to allow selecting more users
    };

    // Handle removing a user from selected users
    const handleRemoveSelectedUser = (userId: string) => {
        setSelectedUsers(prev => prev.filter(user => user.id !== userId));
    };

    // Handle replacing an existing officer
    const handleReplaceOfficer = async () => {
        if (!officerToReplace) return;

        try {
            const pb = auth.getPocketBase();

            // Store previous values for the email notification
            const previousRole = officerToReplace.existingOfficer.role;
            const previousType = officerToReplace.existingOfficer.type;
            const currentUserId = auth.getUserId();

            // Update the existing officer record
            await pb.collection(Collections.OFFICERS).update(officerToReplace.existingOfficer.id, {
                role: officerToReplace.newRole,
                type: officerToReplace.newType
            });

            // Send email notification (non-blocking)
            try {
                await EmailClient.notifyOfficerRoleChange(
                    officerToReplace.existingOfficer.id,
                    previousRole,
                    previousType,
                    officerToReplace.newRole,
                    officerToReplace.newType,
                    currentUserId || undefined,
                    false // This is an update, not a new officer
                );
                console.log('Officer role change notification email sent successfully');
            } catch (emailError) {
                console.error('Failed to send officer role change notification email:', emailError);
                // Don't show error to user - email failure shouldn't disrupt the main operation
            }

            // Show success message
            toast.success(`Officer role updated successfully for ${officerToReplace.existingOfficer.expand?.user.name}`);

            // Close the modal
            const modal = document.getElementById("replaceOfficerModal") as HTMLDialogElement;
            if (modal) modal.close();

            // Reset the state and form completely
            setOfficerToReplace(null);
            setSelectedUsers([]);
            setUserSearchTerm('');
            setUserSearchResults([]);
            setNewOfficerRole('');
            setNewOfficerType(OfficerTypes.GENERAL);

            // Force clear any input fields
            const roleInput = document.getElementById('role') as HTMLInputElement;
            if (roleInput) roleInput.value = '';

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to update officer:', err);
            toast.error('Failed to update officer. Please try again.');
        }
    };

    // Handle adding an existing officer to the selection
    const handleAddExistingOfficer = () => {
        if (!officerToReplace) return;

        // Get the user from the existing officer
        const user = {
            id: officerToReplace.existingOfficer.expand?.user.id || '',
            name: officerToReplace.existingOfficer.expand?.user.name || 'Unknown User',
            email: officerToReplace.existingOfficer.expand?.user.email || ''
        };

        // Add the user to the selected users list
        setSelectedUsers(prev => {
            // Check if user is already in the array
            const exists = prev.some(u => u.id === user.id);
            if (exists) {
                return prev;
            }
            return [...prev, user];
        });

        // Close the modal
        const modal = document.getElementById("replaceOfficerModal") as HTMLDialogElement;
        if (modal) modal.close();

        // Reset the state and form
        setOfficerToReplace(null);

        // Clear form completely
        setSelectedUsers([]);
        setUserSearchTerm('');
        setUserSearchResults([]);
        setNewOfficerRole('');
        setNewOfficerType(OfficerTypes.GENERAL);

        // Force clear any input fields
        const roleInput = document.getElementById('role') as HTMLInputElement;
        if (roleInput) roleInput.value = '';

        // Show a toast message
        toast(`${user.name} added to selection. Submit the form to update their role.`);
    };

    // Handle adding a new officer
    const handleAddOfficer = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedUsers.length === 0) {
            toast.error('Please select at least one user');
            return;
        }

        if (!newOfficerRole) {
            toast.error('Please enter a role');
            return;
        }

        // Check if trying to add an administrator without being an administrator
        if (newOfficerType === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin) {
            toast.error('Only administrators can add new administrators');
            return;
        }

        // Check if any of the selected users are already officers
        const existingOfficers = selectedUsers.filter(user =>
            officers.some(officer => officer.expand?.user.id === user.id)
        );

        // If there's exactly one existing officer, show the replacement modal
        if (existingOfficers.length === 1) {
            const existingOfficer = officers.find(officer =>
                officer.expand?.user.id === existingOfficers[0].id
            );

            if (existingOfficer) {
                setOfficerToReplace({
                    existingOfficer,
                    newRole: newOfficerRole,
                    newType: newOfficerType
                });

                // Open the confirmation modal
                const modal = document.getElementById("replaceOfficerModal") as HTMLDialogElement;
                if (modal) modal.showModal();

                return;
            }
        }

        // If there are multiple existing officers, ask for confirmation
        if (existingOfficers.length > 1) {
            if (!window.confirm(`${existingOfficers.length} selected users are already officers. Do you want to update their roles to "${newOfficerRole}" and type to "${newOfficerType}"?`)) {
                return;
            }
        }

        try {
            // Get all users to add or update
            const usersToProcess = selectedUsers;

            // First verify that all users exist in the database
            const userVerificationPromises = selectedUsers.map(async user => {
                try {
                    // Verify the user exists before creating an officer record
                    await getService.getOne(Collections.USERS, user.id);
                    return { user, exists: true };
                } catch (error) {
                    console.error(`User with ID ${user.id} does not exist:`, error);
                    return { user, exists: false };
                }
            });

            const userVerificationResults = await Promise.all(userVerificationPromises);
            const validUsers = userVerificationResults.filter(result => result.exists).map(result => result.user);
            const invalidUsers = userVerificationResults.filter(result => !result.exists).map(result => result.user);

            if (invalidUsers.length > 0) {
                toast.error(`Cannot add ${invalidUsers.length} user(s) as officers: User records not found`);

                if (validUsers.length === 0) {
                    return; // No valid users to add
                }
            }

            // Get direct access to PocketBase instance
            const pb = auth.getPocketBase();

            // Track successful creations, updates, and failures
            const successfulCreations = [];
            const successfulUpdates = [];
            const failedOperations = [];

            // Process each valid user
            for (const user of validUsers) {
                try {
                    // Ensure type is one of the valid enum values
                    const validType = Object.values(OfficerTypes).includes(newOfficerType)
                        ? newOfficerType
                        : OfficerTypes.GENERAL;

                    // Check if user is already an officer
                    const existingOfficer = officers.find(officer => officer.expand?.user.id === user.id);
                    const currentUserId = auth.getUserId();

                    if (existingOfficer) {
                        // Store previous values for the email notification
                        const previousRole = existingOfficer.role;
                        const previousType = existingOfficer.type;

                        // Update existing officer
                        const updatedOfficer = await pb.collection(Collections.OFFICERS).update(existingOfficer.id, {
                            role: newOfficerRole,
                            type: validType
                        });

                        successfulUpdates.push(updatedOfficer);

                        // Send email notification for role update (non-blocking)
                        try {
                            await EmailClient.notifyOfficerRoleChange(
                                existingOfficer.id,
                                previousRole,
                                previousType,
                                newOfficerRole,
                                validType,
                                currentUserId || undefined,
                                false // This is an update, not a new officer
                            );
                            console.log(`Officer role change notification sent for ${user.name}`);
                        } catch (emailError) {
                            console.error(`Failed to send officer role change notification for ${user.name}:`, emailError);
                            // Don't show error to user - email failure shouldn't disrupt the main operation
                        }
                    } else {
                        // Create new officer record
                        const createdOfficer = await pb.collection(Collections.OFFICERS).create({
                            user: user.id,
                            role: newOfficerRole,
                            type: validType
                        });

                        successfulCreations.push(createdOfficer);

                        // Send email notification for new officer (non-blocking)
                        try {
                            await EmailClient.notifyOfficerRoleChange(
                                createdOfficer.id,
                                undefined, // No previous role for new officers
                                undefined, // No previous type for new officers
                                newOfficerRole,
                                validType,
                                currentUserId || undefined,
                                true // This is a new officer
                            );
                            console.log(`New officer notification sent for ${user.name}`);
                        } catch (emailError) {
                            console.error(`Failed to send new officer notification for ${user.name}:`, emailError);
                            // Don't show error to user - email failure shouldn't disrupt the main operation
                        }
                    }
                } catch (error) {
                    console.error(`Failed to process officer for user ${user.name}:`, error);
                    failedOperations.push(user);
                }
            }

            // Update the success/error message based on results
            if (successfulCreations.length === 0 && successfulUpdates.length === 0 && failedOperations.length > 0) {
                throw new Error(`Failed to add or update any officers. Please check user permissions and try again.`);
            }

            // Reset form completely
            setSelectedUsers([]);
            setUserSearchTerm('');
            setUserSearchResults([]);
            setNewOfficerRole('');
            setNewOfficerType(OfficerTypes.GENERAL);

            // Force clear any input fields
            const roleInput = document.getElementById('role') as HTMLInputElement;
            if (roleInput) roleInput.value = '';

            toast.success(`${successfulCreations.length} officer(s) added and ${successfulUpdates.length} updated successfully${failedOperations.length > 0 ? ` (${failedOperations.length} failed)` : ''}`);

            // Refresh officers list
            fetchOfficers();
        } catch (err: any) {
            console.error('Failed to add officer:', err);

            // Provide more specific error messages based on the error
            let errorMessage = 'Failed to add officer. Please try again.';

            if (err.data?.data) {
                // Handle validation errors from PocketBase
                const validationErrors = err.data.data;
                if (validationErrors.user) {
                    errorMessage = `User error: ${validationErrors.user.message}`;
                } else if (validationErrors.role) {
                    errorMessage = `Role error: ${validationErrors.role.message}`;
                } else if (validationErrors.type) {
                    errorMessage = `Type error: ${validationErrors.type.message}`;
                }
            } else if (err.message) {
                errorMessage = err.message;
            }

            toast.error(errorMessage);
        }
    };

    // Handle selecting/deselecting an officer for bulk actions
    const handleSelectOfficer = (officerId: string) => {
        setSelectedOfficers(prev => {
            if (prev.includes(officerId)) {
                return prev.filter(id => id !== officerId);
            } else {
                return [...prev, officerId];
            }
        });
    };

    // Handle bulk action type change
    const handleBulkActionTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setBulkActionType(e.target.value);
    };

    // Apply bulk action to selected officers
    const applyBulkAction = async () => {
        if (!bulkActionType || selectedOfficers.length === 0) {
            toast('Please select officers and an action type');
            return;
        }

        // Check if trying to set officers to administrator without being an administrator
        if (bulkActionType === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin) {
            toast.error('Only administrators can promote officers to administrator');
            return;
        }

        // Check if trying to modify administrators without being an administrator
        if (!isCurrentUserAdmin) {
            const hasAdmins = selectedOfficers.some(id => {
                const officer = officers.find(o => o.id === id);
                return officer?.type === OfficerTypes.ADMINISTRATOR;
            });

            if (hasAdmins) {
                toast.error('Only administrators can modify administrator officers');
                return;
            }
        }

        try {
            // Update all selected officers to the new type
            const updates = selectedOfficers.map(id => ({
                id,
                data: { type: bulkActionType }
            }));

            await updateService.batchUpdateFields(Collections.OFFICERS, updates);

            toast.success(`Successfully updated ${selectedOfficers.length} officers`);

            // Reset selection
            setSelectedOfficers([]);
            setBulkActionType('');

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to apply bulk action:', err);
            toast.error('Failed to update officers. Please try again.');
        }
    };

    // Set all general and executive officers to past
    const archiveCurrentOfficers = async () => {
        // Only administrators can perform this bulk action
        if (!isCurrentUserAdmin) {
            toast.error('Only administrators can archive all officers');
            return;
        }

        try {
            // Find all general and executive officers
            const officersToArchive = officers.filter(
                officer => officer.type === OfficerTypes.GENERAL || officer.type === OfficerTypes.EXECUTIVE
            );

            if (officersToArchive.length === 0) {
                toast('No general or executive officers to archive');
                return;
            }

            // Confirm before proceeding
            if (!window.confirm(`Are you sure you want to set ${officersToArchive.length} officers to "past"? This action is typically done at the end of the academic year.`)) {
                return;
            }

            // Update all selected officers to past
            const updates = officersToArchive.map(officer => ({
                id: officer.id,
                data: { type: OfficerTypes.PAST }
            }));

            await updateService.batchUpdateFields(Collections.OFFICERS, updates);

            toast.success(`Successfully archived ${officersToArchive.length} officers`);

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to archive officers:', err);
            toast.error('Failed to archive officers. Please try again.');
        }
    };

    // Filter officers based on search term and type filter
    const filteredOfficers = officers.filter(officer => {
        const matchesSearch = searchTerm === '' ||
            officer.expand?.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            officer.role.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = filterType === '' || officer.type === filterType;

        return matchesSearch && matchesType;
    });

    // Handle removing an officer
    const handleRemoveOfficer = async (officerId: string) => {
        // Get the officer to check if they're an administrator
        const officerToRemove = officers.find(o => o.id === officerId);

        if (!officerToRemove) {
            toast.error('Officer not found');
            return;
        }

        // Check permissions
        if (officerToRemove.type === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin) {
            toast.error('Only administrators can remove administrator officers');
            return;
        }

        if (!window.confirm('Are you sure you want to remove this officer?')) {
            return;
        }

        try {
            const pb = auth.getPocketBase();

            await pb.collection(Collections.OFFICERS).delete(officerId);

            toast.success('Officer removed successfully');

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to remove officer:', err);
            toast.error('Failed to remove officer. Please try again.');
        }
    };

    // Handle editing an officer's type
    const handleEditOfficerType = async (officerId: string, newType: string) => {
        // Get the officer to check current type
        const officerToEdit = officers.find(o => o.id === officerId);

        if (!officerToEdit) {
            toast.error('Officer not found');
            return;
        }

        // Get current user ID
        const currentUserId = auth.getUserId();

        // Check if user is trying to edit their own role and they're not an admin
        if (
            officerToEdit.expand?.user.id === currentUserId &&
            !isCurrentUserAdmin &&
            officerToEdit.type !== newType
        ) {
            toast.error('You cannot change your own role. Only administrators can do that.');
            return;
        }

        // Check permissions for changing to/from administrator
        if ((officerToEdit.type === OfficerTypes.ADMINISTRATOR || newType === OfficerTypes.ADMINISTRATOR) && !isCurrentUserAdmin) {
            toast.error('Only administrators can change administrator status');
            return;
        }

        try {
            // Store previous values for the email notification
            const previousType = officerToEdit.type;

            await updateService.updateField(Collections.OFFICERS, officerId, 'type', newType);

            // Send email notification for role type change (non-blocking)
            try {
                await EmailClient.notifyOfficerRoleChange(
                    officerId,
                    officerToEdit.role, // Role stays the same
                    previousType,
                    officerToEdit.role, // Role stays the same
                    newType,
                    currentUserId || undefined,
                    false // This is an update, not a new officer
                );
                console.log(`Officer type change notification sent for ${officerToEdit.expand?.user.name}`);
            } catch (emailError) {
                console.error(`Failed to send officer type change notification for ${officerToEdit.expand?.user.name}:`, emailError);
                // Don't show error to user - email failure shouldn't disrupt the main operation
            }

            toast.success('Officer updated successfully');

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to update officer:', err);
            toast.error('Failed to update officer. Please try again.');
        }
    };

    // Calculate confidence score for user match
    const calculateMatchConfidence = (importedData: ImportedOfficerData, user: User): { confidence: number; reasons: string[] } => {
        let confidence = 0;
        const reasons: string[] = [];

        // Helper function to calculate string similarity (Levenshtein distance based)
        const calculateStringSimilarity = (str1: string, str2: string): number => {
            const s1 = str1.toLowerCase();
            const s2 = str2.toLowerCase();

            // Exact match
            if (s1 === s2) return 1;

            // Calculate Levenshtein distance
            const track = Array(s2.length + 1).fill(null).map(() =>
                Array(s1.length + 1).fill(null));
            for (let i = 0; i <= s1.length; i += 1) {
                track[0][i] = i;
            }
            for (let j = 0; j <= s2.length; j += 1) {
                track[j][0] = j;
            }
            for (let j = 1; j <= s2.length; j += 1) {
                for (let i = 1; i <= s1.length; i += 1) {
                    const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                    track[j][i] = Math.min(
                        track[j][i - 1] + 1,
                        track[j - 1][i] + 1,
                        track[j - 1][i - 1] + indicator
                    );
                }
            }

            // Convert distance to similarity score (0 to 1)
            const maxLength = Math.max(s1.length, s2.length);
            return maxLength === 0 ? 1 : (maxLength - track[s2.length][s1.length]) / maxLength;
        };

        // Helper function to normalize strings for comparison
        const normalizeString = (str: string): string => {
            return str.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '') // Remove special characters
                .trim();
        };

        // Email matching (weighted more heavily)
        const emailSimilarity = calculateStringSimilarity(
            importedData.email.split('@')[0], // Compare only the part before @
            user.email.split('@')[0]
        );
        if (emailSimilarity === 1) {
            confidence += 50;
            reasons.push('Email matches exactly');
        } else if (emailSimilarity > 0.8) {
            confidence += 40;
            reasons.push('Email is very similar');
        } else if (emailSimilarity > 0.6) {
            confidence += 25;
            reasons.push('Email has some similarity');
        }

        // Name matching with various techniques
        const importedName = normalizeString(importedData.name);
        const userName = normalizeString(user.name);

        // Full name similarity
        const nameSimilarity = calculateStringSimilarity(importedName, userName);
        if (nameSimilarity === 1) {
            confidence += 30;
            reasons.push('Name matches exactly');
        } else if (nameSimilarity > 0.8) {
            confidence += 25;
            reasons.push('Name is very similar');
        } else if (nameSimilarity > 0.6) {
            confidence += 15;
            reasons.push('Name has some similarity');
        }

        // Name parts matching (for handling different order, missing middle names, etc.)
        const importedParts = importedName.split(' ').filter(Boolean);
        const userParts = userName.split(' ').filter(Boolean);

        // Check each part individually
        const matchingParts = importedParts.filter(part =>
            userParts.some(userPart => calculateStringSimilarity(part, userPart) > 0.8)
        );

        if (matchingParts.length > 0) {
            const partialScore = (matchingParts.length / Math.max(importedParts.length, userParts.length)) * 20;
            if (!reasons.some(r => r.includes('Name'))) { // Only add if no other name match was found
                confidence += partialScore;
                reasons.push(`${matchingParts.length} name parts match closely`);
            }
        }

        // PID matching with partial match support
        if (importedData.pid && user.pid) {
            const pidSimilarity = calculateStringSimilarity(
                importedData.pid.replace(/[^a-zA-Z0-9]/g, ''),
                user.pid.replace(/[^a-zA-Z0-9]/g, '')
            );
            if (pidSimilarity === 1) {
                confidence += 10;
                reasons.push('PID matches exactly');
            } else if (pidSimilarity > 0.8) {
                confidence += 7;
                reasons.push('PID is very similar');
            }
        }

        // Major matching with fuzzy match
        if (importedData.major && user.major) {
            const majorSimilarity = calculateStringSimilarity(
                normalizeString(importedData.major),
                normalizeString(user.major)
            );
            if (majorSimilarity === 1) {
                confidence += 5;
                reasons.push('Major matches exactly');
            } else if (majorSimilarity > 0.8) {
                confidence += 3;
                reasons.push('Major is very similar');
            }
        }

        // Graduation year matching with fuzzy logic
        if (importedData.graduation_year && user.graduation_year) {
            const yearDiff = Math.abs(importedData.graduation_year - user.graduation_year);
            if (yearDiff === 0) {
                confidence += 5;
                reasons.push('Graduation year matches exactly');
            } else if (yearDiff === 1) {
                confidence += 2;
                reasons.push('Graduation year is off by 1 year');
            }
        }

        // Normalize confidence to 100
        confidence = Math.min(100, Math.round(confidence * 10) / 10); // Round to 1 decimal place

        return { confidence, reasons };
    };

    // Process JSON input and match with existing users
    const processJsonImport = async (jsonStr: string) => {
        try {
            setIsProcessingImport(true);
            setImportError(null);

            // Parse JSON input
            const parsed = JSON.parse(jsonStr);
            const data: ImportedOfficerData[] = Array.isArray(parsed) ? parsed : [parsed];

            // Validate required fields
            const invalidEntries = data.filter(entry => !entry.name || !entry.email || !entry.role);
            if (invalidEntries.length > 0) {
                throw new Error('All entries must have name, email, and role');
            }

            // Set imported data
            setImportedData(data);

            // Match each imported record with existing users
            const matches: UserMatch[] = [];
            const seenUserIds = new Set<string>(); // Track user IDs for deduplication during processing

            for (const importedRecord of data) {
                try {
                    // Search for potential matches
                    const searchResults = await getService.getAll<User>(
                        Collections.USERS,
                        `name ~ "${importedRecord.name}" || email ~ "${importedRecord.email}"`,
                        'name'
                    );

                    // Find best match
                    let bestMatch: UserSearchResult | null = null;
                    let bestConfidence = 0;
                    let bestReasons: string[] = [];

                    for (const user of searchResults) {
                        const { confidence, reasons } = calculateMatchConfidence(importedRecord, user);
                        if (confidence > bestConfidence) {
                            bestConfidence = confidence;
                            bestReasons = reasons;
                            bestMatch = {
                                id: user.id,
                                name: user.name,
                                email: user.email
                            };
                        }
                    }

                    // Add a unique ID for stable selection
                    const matchId = `match-${matches.length}`;

                    matches.push({
                        id: matchId,
                        importedData: importedRecord,
                        matchedUser: bestMatch,
                        confidence: bestConfidence,
                        matchReason: bestReasons
                    });
                } catch (err) {
                    console.error('Error matching user:', err);
                    matches.push({
                        id: `match-error-${matches.length}`,
                        importedData: importedRecord,
                        matchedUser: null,
                        confidence: 0,
                        matchReason: ['Error matching user']
                    });
                }
            }

            // Deduplicate matches (keep the match with highest confidence for each user)
            const uniqueMatches = matches.reduce<Record<string, UserMatch>>((acc, match) => {
                if (!match.matchedUser) {
                    // Always keep unmatched entries
                    acc[match.id] = match;
                    return acc;
                }

                const userId = match.matchedUser.id;

                // If we haven't seen this user or this match has higher confidence, keep it
                if (!seenUserIds.has(userId) ||
                    !acc[`user-${userId}`] ||
                    match.confidence > acc[`user-${userId}`].confidence) {

                    // Remove previous entry for this user if exists
                    if (acc[`user-${userId}`]) {
                        delete acc[`user-${userId}`];
                    }

                    // Add this match with a stable ID based on user
                    acc[`user-${userId}`] = {
                        ...match,
                        id: `user-${userId}`
                    };

                    seenUserIds.add(userId);
                }

                return acc;
            }, {});

            setUserMatches(Object.values(uniqueMatches));
        } catch (err: any) {
            console.error('Error processing JSON import:', err);
            setImportError(err.message || 'Failed to process JSON import');
            setImportedData([]);
            setUserMatches([]);
        } finally {
            setIsProcessingImport(false);
        }
    };

    // Handle JSON input change
    const handleJsonInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setJsonInput(e.target.value);
        setImportError(null);
    };

    // Process matched users and create/update officers
    const processMatchedUsers = async () => {
        try {
            // Prevent multiple submissions
            if (isSubmitting) return;

            setIsSubmitting(true);
            setProcessingProgress(0);

            // Filter out matches with low confidence that haven't been manually approved
            const validMatches = userMatches.filter(match =>
                match.matchedUser && (match.confidence >= 70 || match.isApproved)
            );

            if (validMatches.length === 0) {
                toast.error('No valid matches to process');
                setIsSubmitting(false);
                return;
            }

            // Get current user ID
            const currentUserId = auth.getUserId();

            // Counters for feedback
            let updatedCount = 0;
            let createdCount = 0;
            let failedCount = 0;
            let skippedCount = 0;
            let processedCount = 0;

            // Get direct access to PocketBase instance
            const pb = auth.getPocketBase();

            // Process each match
            for (const match of validMatches) {
                if (!match.matchedUser) {
                    processedCount++;
                    setProcessingProgress(Math.round((processedCount / validMatches.length) * 100));
                    continue;
                }

                // Skip if trying to edit own role
                if (match.matchedUser.id === currentUserId) {
                    console.log('Skipping own record update for security reasons');
                    skippedCount++;
                    processedCount++;
                    setProcessingProgress(Math.round((processedCount / validMatches.length) * 100));
                    continue;
                }

                try {
                    // Check if user is already an officer
                    const existingOfficer = officers.find(o =>
                        o.expand?.user.id === match.matchedUser?.id
                    );

                    if (existingOfficer) {
                        // Update existing officer record with single call
                        await pb.collection(Collections.OFFICERS).update(existingOfficer.id, {
                            role: match.importedData.role,
                            type: match.importedData.type || OfficerTypes.GENERAL
                        });

                        updatedCount++;
                    } else {
                        // Create new officer record
                        await pb.collection(Collections.OFFICERS).create({
                            user: match.matchedUser.id,
                            role: match.importedData.role,
                            type: match.importedData.type || OfficerTypes.GENERAL
                        });

                        createdCount++;
                    }
                } catch (err) {
                    console.error('Error processing match:', err);
                    toast.error(`Failed to process ${match.importedData.name}`);
                    failedCount++;
                } finally {
                    // Update progress regardless of success/failure
                    processedCount++;
                    setProcessingProgress(Math.round((processedCount / validMatches.length) * 100));
                }
            }

            // Reset import state
            setJsonInput('');
            setImportedData([]);
            setUserMatches([]);

            // Show detailed success message
            if (updatedCount > 0 || createdCount > 0) {
                let successMessage = '';
                if (updatedCount > 0) {
                    successMessage += `Updated ${updatedCount} existing officer record${updatedCount !== 1 ? 's' : ''}`;
                }
                if (createdCount > 0) {
                    successMessage += successMessage ? ' and ' : '';
                    successMessage += `created ${createdCount} new officer record${createdCount !== 1 ? 's' : ''}`;
                }

                // Add failure and skipped information if present
                let additionalInfo = [];
                if (failedCount > 0) {
                    additionalInfo.push(`${failedCount} failed`);
                }
                if (skippedCount > 0) {
                    additionalInfo.push(`${skippedCount} skipped (cannot edit own role)`);
                }

                if (additionalInfo.length > 0) {
                    successMessage += ` (${additionalInfo.join(', ')})`;
                }

                toast.success(successMessage);
            } else if (failedCount > 0 || skippedCount > 0) {
                let errorMessage = 'No records processed:';
                if (failedCount > 0) {
                    errorMessage += ` ${failedCount} failed`;
                }
                if (skippedCount > 0) {
                    errorMessage += errorMessage !== 'No records processed:' ? ' and' : '';
                    errorMessage += ` ${skippedCount} skipped (cannot edit own role)`;
                }
                toast.error(errorMessage);
            }

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Error processing matches:', err);
            toast.error('Failed to process some or all matches');
        } finally {
            // Reset submission state
            setIsSubmitting(false);
            setProcessingProgress(0);
        }
    };

    // Display warning on card when match is the current user
    const isCurrentUser = (matchedUserId: string | undefined): boolean => {
        if (!matchedUserId) return false;
        const currentUserId = auth.getUserId();
        return matchedUserId === currentUserId;
    };

    // Handle match approval toggle
    const handleToggleApproval = (matchId: string) => {
        setUserMatches(prev => {
            return prev.map(match => {
                if (match.id === matchId) {
                    return {
                        ...match,
                        isApproved: !match.isApproved
                    };
                }
                return match;
            });
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-base-100 to-base-200/50">
            {/* Header Section with Breadcrumb */}
            <div className="sticky top-0 z-40 bg-base-100/95 backdrop-blur-sm border-b border-base-content/10">
                <div className="container mx-auto px-4 py-4">
                    {/* Breadcrumb */}
                    <nav className="text-sm breadcrumbs mb-2">
                        <ul>
                            <li><span className="text-base-content/60">Dashboard</span></li>
                            <li><span className="text-primary font-medium">Officer Management</span></li>
                        </ul>
                    </nav>
                    
                    {/* Page Title and Description */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-base-content mb-2 flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                Officer Management
                            </h1>
                            <p className="text-base-content/70 text-lg">Manage organization officers, roles, and permissions</p>
                        </div>
                        
                        {/* Quick Stats */}
                        <div className="flex gap-4">
                            <div className="stats shadow-lg bg-base-200 border border-base-content/10">
                                <div className="stat py-3 px-4">
                                    <div className="stat-title text-xs">Total Officers</div>
                                    <div className="stat-value text-2xl text-primary">{officers.length}</div>
                                </div>
                            </div>
                            <div className="stats shadow-lg bg-base-200 border border-base-content/10">
                                <div className="stat py-3 px-4">
                                    <div className="stat-title text-xs">Active</div>
                                    <div className="stat-value text-2xl text-success">
                                        {officers.filter(o => o.type === OfficerTypes.GENERAL || o.type === OfficerTypes.EXECUTIVE).length}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Admin status indicator */}
                    {isCurrentUserAdmin && (
                        <div className="mt-4 bg-gradient-to-r from-success/10 to-success/5 border border-success/20 rounded-xl p-4 text-success flex items-center shadow-sm">
                            <div className="p-2 bg-success/20 rounded-lg mr-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <span className="font-semibold">Administrator Access</span>
                                <p className="text-sm text-success/80 mt-1">You have full privileges to manage all officers and sensitive operations</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-8">
                {/* Management Cards Grid */}
                <div className="grid grid-cols-1 2xl:grid-cols-3 gap-8 mb-12">
                    {/* Add New Officer Section */}
                    <div className="bg-gradient-to-br from-base-200 via-base-200 to-base-300/30 p-8 rounded-2xl shadow-xl border border-base-content/10 transition-all duration-300 hover:shadow-2xl group">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="p-3 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-lg group-hover:shadow-primary/25 transition-all duration-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-base-200 animate-pulse"></div>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-base-content">Add New Officer</h2>
                                    <p className="text-base-content/60 text-sm mt-1">Search and assign roles to organization members</p>
                                </div>
                            </div>
                            {selectedUsers.length > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-xl border border-primary/20">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                                    <span className="text-sm font-medium text-primary">{selectedUsers.length} selected</span>
                                </div>
                            )}
                        </div>
                        
                        <form className="space-y-6" onSubmit={handleAddOfficer}>
                            {/* Enhanced User Search Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="user" className="flex items-center gap-2 text-sm font-semibold text-base-content">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        Search Users
                                    </label>
                                    {userSearchResults.length > 0 && userSearchTerm && (
                                        <span className="text-xs text-base-content/60 bg-base-300 px-2 py-1 rounded-lg">
                                            {userSearchResults.length} found
                                        </span>
                                    )}
                                </div>
                                
                                <div className="relative">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            id="user"
                                            value={userSearchTerm}
                                            ref={searchInputRef}
                                            onChange={handleUserSearchChange}
                                            onKeyDown={handleSearchKeyDown}
                                            placeholder="Type name or email to search..."
                                            className="w-full pl-12 pr-16 py-4 bg-gradient-to-r from-base-100 to-base-100/50 border-2 border-base-content/10 rounded-2xl text-base-content placeholder-base-content/40 focus:ring-4 focus:ring-primary/20 focus:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md text-lg"
                                            onFocus={() => searchUsers(userSearchTerm)}
                                        />
                                        
                                        {/* Search Icon */}
                                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                                            <div className="p-1 bg-primary/10 rounded-lg">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                            </div>
                                        </div>
                                        
                                        {/* Selected Counter & Clear Button */}
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-4 gap-2">
                                            {selectedUsers.length > 0 && (
                                                <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-content text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg animate-pulse">
                                                    {selectedUsers.length}
                                                </div>
                                            )}
                                            {userSearchTerm && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setUserSearchTerm('');
                                                        setUserSearchResults([]);
                                                        searchInputRef.current?.focus();
                                                    }}
                                                    className="p-1.5 bg-base-300 hover:bg-error/20 text-base-content/60 hover:text-error rounded-lg transition-all duration-200"
                                                    title="Clear search"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Enhanced Search Results Dropdown */}
                                    {userSearchTerm.length > 0 && (
                                        <div className="absolute z-20 mt-2 w-full bg-gradient-to-br from-base-100 to-base-200/50 border-2 border-base-content/10 rounded-2xl shadow-2xl backdrop-blur-sm overflow-hidden">
                                            {/* Results Header */}
                                            <div className="sticky top-0 bg-gradient-to-r from-base-200 to-base-300/50 backdrop-blur-sm p-4 border-b border-base-content/10">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                                                        <span className="text-sm font-semibold text-base-content">
                                                            {userSearchResults.length > 0
                                                                ? `${userSearchResults.length} user${userSearchResults.length !== 1 ? 's' : ''} found`
                                                                : 'No users found'}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setUserSearchTerm('');
                                                                searchInputRef.current?.focus();
                                                            }}
                                                            className="text-xs px-3 py-1.5 bg-base-100 hover:bg-primary/10 text-base-content rounded-lg transition-all duration-200 font-medium"
                                                            type="button"
                                                        >
                                                            Clear
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setUserSearchResults([]);
                                                                setUserSearchTerm('');
                                                            }}
                                                            className="p-1.5 text-base-content/60 hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200"
                                                            type="button"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Search Results List */}
                                            {userSearchResults.length === 0 ? (
                                                <div className="py-12 text-center text-base-content/60">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="p-4 bg-base-content/5 rounded-2xl">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">No users found</p>
                                                            <p className="text-sm mt-1">Try searching with a different name or email</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="max-h-80 overflow-y-auto">
                                                    {userSearchResults.map((user, index) => {
                                                        const isSelected = selectedUsers.some(u => u.id === user.id);
                                                        const isAlreadyOfficer = officers.some(officer => officer.expand?.user.id === user.id);
                                                        const isHighlighted = index === currentHighlightedIndex;

                                                        return (
                                                            <div
                                                                key={user.id}
                                                                onClick={() => handleSelectUser(user)}
                                                                className={`relative px-6 py-4 cursor-pointer transition-all duration-200 border-b border-base-content/5 last:border-b-0 ${
                                                                    isSelected ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-l-4 border-l-primary' : 
                                                                    isHighlighted ? 'bg-base-content/5' : 'hover:bg-base-content/5'
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-4">
                                                                        {/* User Avatar */}
                                                                        <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold border-2 transition-all duration-200 ${
                                                                            isSelected 
                                                                                ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-content border-primary/30 shadow-lg' 
                                                                                : 'bg-gradient-to-br from-base-300 to-base-200 text-base-content border-base-content/10'
                                                                        }`}>
                                                                            {user.name.charAt(0).toUpperCase()}
                                                                            {isSelected && (
                                                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-base-100 flex items-center justify-center">
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-success-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                                    </svg>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2 mb-1">
                                                                                <span className="font-semibold text-base-content">{user.name}</span>
                                                                                {isAlreadyOfficer && (
                                                                                    <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-warning/15 text-warning border border-warning/30">
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                                        </svg>
                                                                                        Officer
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-sm text-base-content/60">{user.email}</p>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    {/* Selection Indicator */}
                                                                    <div className="flex items-center">
                                                                        {isSelected ? (
                                                                            <div className="p-2 bg-primary/20 rounded-xl text-primary">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                </svg>
                                                                            </div>
                                                                        ) : !isAlreadyOfficer ? (
                                                                            <div className="p-2 bg-base-content/5 rounded-xl text-base-content/40 group-hover:text-primary group-hover:bg-primary/10 transition-all duration-200">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                                                </svg>
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Footer Actions */}
                                            <div className="sticky bottom-0 bg-gradient-to-r from-base-200 to-base-300/50 backdrop-blur-sm p-4 border-t border-base-content/10">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setSelectedUsers([])}
                                                        className="flex-1 btn btn-sm btn-outline btn-error"
                                                        type="button"
                                                        disabled={selectedUsers.length === 0}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        Clear ({selectedUsers.length})
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setUserSearchResults([]);
                                                            setUserSearchTerm('');
                                                        }}
                                                        className="flex-1 btn btn-sm btn-primary"
                                                        type="button"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        Done
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Enhanced Selected Users Display */}
                                {selectedUsers.length > 0 && (
                                    <div className="bg-gradient-to-br from-base-100 to-base-200/30 p-6 rounded-2xl border border-base-content/10 shadow-inner">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary/10 rounded-xl">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-base-content">Selected Users</h3>
                                                    <p className="text-sm text-base-content/60">{selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} ready to be assigned</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedUsers([])}
                                                type="button"
                                                className="btn btn-sm btn-outline btn-error gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Clear All
                                            </button>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                                            {selectedUsers.map((user, index) => (
                                                <div
                                                    key={user.id}
                                                    className="flex items-center gap-3 p-4 bg-gradient-to-r from-base-100 to-base-100/50 rounded-xl border border-base-content/10 group hover:border-primary/30 transition-all duration-200"
                                                >
                                                    <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center text-primary font-semibold border border-primary/20">
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-base-content truncate">{user.name}</p>
                                                        <p className="text-xs text-base-content/60 truncate">{user.email}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveSelectedUser(user.id)}
                                                        type="button"
                                                        className="p-2 text-base-content/40 hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200 opacity-60 group-hover:opacity-100"
                                                        title="Remove user"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Enhanced Role Input */}
                            <div className="space-y-3">
                                <label htmlFor="role" className="flex items-center gap-2 text-sm font-semibold text-base-content">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0v6a2 2 0 01-2 2H10a2 2 0 01-2-2V6m8 0V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8" />
                                    </svg>
                                    Officer Role
                                </label>
                                <input
                                    type="text"
                                    id="role"
                                    value={newOfficerRole}
                                    onChange={(e) => setNewOfficerRole(e.target.value)}
                                    placeholder="e.g. President, Technical Vice Chair, Secretary"
                                    className="w-full px-4 py-4 bg-gradient-to-r from-base-100 to-base-100/50 border-2 border-base-content/10 rounded-2xl text-base-content placeholder-base-content/40 focus:ring-4 focus:ring-primary/20 focus:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md text-lg"
                                />
                            </div>

                            {/* Enhanced Officer Type Selection */}
                            <div className="space-y-3">
                                <label htmlFor="type" className="flex items-center gap-2 text-sm font-semibold text-base-content">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    Officer Type
                                </label>
                                <select
                                    id="type"
                                    value={newOfficerType}
                                    onChange={(e) => setNewOfficerType(e.target.value)}
                                    className="w-full px-4 py-4 bg-gradient-to-r from-base-100 to-base-100/50 border-2 border-base-content/10 rounded-2xl text-base-content focus:ring-4 focus:ring-primary/20 focus:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md text-lg"
                                >
                                    <option value={OfficerTypes.GENERAL}>General Officer</option>
                                    <option value={OfficerTypes.EXECUTIVE}>Executive Officer</option>
                                    <option value={OfficerTypes.ADMINISTRATOR} disabled={!isCurrentUserAdmin}>
                                        Administrator {!isCurrentUserAdmin && "(Admin Only)"}
                                    </option>
                                    <option value={OfficerTypes.HONORARY}>Honorary Officer</option>
                                    <option value={OfficerTypes.PAST}>Past Officer</option>
                                </select>
                            </div>

                            {/* Enhanced Submit Button */}
                            <div className="pt-4">
                                <Button
                                    type="submit"
                                    className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-content border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    disabled={selectedUsers.length === 0 || !newOfficerRole.trim()}
                                >
                                    <div className="flex items-center justify-center gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                        <span>
                                            Add {selectedUsers.length > 0 ? `${selectedUsers.length} ` : ''}Officer{selectedUsers.length !== 1 ? 's' : ''}
                                            {selectedUsers.length > 0 && ` as ${newOfficerType.charAt(0).toUpperCase() + newOfficerType.slice(1)}`}
                                        </span>
                                    </div>
                                </Button>
                                
                                {/* Form Validation Hints */}
                                <div className="mt-3 text-center">
                                    {selectedUsers.length === 0 ? (
                                        <p className="text-sm text-base-content/50 flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Select at least one user to continue
                                        </p>
                                    ) : !newOfficerRole.trim() ? (
                                        <p className="text-sm text-base-content/50 flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Enter a role for the selected user{selectedUsers.length !== 1 ? 's' : ''}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-success flex items-center justify-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Ready to create {selectedUsers.length} new officer{selectedUsers.length !== 1 ? 's' : ''}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* JSON Import Section */}
                    <div className="bg-base-200 p-6 rounded-xl shadow-md border border-base-content/5 transition-all duration-300 hover:shadow-lg mb-8">
                        <h2 className="text-2xl font-semibold mb-4 text-base-content flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Import Officers from JSON
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-base-content">
                                    Paste JSON Data
                                    <button
                                        onClick={() => {
                                            const exampleJson = JSON.stringify([
                                                {
                                                    name: "John Doe",
                                                    email: "john@example.com",
                                                    role: "President",
                                                    type: "executive",
                                                    pid: "A12345678",
                                                    major: "Computer Science",
                                                    graduation_year: 2024
                                                },
                                                {
                                                    name: "Jane Smith",
                                                    email: "jane@example.com",
                                                    role: "Technical Vice Chair",
                                                    type: "executive",
                                                    major: "Electrical Engineering",
                                                    graduation_year: 2025
                                                }
                                            ], null, 2);
                                            navigator.clipboard.writeText(exampleJson);
                                            toast.success('Example JSON copied to clipboard!');
                                        }}
                                        className="ml-2 text-xs text-primary hover:text-primary/80 inline-flex items-center"
                                        type="button"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copy Example
                                    </button>
                                </label>
                                <div className="relative">
                                    <textarea
                                        value={jsonInput}
                                        onChange={handleJsonInputChange}
                                        placeholder={`[
  {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "President",
    "type": "executive"
  }
]`}
                                        className="w-full h-48 p-3 bg-base-300 border border-base-content/20 rounded-lg text-base-content placeholder-base-content/50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 font-mono text-sm"
                                    />
                                </div>
                                <div className="mt-2 text-sm text-base-content/70 space-y-2">
                                    <p><strong>Available Types:</strong> "executive", "general", "honorary", "past"</p>
                                    <p><strong>Note:</strong> Any role containing "VC" or "Vice Chair" should be considered executive type.</p>
                                    <p><strong>Do not include:</strong> Any numbers in the role field (e.g. "Webmaster #1" should just be "Webmaster")</p>
                                </div>
                                {importError && (
                                    <div className="mt-2 text-error text-sm">
                                        {importError}
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={() => processJsonImport(jsonInput)}
                                disabled={!jsonInput || isProcessingImport}
                                className="w-full"
                            >
                                {isProcessingImport ? (
                                    <div className="flex items-center justify-center">
                                        <span className="loading loading-spinner loading-sm mr-2"></span>
                                        Processing...
                                    </div>
                                ) : (
                                    'Process JSON'
                                )}
                            </Button>

                            {/* User Matches Display */}
                            {userMatches.length > 0 && (
                                <div className="mt-6">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h3 className="text-lg font-medium whitespace-nowrap">
                                                Matches
                                                <span className="ml-1">
                                                    ({userMatches.filter(m => m.confidence > 0 || showUnmatched).length})
                                                </span>
                                                {!showUnmatched && userMatches.some(m => m.confidence === 0) && (
                                                    <span className="ml-1 text-sm text-base-content/70 whitespace-nowrap">
                                                        +{userMatches.filter(m => m.confidence === 0).length} hidden
                                                    </span>
                                                )}
                                            </h3>
                                            <div className="w-[140px] flex-shrink-0">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox checkbox-xs"
                                                        checked={showUnmatched}
                                                        onChange={(e) => setShowUnmatched(e.target.checked)}
                                                    />
                                                    <span className="text-sm whitespace-nowrap">Show Unmatched</span>
                                                </label>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <Button
                                                onClick={() => setUserMatches([])}
                                                className="btn-sm btn-outline h-9 px-3 min-h-0 flex-1 sm:flex-none"
                                            >
                                                Clear
                                            </Button>
                                            <Button
                                                onClick={processMatchedUsers}
                                                disabled={!userMatches.some(m => m.confidence >= 70 || m.isApproved) || isSubmitting}
                                                className="btn-sm btn-primary h-9 px-3 min-h-0 flex-1 sm:flex-none"
                                            >
                                                {isSubmitting ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="loading loading-spinner loading-xs"></div>
                                                        <span className="whitespace-nowrap">
                                                            Processing {processingProgress}%
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="whitespace-nowrap">
                                                        Process ({userMatches.filter(m => m.confidence >= 70 || m.isApproved).length})
                                                    </span>
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                                        {userMatches
                                            .filter(match => match.confidence > 0 || showUnmatched)
                                            .map((match) => {
                                                // Check if this is the current user
                                                const isUserSelf = isCurrentUser(match.matchedUser?.id);

                                                return (
                                                    <div
                                                        key={match.id}
                                                        onClick={() => {
                                                            // Only allow toggle if not self and confidence < 70
                                                            if (!isUserSelf && match.matchedUser && match.confidence < 70) {
                                                                handleToggleApproval(match.id);
                                                            }
                                                        }}
                                                        className={`bg-base-300 p-4 rounded-lg border transition-all duration-200 ${match.confidence >= 70
                                                            ? 'border-success/30 bg-success/5'
                                                            : match.confidence >= 40
                                                                ? match.isApproved
                                                                    ? 'border-success/30 bg-success/5 cursor-pointer'
                                                                    : 'border-warning/30 hover:border-success/30 cursor-pointer'
                                                                : match.isApproved
                                                                    ? 'border-success/30 bg-success/5 cursor-pointer'
                                                                    : match.confidence === 0
                                                                        ? 'border-base-content/10 bg-base-200/50'
                                                                        : 'border-error/30 hover:border-success/30 cursor-pointer'
                                                            } ${match.confidence < 70 && match.confidence > 0 && !isUserSelf ? 'hover:shadow-md' : ''}`}
                                                    >
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div className="flex-1 min-w-0 pr-2">
                                                                <h4 className="font-medium text-base flex items-center gap-1 truncate">
                                                                    <span className="truncate">{match.importedData.name}</span>
                                                                    {(match.confidence >= 70 || match.isApproved) && (
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    )}
                                                                </h4>
                                                                <p className="text-sm text-base-content/70">{match.importedData.email}</p>
                                                                <p className="text-sm mt-1">Role: {match.importedData.role}</p>
                                                                {match.importedData.type && (
                                                                    <p className="text-sm mt-1">Type: {match.importedData.type}</p>
                                                                )}
                                                                {match.importedData.pid && (
                                                                    <p className="text-sm mt-1 text-base-content/70">PID: {match.importedData.pid}</p>
                                                                )}
                                                            </div>
                                                            <div className={`text-right px-2 py-1 rounded text-sm font-medium shrink-0 ${match.confidence >= 70
                                                                ? 'bg-success/20 text-success'
                                                                : match.confidence >= 40
                                                                    ? 'bg-warning/20 text-warning'
                                                                    : 'bg-error/20 text-error'
                                                                }`}>
                                                                {match.confidence.toFixed(1)}%
                                                            </div>
                                                        </div>

                                                        {match.matchedUser ? (
                                                            <div className="bg-base-200 p-3 rounded text-sm mt-3">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <div className="w-full">
                                                                        <div className="font-medium">{match.matchedUser.name}</div>
                                                                        <div className="text-base-content/70 break-all">{match.matchedUser.email}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="text-sm space-y-1 mt-2">
                                                                    <div className="font-medium">Match Reasons:</div>
                                                                    {match.matchReason.map((reason, i) => (
                                                                        <div key={i} className="flex items-center gap-1">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"></span>
                                                                            <span className="break-words">{reason}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-base-200 p-3 rounded text-sm text-error mt-3">
                                                                No matching user found
                                                            </div>
                                                        )}

                                                        {/* Display warning when match is current user */}
                                                        {isUserSelf && (
                                                            <div className="mt-3 py-2 text-sm text-warning text-center bg-warning/10 border border-warning/20 rounded-lg">
                                                                Cannot edit your own role
                                                            </div>
                                                        )}

                                                        {/* Only show approval message for non-self users with confidence < 70 */}
                                                        {match.confidence < 70 && match.matchedUser && !isUserSelf && (
                                                            <div className="mt-3 py-2 text-sm text-base-content/70 text-center bg-base-100 rounded-lg">
                                                                {match.isApproved ? '↑ Click to remove approval ↑' : '↑ Click to approve match ↑'}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bulk Actions Section */}
                    <div className="bg-gradient-to-br from-base-200 via-base-200 to-base-300/30 p-8 rounded-2xl shadow-xl border border-base-content/10 transition-all duration-300 hover:shadow-2xl group">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="p-3 bg-gradient-to-br from-secondary to-secondary/80 rounded-2xl shadow-lg group-hover:shadow-secondary/25 transition-all duration-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-secondary-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                        </svg>
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-warning rounded-full border-2 border-base-200 animate-pulse"></div>
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-base-content">Bulk Actions</h2>
                                    <p className="text-base-content/60 text-sm mt-1">Manage multiple officers simultaneously</p>
                                </div>
                            </div>
                            {selectedOfficers.length > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-secondary/10 rounded-xl border border-secondary/20">
                                    <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                                    <span className="text-sm font-medium text-secondary">{selectedOfficers.length} selected</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            {/* Enhanced Bulk Type Change Section */}
                            <div className="bg-gradient-to-br from-base-100 to-base-200/30 p-6 rounded-2xl border border-base-content/10 shadow-inner">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-secondary/10 rounded-xl">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-base-content">Change Officer Type</h3>
                                        <p className="text-sm text-base-content/60">Update the type for selected officers</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <label htmlFor="bulkAction" className="flex items-center gap-2 text-sm font-semibold text-base-content">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                            Set Selected Officers To
                                        </label>
                                        <select
                                            id="bulkAction"
                                            value={bulkActionType}
                                            onChange={handleBulkActionTypeChange}
                                            className="w-full px-4 py-4 bg-gradient-to-r from-base-100 to-base-100/50 border-2 border-base-content/10 rounded-2xl text-base-content focus:ring-4 focus:ring-secondary/20 focus:border-secondary/50 transition-all duration-300 shadow-sm hover:shadow-md text-lg"
                                        >
                                            <option value="">Choose new officer type...</option>
                                            <option value={OfficerTypes.GENERAL}>General Officer</option>
                                            <option value={OfficerTypes.EXECUTIVE}>Executive Officer</option>
                                            <option value={OfficerTypes.ADMINISTRATOR} disabled={!isCurrentUserAdmin}>
                                                Administrator {!isCurrentUserAdmin && "(Admin Only)"}
                                            </option>
                                            <option value={OfficerTypes.HONORARY}>Honorary Officer</option>
                                            <option value={OfficerTypes.PAST}>Past Officer</option>
                                        </select>
                                    </div>

                                    <Button
                                        className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-secondary to-secondary/90 hover:from-secondary/90 hover:to-secondary text-secondary-content border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                        onClick={applyBulkAction}
                                        disabled={selectedOfficers.length === 0 || !bulkActionType}
                                    >
                                        <div className="flex items-center justify-center gap-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                            </svg>
                                            <span>
                                                Apply to {selectedOfficers.length > 0 ? `${selectedOfficers.length} ` : ''}Selected Officer{selectedOfficers.length !== 1 ? 's' : ''}
                                                {bulkActionType && ` → ${bulkActionType.charAt(0).toUpperCase() + bulkActionType.slice(1)}`}
                                            </span>
                                        </div>
                                    </Button>

                                    {/* Enhanced Validation Hints */}
                                    <div className="text-center">
                                        {selectedOfficers.length === 0 ? (
                                            <p className="text-sm text-base-content/50 flex items-center justify-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Select officers from the table below to enable bulk actions
                                            </p>
                                        ) : !bulkActionType ? (
                                            <p className="text-sm text-base-content/50 flex items-center justify-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Choose an officer type for the {selectedOfficers.length} selected officer{selectedOfficers.length !== 1 ? 's' : ''}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-success flex items-center justify-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Ready to update {selectedOfficers.length} officer{selectedOfficers.length !== 1 ? 's' : ''} to {bulkActionType}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Quick Actions Section */}
                            <div className="bg-gradient-to-br from-warning/5 to-warning/10 p-6 rounded-2xl border border-warning/20 shadow-inner">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-warning/10 rounded-xl">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-base-content">Quick Actions</h3>
                                        <p className="text-sm text-base-content/60">Administrative operations for officer management</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Button
                                        className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-warning to-warning/90 hover:from-warning/90 hover:to-warning text-warning-content border-0 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                        onClick={archiveCurrentOfficers}
                                        disabled={!isCurrentUserAdmin}
                                        title={!isCurrentUserAdmin ? "Only administrators can perform this action" : ""}
                                    >
                                        <div className="flex items-center justify-center gap-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                            </svg>
                                            <span>
                                                Archive All General & Executive Officers
                                                {!isCurrentUserAdmin && " (Admin Only)"}
                                            </span>
                                        </div>
                                    </Button>

                                    <div className="bg-gradient-to-r from-warning/10 to-warning/5 p-4 rounded-xl border border-warning/20">
                                        <div className="flex items-start gap-3">
                                            <div className="p-1 bg-warning/20 rounded-lg mt-0.5">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-warning text-sm mb-1">End of Year Action</h4>
                                                <p className="text-sm text-base-content/70 leading-relaxed">
                                                    Use this button at the end of the academic year to archive current officers and prepare for new leadership.
                                                    {!isCurrentUserAdmin && " Only administrators can perform this action."}
                                                </p>
                                                {isCurrentUserAdmin && (
                                                    <div className="mt-2 text-xs text-warning/80 bg-warning/5 px-2 py-1 rounded border border-warning/20">
                                                        This will set all General & Executive officers to "Past" status
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Officers Table Section */}
                <div className="bg-gradient-to-br from-base-200 to-base-300/50 p-8 rounded-2xl shadow-xl border border-base-content/10 transition-all duration-300 hover:shadow-2xl">
                    {/* Header with improved styling */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-xl">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold text-base-content">Current Officers</h2>
                                <p className="text-base-content/60 mt-1">View and manage all organization officers</p>
                            </div>
                        </div>
                        
                        {/* Enhanced search and filter controls */}
                        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto min-w-0">
                            <div className="relative flex-grow lg:min-w-[300px]">
                                <input
                                    type="text"
                                    placeholder="Search officers by name or role..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 bg-base-100 border-2 border-base-content/10 rounded-xl text-base-content placeholder-base-content/50 focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 shadow-sm"
                                />
                                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute inset-y-0 right-0 flex items-center pr-4 text-base-content/40 hover:text-base-content transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="px-4 py-3 bg-base-100 border-2 border-base-content/10 rounded-xl text-base-content focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200 shadow-sm min-w-[140px]"
                            >
                                <option value="">All Types</option>
                                <option value={OfficerTypes.GENERAL}>General</option>
                                <option value={OfficerTypes.EXECUTIVE}>Executive</option>
                                <option value={OfficerTypes.ADMINISTRATOR}>Administrator</option>
                                <option value={OfficerTypes.HONORARY}>Honorary</option>
                                <option value={OfficerTypes.PAST}>Past</option>
                            </select>
                        </div>
                    </div>

                    {/* Results summary */}
                    {!loading && !error && (
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-base-100/50 rounded-xl border border-base-content/5">
                            <div className="flex items-center gap-3">
                                <div className="text-sm text-base-content/70">
                                    Showing <span className="font-semibold text-primary">{filteredOfficers.length}</span> of <span className="font-semibold">{officers.length}</span> officers
                                </div>
                                {(searchTerm || filterType) && (
                                    <div className="flex gap-2">
                                        {searchTerm && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-lg">
                                                Search: "{searchTerm}"
                                                <button onClick={() => setSearchTerm('')} className="hover:bg-primary/20 rounded p-0.5">
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </span>
                                        )}
                                        {filterType && (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/10 text-secondary text-xs rounded-lg">
                                                Type: {filterType}
                                                <button onClick={() => setFilterType('')} className="hover:bg-secondary/20 rounded p-0.5">
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {selectedOfficers.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-base-content/70">
                                        <span className="font-semibold text-primary">{selectedOfficers.length}</span> selected
                                    </span>
                                    <button
                                        onClick={() => setSelectedOfficers([])}
                                        className="text-xs text-error hover:text-error/80 underline"
                                    >
                                        Clear selection
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Enhanced loading state */}
                    {loading ? (
                        <div className="text-center py-16 bg-gradient-to-br from-base-100 to-base-200/50 rounded-2xl border border-base-content/5">
                            <div className="flex flex-col items-center">
                                <div className="relative">
                                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                </div>
                                <h3 className="text-xl font-semibold text-base-content mt-6 mb-2">Loading Officers</h3>
                                <p className="text-base-content/60">Please wait while we fetch the latest officer data...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="text-center py-16 bg-gradient-to-br from-error/5 to-error/10 rounded-2xl border border-error/20">
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-error/10 rounded-full mb-6">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-error mb-2">Failed to Load Officers</h3>
                                <p className="text-error/80 mb-6 max-w-md">{error}</p>
                                <Button 
                                    onClick={fetchOfficers}
                                    className="btn-outline btn-error"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Try Again
                                </Button>
                            </div>
                        </div>
                    ) : filteredOfficers.length === 0 ? (
                        <div className="text-center py-16 bg-gradient-to-br from-base-100 to-base-200/50 rounded-2xl border border-base-content/5">
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-base-content/5 rounded-full mb-6">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-base-content mb-2">
                                    {officers.length === 0 ? 'No Officers Found' : 'No Matching Officers'}
                                </h3>
                                <p className="text-base-content/60 mb-6 max-w-md">
                                    {officers.length === 0 
                                        ? 'Get started by adding your first officer using the form above.'
                                        : 'Try adjusting your search terms or filters to find the officers you\'re looking for.'
                                    }
                                </p>
                                {officers.length === 0 && (
                                    <Button 
                                        onClick={() => document.getElementById('user')?.focus()}
                                        className="btn-primary"
                                    >
                                        Add First Officer
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Enhanced table with better styling */
                        <div className="bg-base-100 rounded-2xl shadow-lg border border-base-content/10 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-base-content">
                                    <thead className="bg-gradient-to-r from-base-200 to-base-300">
                                        <tr className="border-b border-base-content/10">
                                            <th className="p-4 text-left w-12">
                                                <div className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox checkbox-sm checkbox-primary"
                                                        checked={selectedOfficers.length === filteredOfficers.length && filteredOfficers.length > 0}
                                                        onChange={() => {
                                                            if (selectedOfficers.length === filteredOfficers.length) {
                                                                setSelectedOfficers([]);
                                                            } else {
                                                                setSelectedOfficers(filteredOfficers.map(o => o.id));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </th>
                                            <th className="p-4 text-left font-semibold text-base-content">
                                                <div className="flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                    Name
                                                </div>
                                            </th>
                                            <th className="p-4 text-left font-semibold text-base-content">
                                                <div className="flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8m8 0v6a2 2 0 01-2 2H10a2 2 0 01-2-2V6m8 0V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0H8" />
                                                    </svg>
                                                    Role
                                                </div>
                                            </th>
                                            <th className="p-4 text-left font-semibold text-base-content">
                                                <div className="flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                    </svg>
                                                    Type
                                                </div>
                                            </th>
                                            <th className="p-4 text-left font-semibold text-base-content">
                                                <div className="flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                                    </svg>
                                                    Actions
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-base-content/5">
                                        {filteredOfficers.map((officer, index) => {
                                            const isCurrentUser = officer.expand?.user.id === auth.getUserId();
                                            const isAdmin = officer.type === OfficerTypes.ADMINISTRATOR;
                                            
                                            return (
                                                <tr 
                                                    key={officer.id} 
                                                    className={`transition-all duration-200 hover:bg-base-200/50 ${
                                                        selectedOfficers.includes(officer.id) 
                                                            ? 'bg-primary/5 border-l-4 border-l-primary' 
                                                            : ''
                                                    } ${isCurrentUser ? 'bg-success/5' : ''}`}
                                                >
                                                    <td className="p-4">
                                                        <input
                                                            type="checkbox"
                                                            className="checkbox checkbox-sm checkbox-primary"
                                                            checked={selectedOfficers.includes(officer.id)}
                                                            onChange={() => handleSelectOfficer(officer.id)}
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-shrink-0">
                                                                <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
                                                                    <span className="text-sm font-semibold text-primary">
                                                                        {(officer.expand?.user.name || 'U').charAt(0).toUpperCase()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-base-content flex items-center gap-2">
                                                                    {officer.expand?.user.name || 'Unknown User'}
                                                                    {isCurrentUser && (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
                                                                            You
                                                                        </span>
                                                                    )}
                                                                    {isAdmin && (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning border border-warning/20">
                                                                            Admin
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm text-base-content/60">
                                                                    {officer.expand?.user.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="font-medium text-base-content">{officer.role}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <select
                                                            value={officer.type}
                                                            onChange={(e) => handleEditOfficerType(officer.id, e.target.value)}
                                                            className={`select select-sm select-bordered bg-base-100 w-full max-w-[140px] transition-all duration-200 ${
                                                                (isAdmin && !isCurrentUserAdmin) || (isCurrentUser && !isCurrentUserAdmin)
                                                                    ? 'opacity-50 cursor-not-allowed' 
                                                                    : 'hover:border-primary/50 focus:border-primary'
                                                            }`}
                                                            disabled={
                                                                (isAdmin && !isCurrentUserAdmin) ||
                                                                (isCurrentUser && !isCurrentUserAdmin)
                                                            }
                                                            title={
                                                                isAdmin && !isCurrentUserAdmin
                                                                    ? "Only administrators can change administrator status"
                                                                    : isCurrentUser && !isCurrentUserAdmin
                                                                        ? "You cannot change your own role. Only administrators can do that."
                                                                        : ""
                                                            }
                                                        >
                                                            <option value={OfficerTypes.GENERAL}>General</option>
                                                            <option value={OfficerTypes.EXECUTIVE}>Executive</option>
                                                            <option value={OfficerTypes.ADMINISTRATOR}>Administrator</option>
                                                            <option value={OfficerTypes.HONORARY}>Honorary</option>
                                                            <option value={OfficerTypes.PAST}>Past</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => handleRemoveOfficer(officer.id)}
                                                            className={`btn btn-sm btn-error btn-outline transition-all duration-200 ${
                                                                (isAdmin && !isCurrentUserAdmin)
                                                                    ? 'opacity-50 cursor-not-allowed'
                                                                    : 'hover:btn-error hover:scale-105'
                                                            }`}
                                                            disabled={isAdmin && !isCurrentUserAdmin}
                                                            title={isAdmin && !isCurrentUserAdmin ? 
                                                                "Only administrators can remove administrator officers" : ""}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Officer Replacement Confirmation Modal */}
                <dialog id="replaceOfficerModal" className="modal">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg mb-4">Officer Already Exists</h3>

                        {officerToReplace && (
                            <>
                                <p className="mb-4">
                                    <span className="font-medium">{officerToReplace.existingOfficer.expand?.user.name}</span> is already an officer.
                                    Would you like to update their role?
                                </p>

                                <div className="bg-base-300 p-4 rounded-lg mb-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="font-medium text-sm mb-2">Current Role</h4>
                                            <div className="bg-base-100 p-3 rounded border border-base-content/10">
                                                <p className="font-bold">{officerToReplace.existingOfficer.role}</p>
                                                <p className="text-sm opacity-70 mt-1">Type: {officerToReplace.existingOfficer.type}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-medium text-sm mb-2">New Role</h4>
                                            <div className="bg-primary/10 p-3 rounded border border-primary/30">
                                                <p className="font-bold">{officerToReplace.newRole}</p>
                                                <p className="text-sm opacity-70 mt-1">Type: {officerToReplace.newType}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="modal-action flex flex-wrap justify-end gap-2">
                            <button
                                className="btn btn-outline"
                                onClick={() => {
                                    const modal = document.getElementById("replaceOfficerModal") as HTMLDialogElement;
                                    if (modal) modal.close();
                                    setOfficerToReplace(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleReplaceOfficer}
                            >
                                Update Now
                            </button>
                        </div>
                        <p className="text-xs text-base-content/60 mt-4">
                            <strong>Update Now:</strong> Immediately update the officer's role.<br />
                            <strong>Add to Selection:</strong> Add to the current selection to update with other officers.
                        </p>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button>close</button>
                    </form>
                </dialog>
            </div>
        </div>
    );
}
