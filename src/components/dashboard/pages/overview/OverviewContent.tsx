import React, { useState, useEffect } from 'react';
import { Calendar, CreditCard, Users, Award, TrendingUp, Clock, CheckCircle, DollarSign, Plus, Eye, BarChart3 } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../../firebase/client';
import DashboardHeader from '../../shared/DashboardHeader';
import type { User as UserType } from '../../shared/types/firestore';
import { MetricCardSkeleton, EventCardSkeleton, ListSkeleton, EventListSkeleton } from '../../../ui/loading';

interface UserStats {
    totalPoints: number;
    eventsAttended: number;
    reimbursementsSubmitted: number;
    reimbursementsApproved: number;
    lastEventAttended: string;
    rank: number;
    totalMembers: number;
}

interface RecentActivity {
    id: string;
    type: 'event' | 'reimbursement' | 'achievement';
    title: string;
    description: string;
    date: any;
    points?: number;
}

export default function OverviewContent() {
    const [user] = useAuthState(auth);
    const [userData, setUserData] = useState<UserType | null>(null);
    const [userStats, setUserStats] = useState<UserStats>({
        totalPoints: 0,
        eventsAttended: 0,
        reimbursementsSubmitted: 0,
        reimbursementsApproved: 0,
        lastEventAttended: 'None',
        rank: 0,
        totalMembers: 0
    });
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        // Fetch user data
        const fetchUserData = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data() as UserType;
                    setUserData(data);
                    setUserStats(prev => ({
                        ...prev,
                        totalPoints: data.points || 0,
                        eventsAttended: data.eventsAttended || 0
                    }));
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        fetchUserData();

        // Set up real-time listener for leaderboard ranking with delay to ensure auth is ready
        const timeoutId = setTimeout(() => {
            if (!user?.uid) return;

            console.log('Setting up ranking listener for user:', user.uid);

            const publicProfilesQuery = query(
                collection(db, 'public_profiles'),
                orderBy('points', 'desc')
            );

            const unsubscribeRanking = onSnapshot(publicProfilesQuery, (snapshot) => {
                console.log('Ranking snapshot received:', snapshot.size, 'documents');
                const profiles = snapshot.docs.map((doc, index) => ({
                    id: doc.id,
                    rank: index + 1,
                    name: doc.data().name,
                    points: doc.data().points || 0
                }));

                // Filter out users with invalid names
                const validProfiles = profiles.filter(p => p.name && p.name !== 'Unknown User' && p.name.trim() !== '');

                // Find current user's rank
                const currentUserProfile = validProfiles.find(p => p.id === user.uid);
                const currentUserRank = currentUserProfile?.rank || 0;
                const totalMembers = validProfiles.length;

                setUserStats(prev => ({
                    ...prev,
                    rank: currentUserRank,
                    totalMembers: totalMembers
                }));
            }, (error) => {
                console.error('Error in ranking listener:', error);
                // Don't break the component if ranking fails
                setUserStats(prev => ({
                    ...prev,
                    rank: 0,
                    totalMembers: 0
                }));
            });

            // Store the unsubscribe function to clean up later
            (window as any).__rankingUnsubscribe = unsubscribeRanking;
        }, 1000); // 1 second delay to ensure auth is fully ready

        return () => {
            clearTimeout(timeoutId);
            if ((window as any).__rankingUnsubscribe) {
                (window as any).__rankingUnsubscribe();
                delete (window as any).__rankingUnsubscribe;
            }
        };
    }, [user, db]);

    useEffect(() => {
        if (!user) return;

        // Fetch upcoming events
        const eventsQuery = query(
            collection(db, 'events'),
            where('published', '==', true),
            orderBy('startDate', 'asc'),
            limit(3)
        );

        const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter for upcoming events
            const now = new Date();
            const upcoming = events.filter((event: any) => {
                const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                return startDate > now;
            });

            setUpcomingEvents(upcoming);
        });

        // Fetch reimbursements for stats
        const reimbursementsQuery = query(
            collection(db, 'reimbursements'),
            where('submittedBy', '==', user.uid),
            orderBy('submittedAt', 'desc')
        );

        const unsubscribeReimbursements = onSnapshot(reimbursementsQuery, (snapshot) => {
            const reimbursements = snapshot.docs.map(doc => doc.data());
            const submitted = reimbursements.length;
            const approved = reimbursements.filter((r: any) => r.status === 'approved' || r.status === 'paid').length;

            setUserStats(prev => ({
                ...prev,
                reimbursementsSubmitted: submitted,
                reimbursementsApproved: approved
            }));

            // Create recent activity from reimbursements
            const reimbursementActivity: RecentActivity[] = reimbursements.slice(0, 3).map((r: any, index) => ({
                id: `reimbursement-${index}`,
                type: 'reimbursement' as const,
                title: `Reimbursement ${r.status === 'approved' ? 'Approved' : r.status === 'paid' ? 'Paid' : 'Submitted'}`,
                description: r.title || 'Reimbursement request',
                date: r.submittedAt,
                points: r.status === 'paid' ? 10 : 0
            }));

            setRecentActivity(reimbursementActivity);
        });

        setLoading(false);

        return () => {
            unsubscribeEvents();
            unsubscribeReimbursements();
        };
    }, [user, db]);

    const quickActions = [
        {
            title: 'Submit Reimbursement',
            description: 'Request reimbursement for expenses',
            icon: CreditCard,
            href: '/dashboard/reimbursement',
            color: 'bg-green-100 text-green-600'
        },
        {
            title: 'View Events',
            description: 'Check in to upcoming events',
            icon: Calendar,
            href: '/dashboard/events',
            color: 'bg-blue-100 text-blue-600'
        },
        {
            title: 'View Leaderboard',
            description: 'See your ranking and points',
            icon: Award,
            href: '/dashboard/leaderboard',
            color: 'bg-yellow-100 text-yellow-600'
        },
        {
            title: 'Update Profile',
            description: 'Manage your account settings',
            icon: Users,
            href: '/dashboard/settings',
            color: 'bg-purple-100 text-purple-600'
        }
    ];

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="flex-1 overflow-auto">
            <DashboardHeader
                title="Overview"
                subtitle={`${getGreeting()}, ${userData?.name || 'Member'}! Here's your IEEE UCSD activity summary.`}
                showSearch={false}
            />

            <main className="p-4 md:p-6">
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                    {/* Welcome Banner */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-4 md:p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg md:text-2xl font-bold mb-2">Welcome back, {userData?.name?.split(' ')[0] || 'Member'}!</h2>
                                <p className="text-sm md:text-base text-blue-100">You have {userStats.totalPoints} points and have attended {userStats.eventsAttended} events.</p>
                            </div>
                            <div className="hidden md:block ml-4">
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-full flex items-center justify-center">
                                    <Award className="w-8 h-8 md:w-10 md:h-10 text-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
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
                                            <p className="text-sm font-medium text-gray-600">Total Points</p>
                                            <p className="text-xl md:text-2xl font-bold text-gray-900">{userStats.totalPoints}</p>
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                            <Award className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-600">Events Attended</p>
                                            <p className="text-xl md:text-2xl font-bold text-gray-900">{userStats.eventsAttended}</p>
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-600">Reimbursements</p>
                                            <p className="text-xl md:text-2xl font-bold text-gray-900">{userStats.reimbursementsSubmitted}</p>
                                            <p className="text-xs text-gray-500">{userStats.reimbursementsApproved} approved</p>
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center">
                                            <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-600">Member Rank</p>
                                            <p className="text-xl md:text-2xl font-bold text-gray-900">#{userStats.rank || 'N/A'}</p>
                                            <p className="text-xs text-gray-500">of {userStats.totalMembers} members</p>
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                            <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                        <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            {quickActions.map((action, index) => (
                                <a
                                    key={index}
                                    href={action.href}
                                    className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors min-h-[60px] touch-manipulation"
                                >
                                    <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                        <action.icon className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 text-sm md:text-base">{action.title}</p>
                                        <p className="text-xs md:text-sm text-gray-500 truncate">{action.description}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Two Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        {/* Upcoming Events */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base md:text-lg font-semibold text-gray-900">Upcoming Events</h2>
                                <a href="/dashboard/events" className="text-sm text-blue-600 hover:text-blue-800 min-h-[44px] flex items-center">
                                    View all →
                                </a>
                            </div>
                            {loading ? (
                                <EventListSkeleton items={3} />
                            ) : upcomingEvents.length === 0 ? (
                                <div className="text-center py-6 md:py-8">
                                    <Calendar className="mx-auto h-10 w-10 md:h-12 md:w-12 text-gray-400 mb-3 md:mb-4" />
                                    <p className="text-sm md:text-base text-gray-500">No upcoming events</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {upcomingEvents.slice(0, 3).map((event: any) => (
                                        <div key={event.id} className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Calendar className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 text-sm md:text-base truncate">{event.eventName}</p>
                                                <p className="text-xs md:text-sm text-gray-500">
                                                    {event.startDate?.toDate ? event.startDate.toDate().toLocaleDateString() : 'TBD'}
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <p className="text-xs md:text-sm text-green-600 font-medium">+{event.pointsToReward || 0} pts</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                            <h2 className="text-base md:text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
                            {loading ? (
                                <ListSkeleton items={3} variant="detailed" showIcon={true} showMetadata={true} />
                            ) : recentActivity.length === 0 ? (
                                <div className="text-center py-6 md:py-8">
                                    <Clock className="mx-auto h-10 w-10 md:h-12 md:w-12 text-gray-400 mb-3 md:mb-4" />
                                    <p className="text-sm md:text-base text-gray-500">No recent activity</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex items-center space-x-3 p-3 border border-gray-100 rounded-lg">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${activity.type === 'event' ? 'bg-blue-100' :
                                                activity.type === 'reimbursement' ? 'bg-green-100' :
                                                    'bg-yellow-100'
                                                }`}>
                                                {activity.type === 'event' && <Calendar className="w-4 h-4 text-blue-600" />}
                                                {activity.type === 'reimbursement' && <DollarSign className="w-4 h-4 text-green-600" />}
                                                {activity.type === 'achievement' && <Award className="w-4 h-4 text-yellow-600" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-gray-900 text-sm md:text-base truncate">{activity.title}</p>
                                                <p className="text-xs md:text-sm text-gray-500 truncate">{activity.description}</p>
                                                <p className="text-xs text-gray-400">
                                                    {activity.date?.toDate ? activity.date.toDate().toLocaleDateString() : 'Recently'}
                                                </p>
                                            </div>
                                            {activity.points && (
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-xs md:text-sm text-green-600 font-medium">+{activity.points} pts</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 