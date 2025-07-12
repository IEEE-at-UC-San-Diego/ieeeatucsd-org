import { useState, useEffect } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { Event, EventAttendee, User } from '../../../schemas/pocketbase/schema';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

// Import Chart.js
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    RadialLinearScale,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    RadialLinearScale,
    Title,
    Tooltip,
    Legend
);

export default function EventEngagementMetrics() {
    const [chartData, setChartData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<number | string>(30); // Default to 30 days

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    useEffect(() => {
        // Listen for analytics data updates from the parent component
        const handleAnalyticsUpdate = (event: CustomEvent) => {
            const { events, attendees, timeRange } = event.detail;
            setTimeRange(timeRange);
            loadUserData(events, attendees);
        };

        window.addEventListener('analyticsDataUpdated', handleAnalyticsUpdate as EventListener);

        // Initial data load
        loadData();

        return () => {
            window.removeEventListener('analyticsDataUpdated', handleAnalyticsUpdate as EventListener);
        };
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Calculate date range
            const endDate = new Date();
            let startDate;

            if (timeRange === "all") {
                startDate = new Date(0); // Beginning of time
            } else {
                startDate = new Date();
                startDate.setDate(startDate.getDate() - (typeof timeRange === 'number' ? timeRange : 30));
            }

            // Format dates for filter
            const startDateStr = startDate.toISOString();
            const endDateStr = endDate.toISOString();

            // Build filter
            const filter = timeRange === "all"
                ? "published = true"
                : `published = true && start_date >= "${startDateStr}" && start_date <= "${endDateStr}"`;

            // Get events
            const events = await get.getAll<Event>(Collections.EVENTS, filter);

            // Get event attendees
            const attendeesFilter = timeRange === "all"
                ? ""
                : `time_checked_in >= "${startDateStr}" && time_checked_in <= "${endDateStr}"`;

            const attendees = await get.getAll<EventAttendee>(Collections.EVENT_ATTENDEES, attendeesFilter);

            await loadUserData(events, attendees);
        } catch (err) {
            console.error('Error loading engagement metrics data:', err);
            setError('Failed to load engagement metrics data');
        } finally {
            setLoading(false);
        }
    };

    const loadUserData = async (events: Event[], attendees: EventAttendee[]) => {
        try {
            if (!events || events.length === 0 || !attendees || attendees.length === 0) {
                setChartData(null);
                return;
            }

            // Get unique user IDs from attendees
            const userIds = [...new Set(attendees.map(a => a.user))];

            // Fetch user data to get graduation years
            const users = await get.getMany<User>(Collections.USERS, userIds);

            processChartData(events, attendees, users);
        } catch (err) {
            console.error('Error loading user data:', err);
            setError('Failed to load user data');
        }
    };

    const processChartData = (events: Event[], attendees: EventAttendee[], users: User[]) => {
        if (!events || events.length === 0 || !attendees || attendees.length === 0) {
            setChartData(null);
            return;
        }

        // Create a map of user IDs to graduation years
        const userGradYearMap = new Map<string, number>();
        users.forEach(user => {
            if (user.graduation_year) {
                userGradYearMap.set(user.id, user.graduation_year);
            }
        });

        // Calculate metrics

        // 1. Attendance by time of day
        const timeOfDayAttendance = {
            'Morning (8am-12pm)': 0,
            'Afternoon (12pm-5pm)': 0,
            'Evening (5pm-9pm)': 0,
            'Night (9pm-8am)': 0,
        };

        events.forEach(event => {
            const startDate = new Date(event.start_date);
            const hour = startDate.getHours();

            // Count the event in the appropriate time slot
            if (hour >= 8 && hour < 12) {
                timeOfDayAttendance['Morning (8am-12pm)']++;
            } else if (hour >= 12 && hour < 17) {
                timeOfDayAttendance['Afternoon (12pm-5pm)']++;
            } else if (hour >= 17 && hour < 21) {
                timeOfDayAttendance['Evening (5pm-9pm)']++;
            } else {
                timeOfDayAttendance['Night (9pm-8am)']++;
            }
        });

        // 2. Attendance by day of week
        const dayOfWeekAttendance = {
            'Sunday': 0,
            'Monday': 0,
            'Tuesday': 0,
            'Wednesday': 0,
            'Thursday': 0,
            'Friday': 0,
            'Saturday': 0,
        };

        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        events.forEach(event => {
            const startDate = new Date(event.start_date);
            const dayOfWeek = daysOfWeek[startDate.getDay()];
            // Use type assertion to avoid TypeScript error
            (dayOfWeekAttendance as Record<string, number>)[dayOfWeek]++;
        });

        // 3. Attendance by graduation year
        const gradYearAttendance: Record<string, number> = {};
        attendees.forEach(attendee => {
            const userId = attendee.user;
            const gradYear = userGradYearMap.get(userId);

            if (gradYear) {
                const gradYearStr = gradYear.toString();
                if (!gradYearAttendance[gradYearStr]) {
                    gradYearAttendance[gradYearStr] = 0;
                }
                gradYearAttendance[gradYearStr]++;
            }
        });

        // 4. Food vs. No Food events
        const foodEvents = events.filter(event => event.has_food).length;
        const noFoodEvents = events.length - foodEvents;

        // 5. Average attendance per event
        const attendanceByEvent = new Map<string, number>();
        attendees.forEach(attendee => {
            if (!attendanceByEvent.has(attendee.event)) {
                attendanceByEvent.set(attendee.event, 0);
            }
            attendanceByEvent.set(attendee.event, attendanceByEvent.get(attendee.event)! + 1);
        });

        const avgAttendance = events.length > 0
            ? Math.round(attendees.length / events.length)
            : 0;

        // Prepare radar chart data
        // Normalize all metrics to a 0-100 scale for the radar chart
        const maxTimeOfDay = Math.max(...Object.values(timeOfDayAttendance));
        const maxDayOfWeek = Math.max(...Object.values(dayOfWeekAttendance));
        const foodRatio = events.length > 0 ? (foodEvents / events.length) * 100 : 0;

        // Calculate repeat attendance rate (% of users who attended more than one event)
        const userAttendanceCounts = new Map<string, number>();
        attendees.forEach(attendee => {
            if (!userAttendanceCounts.has(attendee.user)) {
                userAttendanceCounts.set(attendee.user, 0);
            }
            userAttendanceCounts.set(attendee.user, userAttendanceCounts.get(attendee.user)! + 1);
        });

        const repeatAttendees = [...userAttendanceCounts.values()].filter(count => count > 1).length;
        const repeatRate = userAttendanceCounts.size > 0
            ? (repeatAttendees / userAttendanceCounts.size) * 100
            : 0;

        // Normalize metrics for radar chart (0-100 scale)
        const normalizeValue = (value: number, max: number) => max > 0 ? (value / max) * 100 : 0;

        const radarData = {
            labels: [
                'Morning Events',
                'Afternoon Events',
                'Evening Events',
                'Weekday Events',
                'Weekend Events',
                'Food Events',
                'Repeat Attendance'
            ],
            datasets: [
                {
                    label: 'Engagement Metrics',
                    data: [
                        normalizeValue(timeOfDayAttendance['Morning (8am-12pm)'], maxTimeOfDay),
                        normalizeValue(timeOfDayAttendance['Afternoon (12pm-5pm)'], maxTimeOfDay),
                        normalizeValue(timeOfDayAttendance['Evening (5pm-9pm)'], maxTimeOfDay),
                        normalizeValue(
                            dayOfWeekAttendance['Monday'] +
                            dayOfWeekAttendance['Tuesday'] +
                            dayOfWeekAttendance['Wednesday'] +
                            dayOfWeekAttendance['Thursday'] +
                            dayOfWeekAttendance['Friday'],
                            maxDayOfWeek * 5
                        ),
                        normalizeValue(
                            dayOfWeekAttendance['Saturday'] +
                            dayOfWeekAttendance['Sunday'],
                            maxDayOfWeek * 2
                        ),
                        foodRatio,
                        repeatRate
                    ],
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(54, 162, 235, 1)',
                }
            ]
        };

        setChartData(radarData);
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        return `${context.label}: ${Math.round(context.raw)}%`;
                    }
                }
            }
        },
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="text-error">{error}</div>
            </div>
        );
    }

    if (!chartData) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="text-center text-base-content/70">
                    <p>No event data available for the selected time period</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full">
            <Radar data={chartData} options={chartOptions} />
        </div>
    );
}