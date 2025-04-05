import { useState, useEffect, useRef } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { Event, EventAttendee } from '../../../schemas/pocketbase/schema';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

// Import Chart.js
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    BarElement,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

export default function EventAttendanceChart() {
    const [chartData, setChartData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<number | string>(30); // Default to 30 days
    const chartRef = useRef<any>(null);

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    useEffect(() => {
        // Listen for analytics data updates from the parent component
        const handleAnalyticsUpdate = (event: CustomEvent) => {
            const { events, attendees, timeRange } = event.detail;
            setTimeRange(timeRange);
            processChartData(events, attendees);
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

            processChartData(events, attendees);
        } catch (err) {
            console.error('Error loading event attendance data:', err);
            setError('Failed to load event attendance data');
        } finally {
            setLoading(false);
        }
    };

    const processChartData = (events: Event[], attendees: EventAttendee[]) => {
        if (!events || events.length === 0) {
            setChartData(null);
            return;
        }

        // Group events by date
        const eventsByDate = new Map<string, Event[]>();
        events.forEach(event => {
            // Format date to YYYY-MM-DD
            const date = new Date(event.start_date);
            const dateStr = date.toISOString().split('T')[0];

            if (!eventsByDate.has(dateStr)) {
                eventsByDate.set(dateStr, []);
            }
            eventsByDate.get(dateStr)!.push(event);
        });

        // Count attendees per event
        const attendeesByEvent = new Map<string, number>();
        attendees.forEach(attendee => {
            if (!attendeesByEvent.has(attendee.event)) {
                attendeesByEvent.set(attendee.event, 0);
            }
            attendeesByEvent.set(attendee.event, attendeesByEvent.get(attendee.event)! + 1);
        });

        // Calculate average attendance per date
        const attendanceByDate = new Map<string, { total: number, count: number }>();
        events.forEach(event => {
            const date = new Date(event.start_date);
            const dateStr = date.toISOString().split('T')[0];

            if (!attendanceByDate.has(dateStr)) {
                attendanceByDate.set(dateStr, { total: 0, count: 0 });
            }

            const attendeeCount = attendeesByEvent.get(event.id) || 0;
            const current = attendanceByDate.get(dateStr)!;
            attendanceByDate.set(dateStr, {
                total: current.total + attendeeCount,
                count: current.count + 1
            });
        });

        // Sort dates
        const sortedDates = Array.from(attendanceByDate.keys()).sort();

        // Calculate average attendance per date
        const averageAttendance = sortedDates.map(date => {
            const { total, count } = attendanceByDate.get(date)!;
            return count > 0 ? Math.round(total / count) : 0;
        });

        // Format dates for display
        const formattedDates = sortedDates.map(date => {
            const [year, month, day] = date.split('-');
            return `${month}/${day}`;
        });

        // Create chart data
        const data = {
            labels: formattedDates,
            datasets: [
                {
                    label: 'Average Attendance',
                    data: averageAttendance,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.4,
                    fill: true,
                }
            ]
        };

        setChartData(data);
    };

    const chartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Average Attendance'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Date'
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
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
            <Line data={chartData} options={chartOptions} />
        </div>
    );
}