import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Crown, TrendingUp, Users, Star } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../../firebase/client';
import DashboardHeader from '../../shared/DashboardHeader';
import { PublicProfileService, type PublicProfile } from '../../shared/services/publicProfile';
import { LeaderboardTableSkeleton, MetricCardSkeleton, CardSkeleton } from '../../../ui/loading';

interface LeaderboardUser {
    id: string;
    name: string;
    points: number;
    major?: string;
    graduationYear?: number;
    eventsAttended: number;
    position: string;
    rank: number;
}

export default function LeaderboardContent() {
    const [user] = useAuthState(auth);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardUser[]>([]);
    const [currentUserRank, setCurrentUserRank] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debugInfo, setDebugInfo] = useState<string>('');

    useEffect(() => {
        // Set up real-time listener for public profiles leaderboard
        console.log('Setting up leaderboard listener...');

        try {
            const publicProfilesQuery = query(
                collection(db, 'public_profiles'),
                orderBy('points', 'desc')
            );

            const unsubscribe = onSnapshot(publicProfilesQuery, (snapshot) => {
                console.log('Leaderboard snapshot received:', snapshot.size, 'documents');
                setDebugInfo(`Found ${snapshot.size} documents in public_profiles collection`);

                const users = snapshot.docs.map((doc, index) => {
                    const data = doc.data();
                    console.log('Profile data:', doc.id, data);

                    return {
                        id: doc.id,
                        name: data.name || 'Unknown User',
                        points: data.points || 0,
                        major: data.major || '',
                        graduationYear: data.graduationYear || null,
                        eventsAttended: data.eventsAttended || 0,
                        position: data.position || 'Member',
                        rank: index + 1
                    };
                }) as LeaderboardUser[];

                console.log('Processed leaderboard users:', users.length, users);

                // Only filter out users with invalid names, but keep users with 0 points
                const validUsers = users.filter(u => u.name && u.name !== 'Unknown User' && u.name.trim() !== '');

                console.log('Valid users after filtering:', validUsers.length, validUsers);
                setDebugInfo(prev => `${prev}. After filtering: ${validUsers.length} valid users`);

                setLeaderboardData(validUsers);

                // Find current user's rank
                if (user) {
                    const currentUser = validUsers.find(u => u.id === user.uid);
                    setCurrentUserRank(currentUser?.rank || 0);
                    console.log('Current user rank:', currentUser?.rank || 0);
                }

                setLoading(false);
            }, (error) => {
                console.error('Error in leaderboard listener:', error);
                setLoading(false);
                // Don't clear data on error, keep showing what we have
            });

            return () => {
                console.log('Cleaning up leaderboard listener');
                unsubscribe();
            };
        } catch (error) {
            console.error('Error setting up leaderboard listener:', error);
            setLoading(false);
        }
    }, [user]);

    const filteredData = leaderboardData.filter(userData => {
        try {
            const searchLower = searchTerm.toLowerCase();
            return (userData.name && userData.name.toLowerCase().includes(searchLower)) ||
                (userData.major && userData.major.toLowerCase().includes(searchLower));
        } catch (error) {
            console.error('Error filtering leaderboard data:', error, userData);
            return true; // Include the item if there's an error to avoid blank pages
        }
    });

    const topThree = filteredData.slice(0, 3);
    const restOfLeaderboard = filteredData.slice(3);

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown className="w-6 h-6 text-yellow-500" />;
            case 2:
                return <Medal className="w-6 h-6 text-gray-400" />;
            case 3:
                return <Award className="w-6 h-6 text-amber-600" />;
            default:
                return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
        }
    };

    const getPodiumHeight = (rank: number) => {
        switch (rank) {
            case 1:
                return 'h-32';
            case 2:
                return 'h-24';
            case 3:
                return 'h-20';
            default:
                return 'h-16';
        }
    };

    const getPodiumColor = (rank: number) => {
        switch (rank) {
            case 1:
                return 'bg-gradient-to-t from-yellow-400 to-yellow-300';
            case 2:
                return 'bg-gradient-to-t from-gray-400 to-gray-300';
            case 3:
                return 'bg-gradient-to-t from-amber-600 to-amber-500';
            default:
                return 'bg-gray-200';
        }
    };

    const getTotalStats = () => {
        const totalUsers = leaderboardData.length;
        const totalPoints = leaderboardData.reduce((sum, user) => sum + user.points, 0);
        const avgPoints = totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0;
        const topPerformer = leaderboardData[0];

        return { totalUsers, totalPoints, avgPoints, topPerformer };
    };

    const stats = getTotalStats();

    return (
        <div className="flex-1 overflow-auto">
            <DashboardHeader
                title="Leaderboard"
                subtitle="See how you rank among IEEE UCSD members"
                searchPlaceholder="Search members..."
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
            />

            <main className="p-4 md:p-6">
                {/* Debug Info */}
                {debugInfo && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 md:mb-6">
                        <p className="text-sm text-blue-800">
                            <strong>Debug:</strong> {debugInfo}
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:gap-6">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        {loading ? (
                            <>
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                            </>
                        ) : (
                            <>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-600">Total Members</p>
                                            <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-600">Total Points</p>
                                            <p className="text-xl md:text-2xl font-bold text-gray-900">{stats.totalPoints.toLocaleString()}</p>
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">Average Points</p>
                                            <p className="text-2xl font-bold text-gray-900">{stats.avgPoints}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                            <TrendingUp className="w-6 h-6 text-green-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">Your Rank</p>
                                            <p className="text-2xl font-bold text-gray-900">#{currentUserRank || 'N/A'}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                            <Trophy className="w-6 h-6 text-purple-600" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Podium - Top 3 */}
                    {loading ? (
                        <CardSkeleton variant="content" size="lg" className="h-64" />
                    ) : topThree.length >= 3 && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">🏆 Top Performers 🏆</h2>
                            <div className="flex justify-center items-end space-x-4 mb-6">
                                {/* Second Place */}
                                {topThree[1] && (
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-2">
                                            <Medal className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="font-medium text-gray-900 text-sm text-center">{topThree[1].name.split(' ')[0]}</p>
                                        <p className="text-xs text-gray-500 mb-2">{topThree[1].points} pts</p>
                                        <div className={`w-20 ${getPodiumHeight(2)} ${getPodiumColor(2)} rounded-t-lg flex items-end justify-center pb-2`}>
                                            <span className="text-white font-bold text-lg">2</span>
                                        </div>
                                    </div>
                                )}

                                {/* First Place */}
                                {topThree[0] && (
                                    <div className="flex flex-col items-center">
                                        <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-2 relative">
                                            <Crown className="w-10 h-10 text-yellow-500" />
                                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                                                <span className="text-xs font-bold text-white">👑</span>
                                            </div>
                                        </div>
                                        <p className="font-bold text-gray-900 text-base text-center">{topThree[0].name.split(' ')[0]}</p>
                                        <p className="text-sm text-yellow-600 font-medium mb-2">{topThree[0].points} pts</p>
                                        <div className={`w-24 ${getPodiumHeight(1)} ${getPodiumColor(1)} rounded-t-lg flex items-end justify-center pb-2`}>
                                            <span className="text-white font-bold text-xl">1</span>
                                        </div>
                                    </div>
                                )}

                                {/* Third Place */}
                                {topThree[2] && (
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-2">
                                            <Award className="w-8 h-8 text-amber-600" />
                                        </div>
                                        <p className="font-medium text-gray-900 text-sm text-center">{topThree[2].name.split(' ')[0]}</p>
                                        <p className="text-xs text-gray-500 mb-2">{topThree[2].points} pts</p>
                                        <div className={`w-20 ${getPodiumHeight(3)} ${getPodiumColor(3)} rounded-t-lg flex items-end justify-center pb-2`}>
                                            <span className="text-white font-bold text-lg">3</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Full Leaderboard */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">Full Leaderboard</h2>
                        </div>
                        <div className="overflow-x-auto">
                            {loading ? (
                                <LeaderboardTableSkeleton rows={10} />
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Rank
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Member
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Points
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Major
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Graduation Year
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Events
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Position
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredData.map((member) => (
                                            <tr
                                                key={member.id}
                                                className={`hover:bg-gray-50 ${member.id === user?.uid ? 'bg-blue-50' : ''}`}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        {getRankIcon(member.rank)}
                                                        {member.rank <= 3 && (
                                                            <span className="ml-2 text-xs font-medium text-gray-500">
                                                                {member.rank === 1 ? 'Champion' : member.rank === 2 ? 'Runner-up' : 'Third Place'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                            <span className="text-blue-600 font-medium text-sm">
                                                                {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                            </span>
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {member.name}
                                                                {member.id === user?.uid && (
                                                                    <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                                                        You
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-gray-500">{member.major || member.position}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900">{member.points}</div>
                                                    <div className="text-xs text-gray-500">points</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{member.major || 'N/A'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{member.graduationYear || 'N/A'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{member.eventsAttended || 0}</div>
                                                    <div className="text-xs text-gray-500">events</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                                        {member.position || 'Member'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 