import { useEffect, useState } from "react";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { DataSyncService } from "../../../scripts/database/DataSyncService";
import { Collections } from "../../../schemas/pocketbase/schema";
import type { Event, Log, User } from "../../../schemas/pocketbase";
import { Get } from "../../../scripts/pocketbase/Get";
import type { EventAttendee } from "../../../schemas/pocketbase";

// Extended User interface with points property
interface ExtendedUser extends User {
    points?: number;
    member_type?: string;
}

export function Stats() {
    const [eventsAttended, setEventsAttended] = useState(0);
    const [loyaltyPoints, setLoyaltyPoints] = useState(0);
    const [pointsChange, setPointsChange] = useState("No activity");
    const [membershipStatus, setMembershipStatus] = useState("Member");
    const [memberSince, setMemberSince] = useState<string | null>(null);
    const [upcomingEvents, setUpcomingEvents] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<ExtendedUser | null>(null);
    const [pointsEarned, setPointsEarned] = useState(0);
    const [attendancePercentage, setAttendancePercentage] = useState(0);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const auth = Authentication.getInstance();
                const get = Get.getInstance();
                const currentUser = auth.getCurrentUser();

                if (!currentUser) {
                    setError("User not logged in");
                    return;
                }

                const userId = currentUser.id;

                // Get user data
                const userData = await get.getOne<ExtendedUser>("users", userId);
                if (!userData) {
                    setError("Failed to load user data");
                    return;
                }

                // Set user data
                setUser(userData);

                // Get events attended by the user
                const attendedEvents = await get.getList<EventAttendee>(
                    "event_attendees",
                    1,
                    1000,
                    `user="${userId}"`
                );

                setEventsAttended(attendedEvents.totalItems);

                // Calculate total points earned
                let totalPoints = 0;
                attendedEvents.items.forEach(attendee => {
                    totalPoints += attendee.points_earned || 0;
                });

                setPointsEarned(totalPoints);

                // Get all events to calculate percentage
                const allEvents = await get.getList<Event>("events", 1, 1000);
                if (allEvents.totalItems > 0) {
                    const percentage = (attendedEvents.totalItems / allEvents.totalItems) * 100;
                    setAttendancePercentage(Math.round(percentage));
                } else {
                    setAttendancePercentage(0);
                }

            } catch (error) {
                console.error("Error fetching stats:", error);
                setError("Failed to load stats");
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
                    <div className="stat-title font-medium opacity-80">Upcoming Events</div>
                    <div className="stat-value text-accent">{upcomingEvents}</div>
                    <div className="stat-desc flex items-center gap-2 mt-1">
                        <div className="badge badge-accent badge-sm">Available to attend</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
