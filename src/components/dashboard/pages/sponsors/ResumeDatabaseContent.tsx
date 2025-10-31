import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { AlertCircle, Search, FileText, Users, GraduationCap, Briefcase, Filter, X, CheckSquare, Square, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import type { User as FirestoreUser, UserRole } from '../../shared/types/firestore';
import { SponsorPermissionService } from './utils/sponsorPermissions';
import JSZip from 'jszip';
import {
    normalizeMajorName,
    getUniqueNormalizedMajors,
    getMajorNormalizationMap
} from '../../../../utils/majorNormalization';

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
    const [selectedMajor, setSelectedMajor] = useState<string>('all');
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

        // Check permissions before querying Firestore
        if (!SponsorPermissionService.hasSponsorAccess(currentUserRole, sponsorTier as any)) {
            setLoading(false);
            return;
        }

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
    }, [user, currentUserRole, sponsorTier]);

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

        // Major filter - compare normalized major names
        if (selectedMajor !== 'all') {
            filtered = filtered.filter(u => {
                const normalizedMajor = getNormalizedMajor(u.major);
                return normalizedMajor === selectedMajor;
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
    }, [searchTerm, selectedMajor, selectedOfficerStatus, users, majorNormalizationMap]);

    // Get unique normalized majors for filter dropdown
    const uniqueMajors = useMemo(() => {
        return getUniqueNormalizedMajors(users.map(u => u.major), 0.8);
    }, [users]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

    // Pagination handlers
    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    // Selection handlers
    const handleSelectAll = () => {
        if (selectedUsers.size === paginatedUsers.length && paginatedUsers.every(u => selectedUsers.has(u.id))) {
            // Deselect all on current page
            const newSelected = new Set(selectedUsers);
            paginatedUsers.forEach(u => newSelected.delete(u.id));
            setSelectedUsers(newSelected);
        } else {
            // Select all on current page
            const newSelected = new Set(selectedUsers);
            paginatedUsers.forEach(u => newSelected.add(u.id));
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
            // Download multiple PDFs as ZIP
            try {
                const zip = new JSZip();

                // Fetch all PDFs
                const fetchPromises = selectedUsersList.map(async (user) => {
                    if (!user.resume) return;

                    try {
                        const response = await fetch(user.resume);
                        const blob = await response.blob();
                        const fileName = `${user.name.replace(/\s+/g, '_')}_Resume.pdf`;
                        zip.file(fileName, blob);
                    } catch (err) {
                        console.error(`Failed to fetch resume for ${user.name}:`, err);
                    }
                });

                await Promise.all(fetchPromises);

                // Generate ZIP file
                const zipBlob = await zip.generateAsync({ type: 'blob' });

                // Download ZIP
                const link = document.createElement('a');
                link.href = URL.createObjectURL(zipBlob);
                link.download = `Resumes_${selectedUsersList.length}_users.zip`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            } catch (err) {
                console.error('Failed to create ZIP:', err);
                alert('Failed to download resumes. Please try again.');
            }
        }
    };

    // Check if user has access
    if (currentUserRole && !SponsorPermissionService.hasSponsorAccess(currentUserRole, sponsorTier as any)) {
        return (
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
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
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <FileText className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm text-gray-600">Total Resumes</p>
                                <p className="text-2xl font-bold text-gray-900">{users.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6">
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
                    <div className="bg-white rounded-lg shadow p-6">
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
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search by name, email, or major..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Major Filter */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <select
                                value={selectedMajor}
                                onChange={(e) => setSelectedMajor(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                            >
                                <option value="all">All Majors</option>
                                {uniqueMajors.map(major => (
                                    <option key={major} value={major}>{major}</option>
                                ))}
                            </select>
                        </div>

                        {/* Officer Status Filter */}
                        <div className="relative">
                            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <select
                                value={selectedOfficerStatus}
                                onChange={(e) => setSelectedOfficerStatus(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                            >
                                <option value="all">All Members</option>
                                <option value="officers">Officers Only</option>
                                <option value="members">General Members</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results */}
                {loading ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Loading resumes...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <div className="flex items-center">
                            <AlertCircle className="h-6 w-6 text-red-600" />
                            <p className="ml-3 text-red-700">{error}</p>
                        </div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Resumes Found</h3>
                        <p className="text-gray-600">
                            {searchTerm || selectedMajor !== 'all' || selectedOfficerStatus !== 'all'
                                ? 'Try adjusting your filters'
                                : 'No members have opted in to share their resumes yet'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Selection Actions */}
                        {selectedUsers.size > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-blue-700">
                                        <strong>{selectedUsers.size}</strong> user{selectedUsers.size !== 1 ? 's' : ''} selected
                                    </p>
                                    <div className="flex items-center space-x-3">
                                        <button
                                            onClick={handleDownloadSelected}
                                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                        >
                                            <Download className="w-4 h-4 mr-2" />
                                            Download {selectedUsers.size === 1 ? 'Resume' : 'as ZIP'}
                                        </button>
                                        <button
                                            onClick={() => setSelectedUsers(new Set())}
                                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            Clear Selection
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left">
                                                <button
                                                    onClick={handleSelectAll}
                                                    className="flex items-center text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                                                >
                                                    {paginatedUsers.length > 0 && paginatedUsers.every(u => selectedUsers.has(u.id)) ? (
                                                        <CheckSquare className="w-5 h-5" />
                                                    ) : (
                                                        <Square className="w-5 h-5" />
                                                    )}
                                                </button>
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
                                                        {selectedUsers.has(user.id) ? (
                                                            <CheckSquare className="w-5 h-5 text-blue-600" />
                                                        ) : (
                                                            <Square className="w-5 h-5 text-gray-600 hover:text-gray-900" />
                                                        )}
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
                                    <div className="flex items-center justify-between">
                                        {/* Results info */}
                                        <div className="flex items-center space-x-4">
                                            <p className="text-sm text-gray-700">
                                                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                                                <span className="font-medium">{Math.min(endIndex, filteredUsers.length)}</span> of{' '}
                                                <span className="font-medium">{filteredUsers.length}</span> results
                                            </p>

                                            {/* Items per page selector */}
                                            <div className="flex items-center space-x-2">
                                                <label htmlFor="itemsPerPage" className="text-sm text-gray-700">
                                                    Per page:
                                                </label>
                                                <select
                                                    id="itemsPerPage"
                                                    value={itemsPerPage}
                                                    onChange={(e) => {
                                                        setItemsPerPage(Number(e.target.value));
                                                        setCurrentPage(1);
                                                    }}
                                                    className="border border-gray-300 rounded-md text-sm py-1 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value={10}>10</option>
                                                    <option value={25}>25</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Page navigation */}
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={goToPreviousPage}
                                                disabled={currentPage === 1}
                                                className={`p-2 rounded-lg transition-colors ${currentPage === 1
                                                    ? 'text-gray-400 cursor-not-allowed'
                                                    : 'text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                            </button>

                                            {/* Page numbers */}
                                            <div className="flex items-center space-x-1">
                                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                    let pageNum;
                                                    if (totalPages <= 5) {
                                                        pageNum = i + 1;
                                                    } else if (currentPage <= 3) {
                                                        pageNum = i + 1;
                                                    } else if (currentPage >= totalPages - 2) {
                                                        pageNum = totalPages - 4 + i;
                                                    } else {
                                                        pageNum = currentPage - 2 + i;
                                                    }

                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => goToPage(pageNum)}
                                                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                                                                ? 'bg-blue-600 text-white'
                                                                : 'text-gray-700 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                onClick={goToNextPage}
                                                disabled={currentPage === totalPages}
                                                className={`p-2 rounded-lg transition-colors ${currentPage === totalPages
                                                    ? 'text-gray-400 cursor-not-allowed'
                                                    : 'text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Resume Modal */}
                {showResumeModal && selectedUserForModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-gray-200">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedUserForModal.name}</h2>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {selectedUserForModal.email} • {getNormalizedMajor(selectedUserForModal.major) || 'N/A'} • Class of {selectedUserForModal.graduationYear || 'N/A'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCloseModal}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-6 h-6 text-gray-600" />
                                </button>
                            </div>

                            {/* Modal Body - Resume Viewer */}
                            <div className="flex-1 overflow-auto p-6">
                                {selectedUserForModal.resume ? (
                                    <iframe
                                        src={selectedUserForModal.resume}
                                        className="w-full h-full min-h-[600px] border border-gray-300 rounded-lg"
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
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-between p-6 border-t border-gray-200">
                                <div className="flex items-center space-x-2">
                                    <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${selectedUserForModal.role === 'Member' ? 'bg-gray-100 text-gray-800' :
                                        selectedUserForModal.role === 'General Officer' ? 'bg-blue-100 text-blue-800' :
                                            selectedUserForModal.role === 'Executive Officer' ? 'bg-purple-100 text-purple-800' :
                                                selectedUserForModal.role === 'Administrator' ? 'bg-red-100 text-red-800' :
                                                    'bg-green-100 text-green-800'
                                        }`}>
                                        {selectedUserForModal.position || selectedUserForModal.role}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    {selectedUserForModal.resume && (
                                        <a
                                            href={selectedUserForModal.resume}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Open in New Tab
                                        </a>
                                    )}
                                    <button
                                        onClick={handleCloseModal}
                                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

