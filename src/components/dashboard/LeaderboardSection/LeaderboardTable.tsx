import { useState, useEffect } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import type { User } from '../../../schemas/pocketbase/schema';

interface LeaderboardUser {
    id: string;
    name: string;
    points: number;
    avatar?: string;
    major?: string;
}

// Trophy icon SVG for the rankings
const TrophyIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 00-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 00.75-.75 2.25 2.25 0 00-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 01-1.112-3.173 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 013.16 5.337a45.6 45.6 0 012.006-.343v.256zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 01-2.863 3.207 6.72 6.72 0 00.857-3.294z" clipRule="evenodd" />
    </svg>
);

export default function LeaderboardTable() {
    const [users, setUsers] = useState<LeaderboardUser[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const usersPerPage = 10;

    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    // Set the current user ID once on component mount
    useEffect(() => {
        try {
            // Use the Authentication class directly
            const isLoggedIn = auth.isAuthenticated();
            setIsAuthenticated(isLoggedIn);

            if (isLoggedIn) {
                const user = auth.getCurrentUser();
                if (user && user.id) {
                    setCurrentUserId(user.id);
                } else {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        } catch (err) {
            console.error('Error checking authentication:', err);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                setLoading(true);

                // Fetch users without sorting - we'll sort on client side
                const response = await get.getList('limitedUser', 1, 100, '', '', {
                    fields: ['id', 'name', 'points', 'avatar', 'major']
                });

                // First get the current user separately so we can include them even if they have 0 points
                let currentUserData = null;
                if (isAuthenticated && currentUserId) {
                    currentUserData = response.items.find((user: Partial<User>) => user.id === currentUserId);
                }

                // Filter and map to our leaderboard user format, and sort client-side
                let leaderboardUsers = response.items
                    .filter((user: Partial<User>) => user.points !== undefined && user.points !== null && user.points > 0)
                    .sort((a: Partial<User>, b: Partial<User>) => (b.points || 0) - (a.points || 0))
                    .map((user: Partial<User>, index: number) => {
                        // Check if this is the current user
                        if (isAuthenticated && user.id === currentUserId) {
                            setCurrentUserRank(index + 1);
                        }

                        return {
                            id: user.id || '',
                            name: user.name || 'Anonymous User',
                            points: user.points || 0,
                            avatar: user.avatar,
                            major: user.major
                        };
                    });

                // Include current user even if they have 0 points,
                // but don't include in ranking if they have no points
                if (isAuthenticated && currentUserData &&
                    !leaderboardUsers.some(user => user.id === currentUserId)) {
                    // User isn't already in the list (has 0 points)
                    leaderboardUsers.push({
                        id: currentUserData.id || '',
                        name: currentUserData.name || 'Anonymous User',
                        points: currentUserData.points || 0,
                        avatar: currentUserData.avatar,
                        major: currentUserData.major
                    });
                }

                setUsers(leaderboardUsers);
                setFilteredUsers(leaderboardUsers);
            } catch (err) {
                console.error('Error fetching leaderboard:', err);
                setError('Failed to load leaderboard data');
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [isAuthenticated, currentUserId]);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredUsers(users);
            setCurrentPage(1);
            return;
        }

        const filtered = users.filter(user =>
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (user.major && user.major.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        setFilteredUsers(filtered);
        setCurrentPage(1);
    }, [searchQuery, users]);

    // Get current users for pagination
    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                    <span className="text-red-800 dark:text-red-200">{error}</span>
                </div>
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-gray-600 dark:text-gray-300">No users with points found</p>
            </div>
        );
    }

    return (
        <div>
            {/* Search bar */}
            <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
                <input
                    type="text"
                    placeholder="Search by name or major..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg 
                    bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 focus:outline-none 
                    focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {/* Leaderboard table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50/80 dark:bg-gray-800/80">
                        <tr>
                            <th scope="col" className="w-16 px-6 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                Rank
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                User
                            </th>
                            <th scope="col" className="w-24 px-6 py-3 text-center text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                                Points
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white/90 dark:bg-gray-900/90 divide-y divide-gray-200 dark:divide-gray-800">
                        {currentUsers.map((user, index) => {
                            const actualRank = user.points > 0 ? indexOfFirstUser + index + 1 : null;
                            const isCurrentUser = user.id === currentUserId;

                            return (
                                <tr key={user.id} className={isCurrentUser ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {actualRank ? (
                                            actualRank <= 3 ? (
                                                <span className="inline-flex items-center justify-center w-8 h-8">
                                                    {actualRank === 1 && <TrophyIcon className="text-yellow-500 w-6 h-6" />}
                                                    {actualRank === 2 && <TrophyIcon className="text-gray-400 w-6 h-6" />}
                                                    {actualRank === 3 && <TrophyIcon className="text-amber-700 w-6 h-6" />}
                                                </span>
                                            ) : (
                                                <span className="font-medium text-gray-800 dark:text-gray-100">{actualRank}</span>
                                            )
                                        ) : (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">Not Ranked</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden relative">
                                                    {user.avatar ? (
                                                        <img className="h-10 w-10 rounded-full" src={user.avatar} alt={user.name} />
                                                    ) : (
                                                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-700 dark:text-gray-300">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                                    {user.name}
                                                </div>
                                                {user.major && (
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {user.major}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-indigo-600 dark:text-indigo-400">
                                        {user.points}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                    <nav className="flex items-center">
                        <button
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-700 
                            bg-white/90 dark:bg-gray-800/90 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => paginate(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                        >
                            <span className="sr-only">Previous</span>
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => (
                            <button
                                key={i + 1}
                                className={`relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 
                                bg-white/90 dark:bg-gray-800/90 text-sm font-medium ${currentPage === i + 1
                                        ? 'text-indigo-600 dark:text-indigo-400 border-indigo-500 dark:border-indigo-500 z-10'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                onClick={() => paginate(i + 1)}
                            >
                                {i + 1}
                            </button>
                        ))}

                        <button
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-700 
                            bg-white/90 dark:bg-gray-800/90 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => paginate(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <span className="sr-only">Next</span>
                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </nav>
                </div>
            )}

            {/* Show current user rank if not in current page */}
            {isAuthenticated && currentUserRank && !currentUsers.some(user => user.id === currentUserId) && (
                <div className="mt-4 p-3 bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-center text-sm text-gray-700 dark:text-gray-300">
                        Your rank: <span className="font-bold text-indigo-600 dark:text-indigo-400">#{currentUserRank}</span>
                    </p>
                </div>
            )}

            {/* Current user with 0 points */}
            {isAuthenticated && currentUserId &&
                !currentUserRank &&
                currentUsers.some(user => user.id === currentUserId) && (
                    <div className="mt-4 p-3 bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <p className="text-center text-sm text-gray-700 dark:text-gray-300">
                            Participate in events to earn points and get ranked!
                        </p>
                    </div>
                )}
        </div>
    );
} 