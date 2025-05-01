import { useState, useEffect } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { LimitedUser } from '../../../schemas/pocketbase/schema';

interface LeaderboardStats {
    totalUsers: number;
    totalPoints: number;
    topScore: number;
    yourPoints: number;
    yourRank: number | null;
}

export default function LeaderboardStats() {
    const [stats, setStats] = useState<LeaderboardStats>({
        totalUsers: 0,
        totalPoints: 0,
        topScore: 0,
        yourPoints: 0,
        yourRank: null
    });
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
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
        const fetchStats = async () => {
            try {
                setLoading(true);

                // Get all users without sorting - we'll sort on client side
                const response = await get.getList(Collections.LIMITED_USERS, 1, 500, '', '', {
                    fields: ['id', 'name', 'points']
                });

                // Parse points from JSON string and convert to number
                const processedUsers = response.items.map((user: Partial<LimitedUser>) => {
                    let pointsValue = 0;
                    try {
                        if (user.points) {
                            // Parse the JSON string to get the points value
                            const pointsData = JSON.parse(user.points);
                            pointsValue = typeof pointsData === 'number' ? pointsData : 0;
                        }
                    } catch (e) {
                        console.error('Error parsing points data:', e);
                    }

                    return {
                        id: user.id,
                        name: user.name,
                        parsedPoints: pointsValue
                    };
                });

                // Filter out users with no points for the leaderboard stats
                const leaderboardUsers = processedUsers
                    .filter(user => user.parsedPoints > 0)
                    // Sort by points descending
                    .sort((a, b) => b.parsedPoints - a.parsedPoints);

                const totalUsers = leaderboardUsers.length;
                const totalPoints = leaderboardUsers.reduce((sum: number, user) => sum + user.parsedPoints, 0);
                const topScore = leaderboardUsers.length > 0 ? leaderboardUsers[0].parsedPoints : 0;

                // Find current user's points and rank - BUT don't filter by points > 0 for the current user
                let yourPoints = 0;
                let yourRank = null;

                if (isAuthenticated && currentUserId) {
                    // Look for the current user in ALL processed users, not just those with points > 0
                    const currentUser = processedUsers.find(user => user.id === currentUserId);

                    if (currentUser) {
                        yourPoints = currentUser.parsedPoints || 0;

                        // Only calculate rank if user has points
                        if (yourPoints > 0) {
                            // Find user position in the sorted array
                            for (let i = 0; i < leaderboardUsers.length; i++) {
                                if (leaderboardUsers[i].id === currentUserId) {
                                    yourRank = i + 1;
                                    break;
                                }
                            }
                        }
                    }
                }

                setStats({
                    totalUsers,
                    totalPoints,
                    topScore,
                    yourPoints,
                    yourRank
                });
            } catch (err) {
                console.error('Error fetching leaderboard stats:', err);
                // Set fallback stats
                setStats({
                    totalUsers: 0,
                    totalPoints: 0,
                    topScore: 0,
                    yourPoints: 0,
                    yourRank: null
                });
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [get, isAuthenticated, currentUserId]);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 bg-gray-100/50 dark:bg-gray-800/50 animate-pulse rounded-xl">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2 mt-4 mx-4"></div>
                        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mx-4"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-6 bg-white/90 dark:bg-gray-800/90 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Members</div>
                <div className="mt-2 text-3xl font-bold text-gray-800 dark:text-white">{stats.totalUsers}</div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">In the leaderboard</div>
            </div>

            <div className="p-6 bg-white/90 dark:bg-gray-800/90 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Points</div>
                <div className="mt-2 text-3xl font-bold text-gray-800 dark:text-white">{stats.totalPoints}</div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Earned by all members</div>
            </div>

            <div className="p-6 bg-white/90 dark:bg-gray-800/90 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Top Score</div>
                <div className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">{stats.topScore}</div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Highest individual points</div>
            </div>

            <div className="p-6 bg-white/90 dark:bg-gray-800/90 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">Your Score</div>
                <div className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                    {isAuthenticated ? stats.yourPoints : '-'}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {isAuthenticated
                        ? (stats.yourRank ? `Ranked #${stats.yourRank}` : 'Not ranked yet')
                        : 'Log in to see your rank'
                    }
                </div>
            </div>
        </div>
    );
} 