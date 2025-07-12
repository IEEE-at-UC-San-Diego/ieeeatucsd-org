import { useEffect, useState } from "react";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { Collections } from "../../../schemas/pocketbase/schema";
import type { Event, User, LimitedUser } from "../../../schemas/pocketbase";
import { Get } from "../../../scripts/pocketbase/Get";
import type { EventAttendee } from "../../../schemas/pocketbase";
import { Update } from "../../../scripts/pocketbase/Update";

// Extended User interface with member_type property
interface ExtendedUser extends User {
    member_type?: string;
}

export function Stats() {
    const [eventsAttended, setEventsAttended] = useState(0);
    const [loyaltyPoints, setLoyaltyPoints] = useState(0);
    const [pointsChange, setPointsChange] = useState("No activity");
    const [quarterlyPoints, setQuarterlyPoints] = useState(0); // Points earned this quarter
    const [membershipStatus, setMembershipStatus] = useState("Member");
    const [memberSince, setMemberSince] = useState<string | null>(null);
    const [upcomingEvents, setUpcomingEvents] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<ExtendedUser | null>(null);
    const [pointsEarned, setPointsEarned] = useState(0);
    const [attendancePercentage, setAttendancePercentage] = useState(0);

    // Helper function to get the start date of the current quarter
    const getCurrentQuarterStartDate = (): Date => {
        const now = new Date();
        const currentMonth = now.getMonth();
        let quarterStartMonth = 0;

        // Determine the start month of the current quarter
        if (currentMonth >= 0 && currentMonth <= 2) {
            quarterStartMonth = 0; // Q1: Jan-Mar
        } else if (currentMonth >= 3 && currentMonth <= 5) {
            quarterStartMonth = 3; // Q2: Apr-Jun
        } else if (currentMonth >= 6 && currentMonth <= 8) {
            quarterStartMonth = 6; // Q3: Jul-Sep
        } else {
            quarterStartMonth = 9; // Q4: Oct-Dec
        }

        return new Date(now.getFullYear(), quarterStartMonth, 1);
    };

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

                // Calculate points from attendees
                let totalPoints = 0;

                // Calculate quarterly points
                const quarterStartDate = getCurrentQuarterStartDate();
                let pointsThisQuarter = 0;

                // Calculate both total and quarterly points from attendees
                attendedEvents.items.forEach(attendee => {
                    const points = attendee.points_earned || 0;
                    totalPoints += points;

                    const checkinDate = new Date(attendee.time_checked_in);
                    if (checkinDate >= quarterStartDate) {
                        pointsThisQuarter += points;
                    }
                });

                // Try to get the LimitedUser record to check if points match
                try {
                    const limitedUserRecord = await get.getOne(
                        Collections.LIMITED_USERS,
                        userId
                    );

                    if (limitedUserRecord && limitedUserRecord.points) {
                        try {
                            // Parse the points JSON string
                            const parsedPoints = JSON.parse(limitedUserRecord.points);
                            if (parsedPoints !== totalPoints) {
                                console.log(`Points mismatch: LimitedUser has ${parsedPoints}, calculated ${totalPoints}`);
                            }
                        } catch (e) {
                            console.error('Error parsing points from LimitedUser:', e);
                        }
                    }
                } catch (e) {
                    // LimitedUser record might not exist yet, that's okay
                }

                setPointsEarned(totalPoints);
                setLoyaltyPoints(totalPoints);
                setQuarterlyPoints(pointsThisQuarter);

                // Get current quarter name
                const now = new Date();
                const currentMonth = now.getMonth();
                let quarterName = "";

                if (currentMonth >= 0 && currentMonth <= 2) {
                    quarterName = "Q1";
                } else if (currentMonth >= 3 && currentMonth <= 5) {
                    quarterName = "Q2";
                } else if (currentMonth >= 6 && currentMonth <= 8) {
                    quarterName = "Q3";
                } else {
                    quarterName = "Q4";
                }

                setPointsChange(`${pointsThisQuarter} pts in ${quarterName}`);

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
                    <div className="stat-title font-medium opacity-80">Points</div>
                    <div className="stat-value text-secondary">{loyaltyPoints}</div>
                    <div className="stat-desc flex flex-col items-start gap-1 mt-1">
                        <div className="flex items-center justify-between w-full">
                            <div className="badge badge-secondary badge-sm">{quarterlyPoints} pts this quarter</div>
                            <div className="text-xs opacity-70">Total points</div>
                        </div>
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
