import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { AlertCircle, Search, FileText, Users, GraduationCap, Briefcase, Filter, Download } from 'lucide-react';
import type { User as FirestoreUser, UserRole } from '../../shared/types/firestore';
import { SponsorPermissionService } from './utils/sponsorPermissions';
import {
    normalizeMajorName,
    getUniqueNormalizedMajors,
    getMajorNormalizationMap
} from '../../../../utils/majorNormalization';
import { Spinner, Select, SelectItem, Pagination, Checkbox, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { showToast } from '../../shared/utils/toast';

interface UserWithResume extends Partial<FirestoreUser> {
    id: string;
    name: string;
    email: string;
    major?: string;
    graduationYear?: number;
    resume?: string;
    role: UserRole;
    position?: string;
}

export default function ResumeDatabaseContent() {
    const [user] = useAuthState(auth);
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [sponsorTier, setSponsorTier] = useState<string | null>(null);
    const [users, setUsers] = useState<UserWithResume[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<UserWithResume[]>([]);
    const [loading, setLoading] = useState(false); // Start false to show cached data immediately
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMajors, setSelectedMajors] = useState<Set<string>>(new Set());
    const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set());
    const [selectedOfficerStatus, setSelectedOfficerStatus] = useState<string>('all');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [selectedUserForModal, setSelectedUserForModal] = useState<UserWithResume | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Real-time listener for current user role and sponsor tier
    useEffect(() => {
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(
            userRef,
            (userDoc) => {
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setCurrentUserRole(userData.role || 'Member');
                    setSponsorTier(userData.sponsorTier || null);
                }
            },
            (error) => {
                console.error('Error fetching user role:', error);
                setCurrentUserRole('Member');
            }
        );

        return () => unsubscribe();
    }, [user]);

    // Real-time listener for users with resumes
    useEffect(() => {
        if (!user || !currentUserRole) return;

        setLoading(true);
        setError(null);

        const usersRef = collection(db, 'users');
        const unsubscribe = onSnapshot(
            usersRef,
            (querySnapshot) => {
                const usersData: UserWithResume[] = querySnapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as UserWithResume))
                    .filter(u => u.resume); // Only include users with resumes

                setUsers(usersData);
                setFilteredUsers(usersData);
                setLoading(false);
            },
            (err) => {
                console.error('Error fetching users:', err);
                setError('Failed to load resume database: ' + err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user, currentUserRole]);

    // Memoize major normalization map for efficient lookups
    const majorNormalizationMap = useMemo(() => {
        const allMajors = users.map(u => u.major).filter((m): m is string => !!m);
        return getMajorNormalizationMap(allMajors, 0.8);
    }, [users]);

    // Get normalized major for a user
    const getNormalizedMajor = (major: string | undefined): string => {
        if (!major) return '';
        const normalized = normalizeMajorName(major);
        return majorNormalizationMap.get(normalized) || normalized;
    };

    // Filter users based on search and filters
    useEffect(() => {
        let filtered = [...users];

        // Search filter - search against normalized major names
        if (searchTerm) {
            filtered = filtered.filter(u => {
                const normalizedMajor = getNormalizedMajor(u.major);
                return (
                    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    normalizedMajor.toLowerCase().includes(searchTerm.toLowerCase())
                );
            });
        }

        // Major filter - compare normalized major names (multi-select)
        if (selectedMajors.size > 0) {
            filtered = filtered.filter(u => {
                const normalizedMajor = getNormalizedMajor(u.major);
                return selectedMajors.has(normalizedMajor);
            });
        }

        // Graduation year filter (multi-select)
        if (selectedYears.size > 0) {
            filtered = filtered.filter(u => {
                return u.graduationYear && selectedYears.has(u.graduationYear.toString());
            });
        }

        // Officer status filter
        if (selectedOfficerStatus === 'officers') {
            filtered = filtered.filter(u =>
                u.role !== 'Member' && u.role !== 'Sponsor'
            );
        } else if (selectedOfficerStatus === 'members') {
            filtered = filtered.filter(u => u.role === 'Member');
        }

        setFilteredUsers(filtered);
        setCurrentPage(1); // Reset to first page when filters change
    }, [searchTerm, selectedMajors, selectedYears, selectedOfficerStatus, users, majorNormalizationMap]);

    // Get unique normalized majors for filter dropdown
    const uniqueMajors = useMemo(() => {
        return getUniqueNormalizedMajors(users.map(u => u.major), 0.8);
    }, [users]);

    // Get unique graduation years for filter dropdown
    const uniqueYears = useMemo(() => {
        const years = users
            .map(u => u.graduationYear)
            .filter((year): year is number => !!year)
            .sort((a, b) => b - a); // Sort descending (most recent first)
        // Remove duplicates by converting to Set and back to array
        return Array.from(new Set(years));
    }, [users]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    // Pagination handlers
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleItemsPerPageChange = (value: string) => {
        setItemsPerPage(Number(value));
        setCurrentPage(1);
    };

    // Selection handlers
    const handleSelectAll = (isSelected: boolean) => {
        if (isSelected) {
            // Select all on current page
            const newSelected = new Set(selectedUsers);
            paginatedUsers.forEach(u => newSelected.add(u.id));
            setSelectedUsers(newSelected);
        } else {
            // Deselect all on current page
            const newSelected = new Set(selectedUsers);
            paginatedUsers.forEach(u => newSelected.delete(u.id));
            setSelectedUsers(newSelected);
        }
    };

    const handleSelectUser = (userId: string) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const handleRowClick = (user: UserWithResume) => {
        setSelectedUserForModal(user);
        setShowResumeModal(true);
    };

    const handleCloseModal = () => {
        setShowResumeModal(false);
        setSelectedUserForModal(null);
    };

    const generateCSV = (users: UserWithResume[]): string => {
        const headers = ['Name', 'Email', 'Major', 'Year Graduating', 'Firebase Resume Link'];
        
        const csvData = users.map(user => {
            const name = user.name || '';
            const email = user.email || '';
            const major = getNormalizedMajor(user.major) || '';
            const year = user.graduationYear?.toString() || '';
            const resumeLink = user.resume || '';
            
            // Escape CSV fields by wrapping in quotes if they contain commas, quotes, or newlines
            const escapeField = (field: string): string => {
                if (field.includes(',') || field.includes('"') || field.includes('\n')) {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            };
            
            return [
                escapeField(name),
                escapeField(email),
                escapeField(major),
                escapeField(year),
                escapeField(resumeLink)
            ].join(',');
        });
        
        return [headers.join(','), ...csvData].join('\n');
    };

    const downloadCSV = (csvContent: string, filename: string) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadSelected = async () => {
        const selectedUsersList = filteredUsers.filter(u => selectedUsers.has(u.id));

        if (selectedUsersList.length === 0) return;

        if (selectedUsersList.length === 1) {
            // Download single PDF
            const user = selectedUsersList[0];
            if (user.resume) {
                const link = document.createElement('a');
                link.href = user.resume;
                link.download = `${user.name.replace(/\s+/g, '_')}_Resume.pdf`;
                link.target = '_blank';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } else {
            // Download CSV for 2+ users
            try {
                const csvContent = generateCSV(selectedUsersList);
                const filename = `Resume_Database_${selectedUsersList.length}_users.csv`;
                downloadCSV(csvContent, filename);
            } catch (err) {
                console.error('Failed to generate CSV:', err);
                showToast.error('Failed to generate CSV. Please try again.');
            }
        }
    };

    // Check if user has access
    if (currentUserRole && !SponsorPermissionService.hasSponsorAccess(currentUserRole, sponsorTier as any)) {
        return (
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <div className="flex items-center">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                        <div className="ml-4">
                            <h3 className="text-lg font-semibold text-red-800">Access Restricted</h3>
                            <p className="text-red-700">
                                {currentUserRole === 'Sponsor' && sponsorTier === 'Bronze'
                                    ? 'Bronze tier sponsors do not have access to the resume database. Please upgrade to Silver tier or above.'
                                    : 'Only Silver tier (or above) Sponsors and Administrators can access the resume database.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto">
            <div className="p-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-2xl shadow p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-blue-100 rounded-xl">
                                <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-600">Total Resumes</p>
                                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-green-100 rounded-lg">
                                <GraduationCap className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-600">Unique Majors</p>
                                <p className="text-2xl font-bold text-gray-900">{uniqueMajors.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <Briefcase className="w-6 h-6 text-purple-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-600">Officers</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {users.filter(u => u.role !== 'Member' && u.role !== 'Sponsor').length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by name, email, or major..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-12 pl-10 pr-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>

                        {/* Major Filter */}
                        <Select
                            selectionMode="multiple"
                            placeholder="Select majors..."
                            selectedKeys={selectedMajors}
                            onSelectionChange={(keys) => setSelectedMajors(new Set(keys as Set<string>))}
                            label="Majors"
                            startContent={<Filter className="w-4 h-4 text-gray-400" />}
                            classNames={{
                                trigger: "h-12",
                            }}
                        >
                            {uniqueMajors.map(major => (
                                <SelectItem key={major}>
                                    {major}
                                </SelectItem>
                            ))}
                        </Select>

                        {/* Graduation Year Filter */}
                        <Select
                            selectionMode="multiple"
                            placeholder="Select years..."
                            selectedKeys={selectedYears}
                            onSelectionChange={(keys) => setSelectedYears(new Set(keys as Set<string>))}
                            label="Graduation Years"
                            startContent={<GraduationCap className="w-4 h-4 text-gray-400" />}
                            classNames={{
                                trigger: "h-12",
                            }}
                        >
                            {uniqueYears.map(year => (
                                <SelectItem key={year.toString()}>
                                    Class of {year}
                                </SelectItem>
                            ))}
                        </Select>

                        {/* Officer Status Filter */}
                        <Select
                            placeholder="Select member type..."
                            selectedKeys={new Set([selectedOfficerStatus])}
                            onSelectionChange={(keys) => setSelectedOfficerStatus(Array.from(keys)[0] as string)}
                            label="Member Type"
                            startContent={<Users className="w-4 h-4 text-gray-400" />}
                            classNames={{
                                trigger: "h-12",
                            }}
                        >
                            <SelectItem key="all">All Members</SelectItem>
                            <SelectItem key="officers">Officers Only</SelectItem>
                            <SelectItem key="members">General Members</SelectItem>
                        </Select>
                    </div>
                </div>

                {/* Results */}
                {loading ? (
                    <div className="bg-white rounded-2xl shadow p-12 text-center">
                        <Spinner size="lg" color="primary" />
                        <p className="mt-4 text-gray-600">Loading resumes...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                        <div className="flex items-center">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                            <p className="ml-3 text-red-700">{error}</p>
                        </div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Resumes Found</h3>
                        <p className="text-gray-600">
                            {searchTerm || selectedMajors.size > 0 || selectedYears.size > 0 || selectedOfficerStatus !== 'all'
                                ? 'Try adjusting your filters'
                                : 'No members have opted in to share their resumes yet'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Selection Actions */}
                        {selectedUsers.size > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-blue-700">
                                        <strong>{selectedUsers.size}</strong> user{selectedUsers.size !== 1 ? 's' : ''} selected
                                    </p>
                                    <div className="flex items-center space-x-3">
                                        <Button
                                            color="primary"
                                            size="sm"
                                            onPress={handleDownloadSelected}
                                            startContent={<Download className="w-4 h-4" />}
                                        >
                                            Download {selectedUsers.size === 1 ? 'Resume' : 'as CSV'}
                                        </Button>
                                        <Button
                                            color="default"
                                            variant="light"
                                            size="sm"
                                            onPress={() => setSelectedUsers(new Set())}
                                        >
                                            Clear Selection
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl shadow overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left">
                                                <Checkbox
                                                    isSelected={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUsers.has(u.id))}
                                                    onValueChange={handleSelectAll}
                                                    size="sm"
                                                    aria-label="Select all users"
                                                />
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Name
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Major
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Graduation Year
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Role
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {paginatedUsers.map((user) => (
                                            <tr
                                                key={user.id}
                                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                            >
                                                <td
                                                    className="px-6 py-4 whitespace-nowrap cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectUser(user.id);
                                                    }}
                                                >
                                                    <div className="flex items-center justify-center">
                                                        <Checkbox
                                                            isSelected={selectedUsers.has(user.id)}
                                                            onValueChange={() => handleSelectUser(user.id)}
                                                            size="sm"
                                                            aria-label={`Select ${user.name}`}
                                                        />
                                                    </div>
                                                </td>
                                                <td
                                                    className="px-6 py-4 whitespace-nowrap"
                                                    onClick={() => handleRowClick(user)}
                                                >
                                                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                                </td>
                                                <td
                                                    className="px-6 py-4 whitespace-nowrap"
                                                    onClick={() => handleRowClick(user)}
                                                >
                                                    <div className="text-sm text-gray-600">{user.email}</div>
                                                </td>
                                                <td
                                                    className="px-6 py-4 whitespace-nowrap"
                                                    onClick={() => handleRowClick(user)}
                                                >
                                                    <div className="text-sm text-gray-900 max-w-[200px] truncate" title={getNormalizedMajor(user.major) || 'N/A'}>
                                                        {getNormalizedMajor(user.major) || 'N/A'}
                                                    </div>
                                                </td>
                                                <td
                                                    className="px-6 py-4 whitespace-nowrap"
                                                    onClick={() => handleRowClick(user)}
                                                >
                                                    <div className="text-sm text-gray-900">{user.graduationYear || 'N/A'}</div>
                                                </td>
                                                <td
                                                    className="px-6 py-4 whitespace-nowrap"
                                                    onClick={() => handleRowClick(user)}
                                                >
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'Member' ? 'bg-gray-100 text-gray-800' :
                                                        user.role === 'General Officer' ? 'bg-blue-100 text-blue-800' :
                                                            user.role === 'Executive Officer' ? 'bg-purple-100 text-purple-800' :
                                                                user.role === 'Administrator' ? 'bg-red-100 text-red-800' :
                                                                    'bg-green-100 text-green-800'
                                                        }`}>
                                                        {user.position || user.role}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        {/* Results info and items per page selector */}
                                        <div className="flex flex-col sm:flex-row items-center gap-4">
                                            <p className="text-sm text-gray-700">
                                                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                                                <span className="font-medium">{Math.min(endIndex, filteredUsers.length)}</span> of{' '}
                                                <span className="font-medium">{filteredUsers.length}</span> results
                                            </p>

                                            {/* Items per page selector */}
                                            <div className="flex items-center space-x-2">
                                                <label className="text-sm text-gray-700">
                                                    Per page:
                                                </label>
                                                <Select
                                                    selectedKeys={new Set([itemsPerPage.toString()])}
                                                    onSelectionChange={(keys) => handleItemsPerPageChange(Array.from(keys)[0] as string)}
                                                    size="sm"
                                                    className="w-20"
                                                    classNames={{
                                                        trigger: "h-8",
                                                    }}
                                                >
                                                    <SelectItem key="10">10</SelectItem>
                                                    <SelectItem key="25">25</SelectItem>
                                                    <SelectItem key="50">50</SelectItem>
                                                    <SelectItem key="100">100</SelectItem>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* HeroUI Pagination */}
                                        <Pagination
                                            total={totalPages}
                                            page={currentPage}
                                            onChange={handlePageChange}
                                            showControls={true}
                                            siblings={2}
                                            boundaries={1}
                                            size="sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Resume Modal */}
                <Modal
                    isOpen={showResumeModal}
                    onOpenChange={(open) => !open && handleCloseModal()}
                    size="5xl"
                    backdrop="blur"
                    scrollBehavior="inside"
                >
                    <ModalContent>
                        {(onClose) => (
                            <>
                                {/* Modal Header */}
                                <ModalHeader className="flex flex-col gap-1">
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedUserForModal?.name}</h2>
                                    <p className="text-sm text-gray-600">
                                        {selectedUserForModal?.email} • {getNormalizedMajor(selectedUserForModal?.major) || 'N/A'} • Class of {selectedUserForModal?.graduationYear || 'N/A'}
                                    </p>
                                </ModalHeader>

                                {/* Modal Body - Resume Viewer */}
                                <ModalBody className="py-6">
                                    {selectedUserForModal?.resume ? (
                                        <iframe
                                            src={selectedUserForModal.resume}
                                            className="w-full h-[600px] border border-gray-300 rounded-xl"
                                            title={`${selectedUserForModal.name}'s Resume`}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-64">
                                            <div className="text-center">
                                                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                                <p className="text-gray-600">No resume available</p>
                                            </div>
                                        </div>
                                    )}
                                </ModalBody>

                                {/* Modal Footer */}
                                <ModalFooter>
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center space-x-2">
                                            <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedUserForModal?.role === 'Member' ? 'bg-gray-100 text-gray-800' :
                                                selectedUserForModal?.role === 'General Officer' ? 'bg-blue-100 text-blue-800' :
                                                    selectedUserForModal?.role === 'Executive Officer' ? 'bg-purple-100 text-purple-800' :
                                                        selectedUserForModal?.role === 'Administrator' ? 'bg-red-100 text-red-800' :
                                                            'bg-green-100 text-green-800'
                                                }`}>
                                                {selectedUserForModal?.position || selectedUserForModal?.role}
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            {selectedUserForModal?.resume && (
                                                <Button
                                                    as="a"
                                                    href={selectedUserForModal.resume}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    color="primary"
                                                >
                                                    Open in New Tab
                                                </Button>
                                            )}
                                            <Button
                                                color="default"
                                                variant="flat"
                                                onPress={onClose}
                                            >
                                                Close
                                            </Button>
                                        </div>
                                    </div>
                                </ModalFooter>
                            </>
                        )}
                    </ModalContent>
                </Modal>
            </div>
        </div>
    );
}