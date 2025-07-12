import { useState, useEffect } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { User } from '../../../schemas/pocketbase/schema';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

interface ResumeUser {
    id: string;
    name: string;
    major?: string;
    graduation_year?: number;
    resume?: string;
    avatar?: string;
}

export default function ResumeList() {
    const [users, setUsers] = useState<ResumeUser[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<ResumeUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const usersPerPage = 10;

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    useEffect(() => {
        loadResumes();

        // Listen for filter changes
        const handleFilterChange = (event: CustomEvent) => {
            applyFilters(event.detail);
        };

        // Listen for search changes
        const handleSearchChange = (event: CustomEvent) => {
            applySearch(event.detail.searchQuery);
        };

        // Listen for refresh requests
        const handleRefresh = () => {
            loadResumes();
        };

        window.addEventListener('resumeFilterChange', handleFilterChange as EventListener);
        window.addEventListener('resumeSearchChange', handleSearchChange as EventListener);
        window.addEventListener('resumeDatabaseRefresh', handleRefresh);

        return () => {
            window.removeEventListener('resumeFilterChange', handleFilterChange as EventListener);
            window.removeEventListener('resumeSearchChange', handleSearchChange as EventListener);
            window.removeEventListener('resumeDatabaseRefresh', handleRefresh);
        };
    }, []);

    const loadResumes = async () => {
        try {
            setLoading(true);

            // Get all users with resumes
            const filter = "resume != null && resume != ''";
            const users = await get.getAll<User>(Collections.USERS, filter);

            // Map to our simplified format
            const resumeUsers = users
                .filter(user => user.resume) // Ensure resume exists
                .map(user => ({
                    id: user.id,
                    name: user.name,
                    major: user.major,
                    graduation_year: user.graduation_year,
                    resume: user.resume,
                    avatar: user.avatar
                }));

            setUsers(resumeUsers);
            setFilteredUsers(resumeUsers);
            setCurrentPage(1);
        } catch (err) {
            console.error('Error loading resumes:', err);
            setError('Failed to load resume data');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = (filters: any) => {
        let filtered = [...users];

        // Apply major filter
        if (filters.major && filters.major !== 'all') {
            filtered = filtered.filter(user => {
                if (!user.major) return false;
                return user.major.toLowerCase().includes(filters.major.toLowerCase());
            });
        }

        // Apply graduation year filter
        if (filters.graduationYear && filters.graduationYear !== 'all') {
            const year = parseInt(filters.graduationYear);
            filtered = filtered.filter(user => user.graduation_year === year);
        }

        setFilteredUsers(filtered);
        setCurrentPage(1);
    };

    const applySearch = (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setFilteredUsers(users);
            setCurrentPage(1);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = users.filter(user =>
            user.name.toLowerCase().includes(query) ||
            (user.major && user.major.toLowerCase().includes(query))
        );

        setFilteredUsers(filtered);
        setCurrentPage(1);
    };

    const handleResumeClick = (userId: string) => {
        // Dispatch event to notify parent component
        window.dispatchEvent(
            new CustomEvent('resumeSelected', {
                detail: { resumeId: userId }
            })
        );
    };

    // Get current users for pagination
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-error">
                <div className="flex-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <label>{error}</label>
                </div>
            </div>
        );
    }

    if (filteredUsers.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-base-content/70">No resumes found matching your criteria</p>
            </div>
        );
    }

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="table w-full">
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Major</th>
                            <th>Graduation Year</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentUsers.map(user => (
                            <tr key={user.id} className="hover">
                                <td>
                                    <div className="flex items-center space-x-3">
                                        <div className="avatar">
                                            <div className="mask mask-squircle w-12 h-12">
                                                {user.avatar ? (
                                                    <img src={user.avatar} alt={user.name} />
                                                ) : (
                                                    <div className="bg-primary text-primary-content flex items-center justify-center w-full h-full">
                                                        <span className="text-lg font-bold">{user.name.charAt(0)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="font-bold">{user.name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>{user.major || 'Not specified'}</td>
                                <td>{user.graduation_year || 'Not specified'}</td>
                                <td>
                                    <button
                                        className="btn btn-sm btn-primary"
                                        onClick={() => handleResumeClick(user.id)}
                                    >
                                        View Resume
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <div className="btn-group">
                        <button
                            className="btn btn-sm"
                            onClick={() => paginate(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                        >
                            «
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => (
                            <button
                                key={i + 1}
                                className={`btn btn-sm ${currentPage === i + 1 ? 'btn-active' : ''}`}
                                onClick={() => paginate(i + 1)}
                            >
                                {i + 1}
                            </button>
                        ))}

                        <button
                            className="btn btn-sm"
                            onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                        >
                            »
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}