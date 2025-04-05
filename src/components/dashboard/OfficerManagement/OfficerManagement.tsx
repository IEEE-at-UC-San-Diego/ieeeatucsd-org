import React, { useState, useEffect, useRef } from 'react';
import { Authentication, Get, Update, Realtime } from '../../../scripts/pocketbase';
import { Collections, OfficerTypes } from '../../../schemas/pocketbase';
import type { User, Officer } from '../../../schemas/pocketbase/schema';
import { Button } from '../universal/Button';
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

    // State for toast notifications
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

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
            setToast({
                message: 'Failed to search users. Please try again.',
                type: 'error'
            });
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
        // Check if user is already an officer
        const isAlreadyOfficer = officers.some(officer => officer.expand?.user.id === user.id);

        if (isAlreadyOfficer) {
            setToast({
                message: `${user.name} is already an officer`,
                type: 'info'
            });
            return;
        }

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

    // Handle adding a new officer
    const handleAddOfficer = async (e: React.FormEvent) => {
        e.preventDefault();

        if (selectedUsers.length === 0) {
            setToast({
                message: 'Please select at least one user',
                type: 'error'
            });
            return;
        }

        if (!newOfficerRole) {
            setToast({
                message: 'Please enter a role',
                type: 'error'
            });
            return;
        }

        // Check if trying to add an administrator without being an administrator
        if (newOfficerType === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin) {
            setToast({
                message: 'Only administrators can add new administrators',
                type: 'error'
            });
            return;
        }

        try {
            // Filter out users who are already officers
            const usersToAdd = selectedUsers.filter(user =>
                !officers.some(officer => officer.expand?.user.id === user.id)
            );

            if (usersToAdd.length === 0) {
                setToast({
                    message: 'All selected users are already officers',
                    type: 'error'
                });
                return;
            }

            // Create officer records for each user
            const createPromises = usersToAdd.map(user =>
                updateService.create(Collections.OFFICERS, {
                    user: user.id,
                    role: newOfficerRole,
                    type: newOfficerType
                })
            );

            await Promise.all(createPromises);

            // Reset form
            setSelectedUsers([]);
            setUserSearchTerm('');
            setNewOfficerRole('');
            setNewOfficerType(OfficerTypes.GENERAL);

            setToast({
                message: `${usersToAdd.length} officer(s) added successfully`,
                type: 'success'
            });

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to add officer:', err);
            setToast({
                message: 'Failed to add officer. Please try again.',
                type: 'error'
            });
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
            setToast({
                message: 'Please select officers and an action type',
                type: 'info'
            });
            return;
        }

        // Check if trying to set officers to administrator without being an administrator
        if (bulkActionType === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin) {
            setToast({
                message: 'Only administrators can promote officers to administrator',
                type: 'error'
            });
            return;
        }

        // Check if trying to modify administrators without being an administrator
        if (!isCurrentUserAdmin) {
            const hasAdmins = selectedOfficers.some(id => {
                const officer = officers.find(o => o.id === id);
                return officer?.type === OfficerTypes.ADMINISTRATOR;
            });

            if (hasAdmins) {
                setToast({
                    message: 'Only administrators can modify administrator officers',
                    type: 'error'
                });
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

            setToast({
                message: `Successfully updated ${selectedOfficers.length} officers`,
                type: 'success'
            });

            // Reset selection
            setSelectedOfficers([]);
            setBulkActionType('');

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to apply bulk action:', err);
            setToast({
                message: 'Failed to update officers. Please try again.',
                type: 'error'
            });
        }
    };

    // Set all general and executive officers to past
    const archiveCurrentOfficers = async () => {
        // Only administrators can perform this bulk action
        if (!isCurrentUserAdmin) {
            setToast({
                message: 'Only administrators can archive all officers',
                type: 'error'
            });
            return;
        }

        try {
            // Find all general and executive officers
            const officersToArchive = officers.filter(
                officer => officer.type === OfficerTypes.GENERAL || officer.type === OfficerTypes.EXECUTIVE
            );

            if (officersToArchive.length === 0) {
                setToast({
                    message: 'No general or executive officers to archive',
                    type: 'info'
                });
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

            setToast({
                message: `Successfully archived ${officersToArchive.length} officers`,
                type: 'success'
            });

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to archive officers:', err);
            setToast({
                message: 'Failed to archive officers. Please try again.',
                type: 'error'
            });
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
            setToast({
                message: 'Officer not found',
                type: 'error'
            });
            return;
        }

        // Check permissions
        if (officerToRemove.type === OfficerTypes.ADMINISTRATOR && !isCurrentUserAdmin) {
            setToast({
                message: 'Only administrators can remove administrator officers',
                type: 'error'
            });
            return;
        }

        if (!window.confirm('Are you sure you want to remove this officer?')) {
            return;
        }

        try {
            const pb = auth.getPocketBase();

            await pb.collection(Collections.OFFICERS).delete(officerId);

            setToast({
                message: 'Officer removed successfully',
                type: 'success'
            });

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to remove officer:', err);
            setToast({
                message: 'Failed to remove officer. Please try again.',
                type: 'error'
            });
        }
    };

    // Handle editing an officer's type
    const handleEditOfficerType = async (officerId: string, newType: string) => {
        // Get the officer to check current type
        const officerToEdit = officers.find(o => o.id === officerId);

        if (!officerToEdit) {
            setToast({
                message: 'Officer not found',
                type: 'error'
            });
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
            setToast({
                message: 'You cannot change your own role. Only administrators can do that.',
                type: 'error'
            });
            return;
        }

        // Check permissions for changing to/from administrator
        if ((officerToEdit.type === OfficerTypes.ADMINISTRATOR || newType === OfficerTypes.ADMINISTRATOR) && !isCurrentUserAdmin) {
            setToast({
                message: 'Only administrators can change administrator status',
                type: 'error'
            });
            return;
        }

        try {
            await updateService.updateField(Collections.OFFICERS, officerId, 'type', newType);

            setToast({
                message: 'Officer updated successfully',
                type: 'success'
            });

            // Refresh officers list
            fetchOfficers();
        } catch (err) {
            console.error('Failed to update officer:', err);
            setToast({
                message: 'Failed to update officer. Please try again.',
                type: 'error'
            });
        }
    };

    return (
        <div className="container mx-auto text-base-content">
            {/* Toast notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

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
                                                                ${isAlreadyOfficer ? 'opacity-50' : ''} 
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
        </div>
    );
}
