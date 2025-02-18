import { useEffect, useState } from "react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";

interface Event {
    id: string;
    event_name: string;
    attendees: Array<{
        food: string;
        time_checked_in: string;
        user_id: string;
    }>;
}

export function Stats() {
    const [eventsAttended, setEventsAttended] = useState(0);
    const [loyaltyPoints, setLoyaltyPoints] = useState(0);
    const [activityLevel, setActivityLevel] = useState("Low");
    const [activityDesc, setActivityDesc] = useState("New Member");
    const [pointsChange, setPointsChange] = useState("No activity");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                const get = Get.getInstance();
                const auth = Authentication.getInstance();
                const userId = auth.getCurrentUser()?.id;

                if (!userId) return;

                // Fetch all events
                const events = await get.getAll<Event>("events");

                // Count events where user is in attendees
                const attendedEvents = events.filter(event =>
                    event.attendees?.some(attendee => attendee.user_id === userId)
                );

                const numEventsAttended = attendedEvents.length;
                setEventsAttended(numEventsAttended);

                // Calculate loyalty points (1 point per event)
                const points = numEventsAttended;
                setLoyaltyPoints(points);

                // Set points change message
                if (points > 0) {
                    setPointsChange(`+${points} this semester`);
                }

                // Determine activity level
                if (points >= 10) {
                    setActivityLevel("High");
                    setActivityDesc("Very Active");
                } else if (points >= 5) {
                    setActivityLevel("Medium");
                    setActivityDesc("Active Member");
                } else if (points >= 1) {
                    setActivityLevel("Low");
                    setActivityDesc("Getting Started");
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="stats shadow-lg bg-base-100 rounded-2xl border border-base-200">
                        <div className="stat">
                            <div className="stat-title skeleton h-4 w-32 mb-2"></div>
                            <div className="stat-value skeleton h-8 w-16"></div>
                            <div className="stat-desc mt-1">
                                <div className="skeleton h-4 w-24"></div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="stats shadow-lg bg-base-100 rounded-2xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform">
                <div className="stat">
                    <div className="stat-title font-medium opacity-80">Events Attended</div>
                    <div className="stat-value text-primary">{eventsAttended}</div>
                    <div className="stat-desc flex items-center gap-2 mt-1">
                        <div className="badge badge-primary badge-sm">Since joining</div>
                    </div>
                </div>
            </div>
            <div className="stats shadow-lg bg-base-100 rounded-2xl border border-base-200 hover:border-secondary transition-all duration-300 hover:-translate-y-1 transform">
                <div className="stat">
                    <div className="stat-title font-medium opacity-80">Loyalty Points</div>
                    <div className="stat-value text-secondary">{loyaltyPoints}</div>
                    <div className="stat-desc flex items-center gap-2 mt-1">
                        <div className="badge badge-secondary badge-sm">{pointsChange}</div>
                    </div>
                </div>
            </div>
            <div className="stats shadow-lg bg-base-100 rounded-2xl border border-base-200 hover:border-accent transition-all duration-300 hover:-translate-y-1 transform">
                <div className="stat">
                    <div className="stat-title font-medium opacity-80">Activity Level</div>
                    <div className="stat-value text-accent">{activityLevel}</div>
                    <div className="stat-desc flex items-center gap-2 mt-1">
                        <div className="badge badge-accent badge-sm">{activityDesc}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
