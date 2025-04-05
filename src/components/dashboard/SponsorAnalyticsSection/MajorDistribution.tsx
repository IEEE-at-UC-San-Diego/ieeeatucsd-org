import { useState, useEffect } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { User, EventAttendee } from '../../../schemas/pocketbase/schema';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

// Import Chart.js
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// Define major categories and their colors
const MAJOR_CATEGORIES = [
    { name: 'Computer Science', color: 'rgba(54, 162, 235, 0.8)' },
    { name: 'Electrical Engineering', color: 'rgba(255, 99, 132, 0.8)' },
    { name: 'Computer Engineering', color: 'rgba(75, 192, 192, 0.8)' },
    { name: 'Mechanical Engineering', color: 'rgba(255, 206, 86, 0.8)' },
    { name: 'Data Science', color: 'rgba(153, 102, 255, 0.8)' },
    { name: 'Mathematics', color: 'rgba(255, 159, 64, 0.8)' },
    { name: 'Physics', color: 'rgba(201, 203, 207, 0.8)' },
    { name: 'Other Engineering', color: 'rgba(100, 149, 237, 0.8)' },
    { name: 'Other', color: 'rgba(169, 169, 169, 0.8)' },
];

export default function MajorDistribution() {
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
            loadUserData(attendees);
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

            // Get event attendees
            const attendeesFilter = timeRange === "all"
                ? ""
                : `time_checked_in >= "${startDateStr}" && time_checked_in <= "${endDateStr}"`;

            const attendees = await get.getAll<EventAttendee>(Collections.EVENT_ATTENDEES, attendeesFilter);

            await loadUserData(attendees);
        } catch (err) {
            console.error('Error loading major distribution data:', err);
            setError('Failed to load major distribution data');
        } finally {
            setLoading(false);
        }
    };

    const loadUserData = async (attendees: EventAttendee[]) => {
        try {
            if (!attendees || attendees.length === 0) {
                setChartData(null);
                return;
            }

            // Get unique user IDs from attendees
            const userIds = [...new Set(attendees.map(a => a.user))];

            // Fetch user data to get majors
            const users = await get.getMany<User>(Collections.USERS, userIds);

            processChartData(users);
        } catch (err) {
            console.error('Error loading user data:', err);
            setError('Failed to load user data');
        }
    };

    const processChartData = (users: User[]) => {
        if (!users || users.length === 0) {
            setChartData(null);
            return;
        }

        // Categorize users by major
        const majorCounts = MAJOR_CATEGORIES.reduce((acc, category) => {
            acc[category.name] = 0;
            return acc;
        }, {} as Record<string, number>);

        users.forEach(user => {
            if (!user.major) {
                majorCounts['Other']++;
                return;
            }

            const major = user.major.toLowerCase();

            // Categorize majors
            if (major.includes('computer science') || major.includes('cs')) {
                majorCounts['Computer Science']++;
            } else if (major.includes('electrical') || major.includes('ee')) {
                majorCounts['Electrical Engineering']++;
            } else if (major.includes('computer eng') || major.includes('ce')) {
                majorCounts['Computer Engineering']++;
            } else if (major.includes('mechanical') || major.includes('me')) {
                majorCounts['Mechanical Engineering']++;
            } else if (major.includes('data science') || major.includes('ds')) {
                majorCounts['Data Science']++;
            } else if (major.includes('math')) {
                majorCounts['Mathematics']++;
            } else if (major.includes('physics')) {
                majorCounts['Physics']++;
            } else if (major.includes('engineering')) {
                majorCounts['Other Engineering']++;
            } else {
                majorCounts['Other']++;
            }
        });

        // Sort by count (descending)
        const sortedMajors = Object.entries(majorCounts)
            .sort((a, b) => b[1] - a[1])
            .filter(([_, count]) => count > 0); // Only include majors with at least one student

        // Prepare data for chart
        const labels = sortedMajors.map(([major]) => major);
        const data = sortedMajors.map(([_, count]) => count);
        const backgroundColor = labels.map(label =>
            MAJOR_CATEGORIES.find(category => category.name === label)?.color || 'rgba(128, 128, 128, 0.8)'
        );

        const chartData = {
            labels,
            datasets: [
                {
                    label: 'Number of Students',
                    data,
                    backgroundColor,
                    borderColor: backgroundColor.map(color => color.replace('0.8', '1')),
                    borderWidth: 1,
                },
            ],
        };

        setChartData(chartData);
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y' as const,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const percentage = Math.round((value / total) * 100);
                        return `${value} students (${percentage}%)`;
                    }
                }
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Number of Students'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Major'
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
                    <p>No student data available for the selected time period</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full">
            <Bar data={chartData} options={chartOptions} />
        </div>
    );
}