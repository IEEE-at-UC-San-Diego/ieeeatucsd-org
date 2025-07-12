import { useState, useEffect } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { Event, EventAttendee } from '../../../schemas/pocketbase/schema';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

// Import Chart.js
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale
);

// Define event types and their colors
const EVENT_TYPES = [
    { name: 'Social', key: 'social', color: 'rgba(255, 99, 132, 0.8)' },
    { name: 'Technical', key: 'technical', color: 'rgba(54, 162, 235, 0.8)' },
    { name: 'Outreach', key: 'outreach', color: 'rgba(255, 206, 86, 0.8)' },
    { name: 'Professional', key: 'professional', color: 'rgba(75, 192, 192, 0.8)' },
    { name: 'Projects', key: 'projects', color: 'rgba(153, 102, 255, 0.8)' },
    { name: 'Other', key: 'other', color: 'rgba(255, 159, 64, 0.8)' },
];

export default function EventTypeDistribution() {
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
            console.error('Error loading event type distribution data:', err);
            setError('Failed to load event type distribution data');
        } finally {
            setLoading(false);
        }
    };

    const processChartData = (events: Event[], attendees: EventAttendee[]) => {
        if (!events || events.length === 0) {
            setChartData(null);
            return;
        }

        // Categorize events by type
        // For this demo, we'll use a simple heuristic based on event name/description
        // In a real implementation, you might have an event_type field in your schema
        const eventTypeCount = EVENT_TYPES.reduce((acc, type) => {
            acc[type.name] = 0;
            return acc;
        }, {} as Record<string, number>);

        // Count events by event_type field from schema
        events.forEach(event => {
            const type = event.event_type && EVENT_TYPES.find(t => t.key === event.event_type) ? event.event_type : 'other';
            const typeObj = EVENT_TYPES.find(t => t.key === type);
            if (typeObj) {
                eventTypeCount[typeObj.name]++;
            }
        });

        // Prepare data for chart
        const labels = Object.keys(eventTypeCount);
        const data = Object.values(eventTypeCount);
        const backgroundColor = labels.map(label =>
            EVENT_TYPES.find(type => type.name === label)?.color || 'rgba(128, 128, 128, 0.8)'
        );

        const chartData = {
            labels,
            datasets: [
                {
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
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    padding: 20,
                    boxWidth: 12,
                },
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        // Only show the label, not the value
                        return context.label || '';
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
            <Pie data={chartData} options={chartOptions} />
        </div>
    );
}