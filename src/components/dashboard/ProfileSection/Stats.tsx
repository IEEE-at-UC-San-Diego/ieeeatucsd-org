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

interface Log {
    id: string;
    message: string;
    created: string;
    type: string;
    part: string;
    user_id: string;
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

                // Get current quarter dates
                const now = new Date();
                const month = now.getMonth(); // 0-11

                let quarterStart = new Date();
                // Fall: Sept-Dec
                if (month >= 8 && month <= 11) {
                    quarterStart = new Date(now.getFullYear(), 8, 1); // Sept 1
                }
                // Winter: Jan-Mar
                else if (month >= 0 && month <= 2) {
                    quarterStart = new Date(now.getFullYear(), 0, 1); // Jan 1
                }
                // Spring: Apr-Jun
                else if (month >= 3 && month <= 5) {
                    quarterStart = new Date(now.getFullYear(), 3, 1); // Apr 1
                }
                // Summer: Jul-Aug
                else {
                    quarterStart = new Date(now.getFullYear(), 6, 1); // Jul 1
                }

                // Get user's total points
                const user = await get.getOne("users", userId);
                const totalPoints = user.points || 0;

                // Fetch quarterly points from logs
                const logs = await get.getList<Log>("logs", 1, 50,
                    `user_id = "${userId}" && created >= "${quarterStart.toISOString()}" && type = "update" && part = "event check-in"`,
                    "-created"
                );

                // Calculate quarterly points
                const quarterlyPoints = logs.items.reduce((total, log) => {
                    const pointsMatch = log.message.match(/Awarded (\d+) points/);
                    if (pointsMatch) {
                        return total + parseInt(pointsMatch[1]);
                    }
                    return total;
                }, 0);

                // Fetch all events for total count
                const events = await get.getAll<Event>("events");
                const attendedEvents = events.filter(event =>
                    event.attendees?.some(attendee => attendee.user_id === userId)
                );

                const numEventsAttended = attendedEvents.length;
                setEventsAttended(numEventsAttended);
                setLoyaltyPoints(totalPoints);

                // Set points change message with quarterly points
                setPointsChange(quarterlyPoints > 0 ? `+${quarterlyPoints} this quarter` : "No activity");

                // Determine activity level
                if (numEventsAttended >= 10) {
                    setActivityLevel("High");
                    setActivityDesc("Very Active");
                } else if (numEventsAttended >= 5) {
                    setActivityLevel("Medium");
                    setActivityDesc("Active Member");
                } else if (numEventsAttended >= 1) {
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
