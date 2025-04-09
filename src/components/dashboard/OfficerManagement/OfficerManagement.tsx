import React, { useState, useEffect, useRef } from 'react';
import { Authentication, Get, Update, Realtime } from '../../../scripts/pocketbase';
import { Collections, OfficerTypes } from '../../../schemas/pocketbase';
import type { User, Officer } from '../../../schemas/pocketbase/schema';
import { Button } from '../universal/Button';
import toast from 'react-hot-toast';
import { Toast } from '../universal/Toast';

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

            // Update the existing officer record
            await pb.collection(Collections.OFFICERS).update(officerToReplace.existingOfficer.id, {
                role: officerToReplace.newRole,
                type: officerToReplace.newType
            });

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

                    if (existingOfficer) {
                        // Update existing officer
                        const updatedOfficer = await pb.collection(Collections.OFFICERS).update(existingOfficer.id, {
                            role: newOfficerRole,
                            type: validType
                        });

                        successfulUpdates.push(updatedOfficer);
                    } else {
                        // Create new officer record
                        const createdOfficer = await pb.collection(Collections.OFFICERS).create({
                            user: user.id,
                            role: newOfficerRole,
                            type: validType
                        });

                        successfulCreations.push(createdOfficer);
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
            await updateService.updateField(Collections.OFFICERS, officerId, 'type', newType);

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
        <div className="container mx-auto text-base-content">
            {/* Toast notifications are handled by react-hot-toast */}

            {/* Admin status indicator */}
            {isCurrentUserAdmin && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 mb-4 text-success flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>You have administrator privileges and can manage all officers</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Add New Officer Section */}
                <div className="bg-base-200 p-6 rounded-xl shadow-md border border-base-content/5 transition-all duration-300 hover:shadow-lg mb-8">
                    <h2 className="text-2xl font-semibold mb-4 text-base-content flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        Add New Officer
                    </h2>
                    <form className="space-y-4" onSubmit={handleAddOfficer}>
                        <div>
                            <label htmlFor="user" className="block mb-2 text-sm font-medium text-base-content">
                                Add Users
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    id="user"
                                    value={userSearchTerm}
                                    ref={searchInputRef}
                                    onChange={handleUserSearchChange}
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="Search for users..."
                                    className="w-full p-3 bg-base-300 border border-base-content/20 rounded-lg text-base-content placeholder-base-content/50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                                    onFocus={() => searchUsers(userSearchTerm)}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    {selectedUsers.length > 0 ? (
                                        <div className="bg-primary text-primary-content text-xs font-medium rounded-full h-5 w-5 flex items-center justify-center mr-2">
                                            {selectedUsers.length}
                                        </div>
                                    ) : null}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>

                                {/* User search results dropdown */}
                                {userSearchTerm.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full bg-base-300 border border-base-content/20 rounded-lg shadow-lg">
                                        <div className="sticky top-0 bg-base-300 p-2 border-b border-base-content/10 flex justify-between items-center">
                                            <span className="text-sm font-medium">
                                                {userSearchResults.length > 0
                                                    ? `${userSearchResults.length} result${userSearchResults.length !== 1 ? 's' : ''}`
                                                    : 'No results found'}
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setUserSearchTerm('');
                                                        searchInputRef.current?.focus();
                                                    }}
                                                    className="text-xs px-2 py-1 bg-base-100 rounded hover:bg-base-200"
                                                    type="button"
                                                    title="Clear search"
                                                >
                                                    Clear
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setUserSearchResults([]);
                                                        setUserSearchTerm('');
                                                    }}
                                                    className="text-base-content/70 hover:text-base-content"
                                                    type="button"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {userSearchResults.length === 0 ? (
                                            <div className="py-6 text-center text-base-content/60">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                <p>No users found matching "{userSearchTerm}"</p>
                                                <p className="text-sm mt-1">Try a different search term</p>
                                            </div>
                                        ) : (
                                            <ul className="py-1 max-h-60 overflow-auto">
                                                {userSearchResults.map((user, index) => {
                                                    const isSelected = selectedUsers.some(u => u.id === user.id);
                                                    const isAlreadyOfficer = officers.some(officer => officer.expand?.user.id === user.id);
                                                    const isHighlighted = index === currentHighlightedIndex;

                                                    return (
                                                        <li
                                                            key={user.id}
                                                            onClick={() => handleSelectUser(user)}
                                                            className={`px-4 py-2 hover:bg-base-100 cursor-pointer 
                                                                ${isSelected ? 'bg-primary/10' : ''} 
                                                                ${isHighlighted ? 'bg-base-content/10' : ''}`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <div className="font-medium flex items-center">
                                                                        {user.name}
                                                                        {isAlreadyOfficer && (
                                                                            <span className="ml-2 text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">
                                                                                Already an officer
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-sm text-base-content/70">{user.email}</div>
                                                                </div>
                                                                {!isAlreadyOfficer && (
                                                                    isSelected ? (
                                                                        <div className="text-primary">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-primary/50">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                                            </svg>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}

                                        <div className="border-t border-base-content/10 p-2 sticky bottom-0 bg-base-300 flex justify-between">
                                            <button
                                                onClick={() => {
                                                    setSelectedUsers([]);
                                                }}
                                                className="btn btn-sm btn-outline btn-error flex-1 mr-1"
                                                type="button"
                                                disabled={selectedUsers.length === 0}
                                            >
                                                Clear All ({selectedUsers.length})
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setUserSearchResults([]);
                                                    setUserSearchTerm('');
                                                }}
                                                className="btn btn-sm btn-primary flex-1 ml-1"
                                                type="button"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selected users display */}
                            {selectedUsers.length > 0 && (
                                <div className="mt-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-medium text-base-content">
                                            Selected Users ({selectedUsers.length})
                                        </label>
                                        {selectedUsers.length > 0 && (
                                            <button
                                                onClick={() => setSelectedUsers([])}
                                                type="button"
                                                className="text-xs text-error hover:text-error/80 flex items-center"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Clear All
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 p-3 bg-base-300 rounded-lg border border-base-content/10 max-h-28 overflow-y-auto">
                                        {selectedUsers.length === 0 ? (
                                            <div className="text-sm text-base-content/50 text-center w-full py-2">
                                                No users selected
                                            </div>
                                        ) : (
                                            selectedUsers.map(user => (
                                                <div
                                                    key={user.id}
                                                    className="flex items-center bg-base-100 px-3 py-1.5 rounded-lg group border border-base-content/10 hover:border-error/30"
                                                >
                                                    <span className="mr-2 text-sm">{user.name}</span>
                                                    <button
                                                        onClick={() => handleRemoveSelectedUser(user.id)}
                                                        type="button"
                                                        className="text-base-content/50 hover:text-error transition-colors"
                                                        title="Remove user"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="role" className="block mb-2 text-sm font-medium text-base-content">
                                Role
                            </label>
                            <input
                                type="text"
                                id="role"
                                value={newOfficerRole}
                                onChange={(e) => setNewOfficerRole(e.target.value)}
                                placeholder="e.g. President, Technical Vice Chair"
                                className="w-full p-3 bg-base-300 border border-base-content/20 rounded-lg text-base-content placeholder-base-content/50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            />
                        </div>

                        <div>
                            <label htmlFor="type" className="block mb-2 text-sm font-medium text-base-content">
                                Officer Type
                            </label>
                            <select
                                id="type"
                                value={newOfficerType}
                                onChange={(e) => setNewOfficerType(e.target.value)}
                                className="w-full p-3 bg-base-300 border border-base-content/20 rounded-lg text-base-content focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            >
                                <option value={OfficerTypes.GENERAL}>General</option>
                                <option value={OfficerTypes.EXECUTIVE}>Executive</option>
                                <option value={OfficerTypes.ADMINISTRATOR} disabled={!isCurrentUserAdmin}>
                                    Administrator {!isCurrentUserAdmin && "(Admin only)"}
                                </option>
                                <option value={OfficerTypes.HONORARY}>Honorary</option>
                                <option value={OfficerTypes.PAST}>Past</option>
                            </select>
                        </div>

                        <Button
                            type="submit"
                            className="w-full mt-2"
                        >
                            Add {selectedUsers.length > 0 ? `${selectedUsers.length} ` : ''}Officer{selectedUsers.length !== 1 ? 's' : ''}
                        </Button>
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
                <div className="bg-base-200 p-6 rounded-xl shadow-md border border-base-content/5 transition-all duration-300 hover:shadow-lg">
                    <h2 className="text-2xl font-semibold mb-4 text-base-content flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        Bulk Actions
                    </h2>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-4">
                            <div className="form-control">
                                <label htmlFor="bulkAction" className="block mb-2 text-sm font-medium text-base-content">
                                    Set Selected Officers To
                                </label>
                                <select
                                    id="bulkAction"
                                    value={bulkActionType}
                                    onChange={handleBulkActionTypeChange}
                                    className="w-full p-3 bg-base-300 border border-base-content/20 rounded-lg text-base-content focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                                >
                                    <option value="">Select action...</option>
                                    <option value={OfficerTypes.GENERAL}>General</option>
                                    <option value={OfficerTypes.EXECUTIVE}>Executive</option>
                                    <option value={OfficerTypes.ADMINISTRATOR} disabled={!isCurrentUserAdmin}>
                                        Administrator {!isCurrentUserAdmin && "(Admin only)"}
                                    </option>
                                    <option value={OfficerTypes.HONORARY}>Honorary</option>
                                    <option value={OfficerTypes.PAST}>Past</option>
                                </select>
                            </div>
                            <Button
                                className="w-full"
                                onClick={applyBulkAction}
                                disabled={selectedOfficers.length === 0 || !bulkActionType}
                            >
                                Apply to {selectedOfficers.length} Selected
                            </Button>
                        </div>
                        <div className="text-sm text-base-content/70 bg-base-300 p-2 rounded-lg">
                            Select officers from the table below
                        </div>

                        <div className="pt-4 border-t border-base-content/10">
                            <h3 className="text-lg font-medium mb-3 text-base-content">Quick Actions</h3>
                            <Button
                                className="bg-warning hover:bg-warning/80 w-full"
                                onClick={archiveCurrentOfficers}
                                disabled={!isCurrentUserAdmin}
                                title={!isCurrentUserAdmin ? "Only administrators can perform this action" : ""}
                            >
                                Set All General & Executive Officers to Past
                                {!isCurrentUserAdmin && " (Admin only)"}
                            </Button>
                            <div className="mt-2 text-sm text-base-content/70 bg-base-300 p-2 rounded-lg">
                                Use this button at the end of the academic year to archive current officers.
                                {!isCurrentUserAdmin && " Only administrators can perform this action."}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Officers Table Section */}
            <div className="bg-base-200 p-6 rounded-xl shadow-md border border-base-content/5 transition-all duration-300 hover:shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h2 className="text-2xl font-semibold text-base-content flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Current Officers
                    </h2>
                    <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                        <div className="relative flex-grow">
                            <input
                                type="text"
                                placeholder="Search officers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-3 pl-10 bg-base-300 border border-base-content/20 rounded-lg text-base-content placeholder-base-content/50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            />
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="p-3 bg-base-300 border border-base-content/20 rounded-lg text-base-content focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
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

                {loading ? (
                    <div className="text-center p-8 bg-base-300 rounded-lg border border-base-content/10">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="text-base-content/70 text-lg mt-4">Loading officers...</p>
                    </div>
                ) : error ? (
                    <div className="text-center p-8 bg-base-300 rounded-lg border border-base-content/10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-error mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-error text-lg">{error}</p>
                        <Button className="mt-4" onClick={fetchOfficers}>Try Again</Button>
                    </div>
                ) : filteredOfficers.length === 0 ? (
                    <div className="text-center p-8 bg-base-300 rounded-lg border border-base-content/10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-base-content/70 text-lg">No officers found.</p>
                        <p className="text-base-content/50 mt-2">Add officers using the form on the left.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-base-content">
                            <thead className="bg-base-300">
                                <tr>
                                    <th className="p-3 text-left">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm"
                                            checked={selectedOfficers.length === filteredOfficers.length && filteredOfficers.length > 0}
                                            onChange={() => {
                                                if (selectedOfficers.length === filteredOfficers.length) {
                                                    setSelectedOfficers([]);
                                                } else {
                                                    setSelectedOfficers(filteredOfficers.map(o => o.id));
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="p-3 text-left">Name</th>
                                    <th className="p-3 text-left">Role</th>
                                    <th className="p-3 text-left">Type</th>
                                    <th className="p-3 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOfficers.map((officer) => (
                                    <tr key={officer.id} className="border-b border-base-content/10 hover:bg-base-300/50">
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-sm"
                                                checked={selectedOfficers.includes(officer.id)}
                                                onChange={() => handleSelectOfficer(officer.id)}
                                            />
                                        </td>
                                        <td className="p-3 font-medium">
                                            {officer.expand?.user.name || 'Unknown User'}
                                        </td>
                                        <td className="p-3">{officer.role}</td>
                                        <td className="p-3">
                                            <select
                                                value={officer.type}
                                                onChange={(e) => handleEditOfficerType(officer.id, e.target.value)}
                                                className={`select select-sm select-bordered w-full max-w-xs ${(officer.type === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin) ? 'opacity-70' : ''}`}
                                                disabled={
                                                    (officer.type === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin) ||
                                                    (officer.expand?.user.id === auth.getUserId() && !isCurrentUserAdmin)
                                                }
                                                title={
                                                    officer.type === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin
                                                        ? "Only administrators can change administrator status"
                                                        : officer.expand?.user.id === auth.getUserId() && !isCurrentUserAdmin
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
                                        <td className="p-3">
                                            <button
                                                onClick={() => handleRemoveOfficer(officer.id)}
                                                className="btn btn-sm btn-error"
                                                disabled={officer.type === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin}
                                                title={officer.type === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin ?
                                                    "Only administrators can remove administrator officers" : ""}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
    );
}
