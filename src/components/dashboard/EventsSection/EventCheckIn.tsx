import { useState, useEffect } from "react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { Update } from "../../../scripts/pocketbase/Update";
import { SendLog } from "../../../scripts/pocketbase/SendLog";
import { DataSyncService } from "../../../scripts/database/DataSyncService";
import { Collections } from "../../../schemas/pocketbase/schema";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import type { Event, EventAttendee } from "../../../schemas/pocketbase";

// Extended Event interface with additional properties needed for this component
interface ExtendedEvent extends Event {
    description?: string; // This component uses 'description' but schema has 'event_description'
}

// Note: Date conversion is now handled automatically by the Get and Update classes.
// When fetching events, UTC dates are converted to local time.
// When saving events, local dates are converted back to UTC.

const EventCheckIn = () => {
    const [currentCheckInEvent, setCurrentCheckInEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [foodInput, setFoodInput] = useState("");

    // SECURITY FIX: Purge event codes when component mounts
    useEffect(() => {
        const dataSync = DataSyncService.getInstance();
        dataSync.purgeEventCodes().catch(err => {
            console.error("Error purging event codes:", err);
        });
    }, []);

    async function handleEventCheckIn(eventCode: string): Promise<void> {
        try {
            const get = Get.getInstance();
            const auth = Authentication.getInstance();
            const dataSync = DataSyncService.getInstance();
            const logger = SendLog.getInstance();

            const currentUser = auth.getCurrentUser();
            if (!currentUser) {
                await logger.send(
                    "error",
                    "event_check_in",
                    "Check-in failed: User not logged in"
                );
                toast.error("You must be logged in to check in to events");
                return;
            }

            // Log the check-in attempt
            await logger.send(
                "info",
                "event_check_in",
                `Attempting to check in with code: ${eventCode}`
            );

            // Validate event code
            if (!eventCode || eventCode.trim() === "") {
                await logger.send(
                    "error",
                    "event_check_in",
                    "Check-in failed: Empty event code"
                );
                toast.error("Please enter an event code");
                return;
            }

            // Get event by code
            const events = await get.getList<Event>(
                Collections.EVENTS,
                1,
                1,
                `event_code="${eventCode}"`
            );

            if (events.totalItems === 0) {
                await logger.send(
                    "error",
                    "event_check_in",
                    `Check-in failed: Invalid event code: ${eventCode}`
                );
                toast.error("Invalid event code. Please try again.");
                return;
            }

            const event = events.items[0];

            // Check if event is published
            if (!event.published) {
                await logger.send(
                    "error",
                    "event_check_in",
                    `Check-in failed: Event not published: ${event.event_name}`
                );
                toast.error("This event is not currently available for check-in");
                return;
            }

            // Check if the event is active (has started and hasn't ended yet)
            const currentTime = new Date();
            const eventStartDate = new Date(event.start_date);
            const eventEndDate = new Date(event.end_date);

            if (currentTime < eventStartDate) {
                await logger.send(
                    "error",
                    "event_check_in",
                    `Check-in failed: Event has not started yet: ${event.event_name}`
                );
                toast.error(`This event hasn't started yet. It begins on ${eventStartDate.toLocaleDateString()} at ${eventStartDate.toLocaleTimeString()}`);
                return;
            }

            if (currentTime > eventEndDate) {
                await logger.send(
                    "error",
                    "event_check_in",
                    `Check-in failed: Event has already ended: ${event.event_name}`
                );
                toast.error("This event has already ended");
                return;
            }

            // Check if user is already checked in
            const attendees = await get.getList<EventAttendee>(
                Collections.EVENT_ATTENDEES,
                1,
                1,
                `user="${currentUser.id}" && event="${event.id}"`
            );

            if (attendees.totalItems > 0) {
                await logger.send(
                    "error",
                    "event_check_in",
                    `Check-in failed: Already checked in to event: ${event.event_name}`
                );
                toast.error("You have already checked in to this event");
                return;
            }

            // Set current event for check-in
            setCurrentCheckInEvent(event);

            // Log successful event lookup
            await logger.send(
                "info",
                "event_check_in",
                `Found event for check-in: ${event.event_name}`
            );

            // Store event code in local storage for offline check-in
            await dataSync.storeEventCode(eventCode);

            // Show event details toast only for non-food events
            // For food events, we'll show the toast after food selection
            if (!event.has_food) {
                toast.success(
                    <div>
                        <strong>Event found!</strong>
                        <p className="text-sm mt-1">{event.event_name}</p>
                        <p className="text-xs mt-1">
                            {event.points_to_reward > 0 ? `${event.points_to_reward} points` : "No points"}
                        </p>
                    </div>,
                    { duration: 5000 }
                );
            }

            // If event has food, show food selection modal
            if (event.has_food) {
                // Show food-specific toast
                toast.success(
                    <div>
                        <strong>Event with food found!</strong>
                        <p className="text-sm mt-1">{event.event_name}</p>
                        <p className="text-xs mt-1">Please select your food preference</p>
                    </div>,
                    { duration: 5000 }
                );

                const modal = document.getElementById("foodSelectionModal") as HTMLDialogElement;
                if (modal) modal.showModal();
            } else {
                // If no food, show confirmation modal
                const modal = document.getElementById("confirmCheckInModal") as HTMLDialogElement;
                if (modal) modal.showModal();
            }
        } catch (error: any) {
            console.error("Error checking in:", error);
            toast.error(error.message || "An error occurred during check-in");
        }
    }

    async function completeCheckIn(event: Event, foodSelection: string | null): Promise<void> {
        try {
            setIsLoading(true);
            const auth = Authentication.getInstance();
            const update = Update.getInstance();
            const logger = SendLog.getInstance();
            const dataSync = DataSyncService.getInstance();
            const get = Get.getInstance();

            const currentUser = auth.getCurrentUser();
            if (!currentUser) {
                throw new Error("You must be logged in to check in to events");
            }

            const userId = currentUser.id;
            const eventId = event.id;

            // Check if user is already checked in
            const existingAttendees = await get.getList<EventAttendee>(
                Collections.EVENT_ATTENDEES,
                1,
                1,
                `user="${userId}" && event="${eventId}"`
            );

            const isAlreadyCheckedIn = existingAttendees.totalItems > 0;

            if (isAlreadyCheckedIn) {
                throw new Error("You have already checked in to this event");
            }

            // Create new attendee record
            const attendeeData = {
                user: userId,
                event: eventId,
                food_ate: foodSelection || "",
                time_checked_in: new Date().toISOString(),
                points_earned: event.points_to_reward || 0
            };

            // Create the attendee record using PocketBase's create method
            // This will properly use the collection rules defined in PocketBase
            try {
                // Use the update.create method which calls PocketBase's collection.create method
                await update.create(Collections.EVENT_ATTENDEES, attendeeData);

                console.log("Successfully created attendance record");

                // Update user's total points
                // First, get all the user's attendance records to calculate total points
                const userAttendance = await get.getList<EventAttendee>(
                    Collections.EVENT_ATTENDEES,
                    1,
                    1000,
                    `user="${userId}"`
                );

                // Calculate total points
                let totalPoints = 0;
                userAttendance.items.forEach(attendee => {
                    totalPoints += attendee.points_earned || 0;
                });

                // Log the points update
                console.log(`Updating user points to: ${totalPoints}`);

                // Update the user record with the new total points
                await update.updateFields(Collections.USERS, userId, {
                    points: totalPoints
                });

                // Sync the updated user data
                await dataSync.syncCollection(Collections.USERS);
            } catch (createError: any) {
                console.error("Error creating attendance record:", createError);

                // Check if this is a duplicate record error
                if (createError.status === 400 && createError.data?.data?.user?.code === "validation_not_unique") {
                    throw new Error("You have already checked in to this event");
                }

                throw createError;
            }

            // Log successful check-in
            await logger.send(
                "info",
                "event_check_in",
                `Successfully checked in to event: ${event.event_name}`
            );

            // Clear event code from local storage
            await dataSync.clearEventCode();

            // Show success message with event name and points
            const pointsMessage = event.points_to_reward > 0
                ? ` (+${event.points_to_reward} points!)`
                : "";
            toast.success(`Successfully checked in to ${event.event_name}${pointsMessage}`);
            setCurrentCheckInEvent(null);
            setFoodInput("");
        } catch (error: any) {
            console.error("Error completing check-in:", error);
            toast.error(error.message || "An error occurred during check-in");
        } finally {
            setIsLoading(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentCheckInEvent) return;

        try {
            const auth = Authentication.getInstance();
            const logger = SendLog.getInstance();
            const get = Get.getInstance();

            const currentUser = auth.getCurrentUser();
            if (!currentUser) {
                throw new Error("You must be logged in to check in to events");
            }

            // Get existing attendees or initialize empty array
            const existingAttendees = await get.getList<EventAttendee>(
                Collections.EVENT_ATTENDEES,
                1,
                1,
                `user="${currentUser.id}" && event="${currentCheckInEvent.id}"`
            );

            // Check if user is already checked in
            if (existingAttendees.totalItems > 0) {
                throw new Error("You have already checked in to this event");
            }

            // Complete check-in with food selection
            await completeCheckIn(currentCheckInEvent, foodInput);
        } catch (error: any) {
            console.error("Error submitting check-in:", error);
            toast.error(error.message || "An error occurred during check-in");
        }
    };

    return (
        <>
            <div className="card bg-base-100 shadow-xl border border-base-200 h-full">
                <div className="card-body p-4 sm:p-6">
                    <h3 className="card-title text-base sm:text-lg mb-3 sm:mb-4">Event Check-in</h3>
                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text text-sm sm:text-base">Enter event code to check in</span>
                        </label>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                            if (input.value.trim()) {
                                setIsLoading(true);
                                handleEventCheckIn(input.value.trim()).finally(() => {
                                    setIsLoading(false);
                                    input.value = "";
                                });
                            } else {
                                toast("Please enter an event code", {
                                    icon: '⚠️',
                                    style: {
                                        borderRadius: '10px',
                                        background: '#FFC107',
                                        color: '#000',
                                    },
                                });
                            }
                        }}>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="password"
                                    placeholder="Enter code"
                                    className="input input-bordered flex-1 text-sm sm:text-base h-10 min-h-[2.5rem] w-full"
                                    onKeyPress={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                        }
                                    }}
                                />
                                <button
                                    type="submit"
                                    className="btn btn-primary h-10 min-h-[2.5rem] text-sm sm:text-base w-full sm:w-auto"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Icon
                                            icon="line-md:loading-twotone-loop"
                                            className="w-5 h-5"
                                            inline={true}
                                        />
                                    ) : (
                                        "Check In"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Food Selection Modal */}
            <dialog id="foodSelectionModal" className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-lg mb-2">{currentCheckInEvent?.event_name}</h3>
                    <div className="text-sm mb-4 opacity-75">
                        {currentCheckInEvent?.event_description}
                    </div>
                    <div className="badge badge-primary mb-4">
                        {currentCheckInEvent?.points_to_reward} points
                    </div>
                    <p className="mb-4">This event has food! Please let us know what you'd like to eat:</p>
                    <form onSubmit={handleSubmit}>
                        <div className="form-control">
                            <input
                                type="text"
                                placeholder="Enter your food preference"
                                className="input input-bordered w-full"
                                value={foodInput}
                                onChange={(e) => setFoodInput(e.target.value)}
                                required
                            />
                        </div>
                        <div className="modal-action">
                            <button type="button" className="btn" onClick={() => {
                                const modal = document.getElementById("foodSelectionModal") as HTMLDialogElement;
                                modal.close();
                                setCurrentCheckInEvent(null);
                            }}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={isLoading}>
                                {isLoading ? (
                                    <Icon
                                        icon="line-md:loading-twotone-loop"
                                        className="w-5 h-5"
                                        inline={true}
                                    />
                                ) : (
                                    "Check In"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>

            {/* Confirmation Modal (for events without food) */}
            <dialog id="confirmCheckInModal" className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-lg mb-2">{currentCheckInEvent?.event_name}</h3>
                    <div className="text-sm mb-4 opacity-75">
                        {currentCheckInEvent?.event_description}
                    </div>
                    <div className="badge badge-primary mb-4">
                        {currentCheckInEvent?.points_to_reward} points
                    </div>
                    <p className="mb-4">Are you sure you want to check in to this event?</p>
                    <div className="modal-action">
                        <button
                            type="button"
                            className="btn"
                            onClick={() => {
                                const modal = document.getElementById("confirmCheckInModal") as HTMLDialogElement;
                                modal.close();
                                setCurrentCheckInEvent(null);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={isLoading}
                            onClick={() => {
                                if (currentCheckInEvent) {
                                    completeCheckIn(currentCheckInEvent, null);
                                    const modal = document.getElementById("confirmCheckInModal") as HTMLDialogElement;
                                    modal.close();
                                }
                            }}
                        >
                            {isLoading ? (
                                <Icon
                                    icon="line-md:loading-twotone-loop"
                                    className="w-5 h-5"
                                    inline={true}
                                />
                            ) : (
                                "Confirm Check In"
                            )}
                        </button>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </>
    );
};

export default EventCheckIn;