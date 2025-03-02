import { useState, useEffect } from "react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { Update } from "../../../scripts/pocketbase/Update";
import { SendLog } from "../../../scripts/pocketbase/SendLog";
import { DataSyncService } from "../../../scripts/database/DataSyncService";
import { Collections } from "../../../schemas/pocketbase/schema";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import type { Event, AttendeeEntry } from "../../../schemas/pocketbase";

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
                "attempt",
                "event_check_in",
                `User ${currentUser.id} attempted to check in with code: ${eventCode}`
            );

            // SECURITY FIX: Instead of syncing and querying IndexedDB with the event code,
            // directly query PocketBase for the event with the given code
            // This prevents the event code from being stored in IndexedDB
            const pb = auth.getPocketBase();
            const records = await pb.collection(Collections.EVENTS).getList(1, 1, {
                filter: `event_code = "${eventCode}"`,
            });

            // Convert the first result to our Event type
            let event: Event | null = null;
            if (records.items.length > 0) {
                event = Get.convertUTCToLocal(records.items[0] as unknown as Event);
            }

            if (!event) {
                await logger.send(
                    "error",
                    "event_check_in",
                    `Check-in failed: Invalid event code "${eventCode}"`
                );
                throw new Error("Invalid event code");
            }

            // Check if user is already checked in
            const attendees = event.attendees || [];
            if (attendees.some((entry) => entry.user_id === currentUser.id)) {
                await logger.send(
                    "error",
                    "event_check_in",
                    `Check-in failed: User ${currentUser.id} already checked in to event ${event.event_name} (${event.id})`
                );
                throw new Error("You have already checked in to this event");
            }

            // Check if the event is active (has started and hasn't ended yet)
            const currentTime = new Date();
            const eventStartDate = new Date(event.start_date); // Now properly converted to local time by Get
            const eventEndDate = new Date(event.end_date); // Now properly converted to local time by Get

            if (eventStartDate > currentTime) {
                await logger.send(
                    "error",
                    "event_check_in",
                    `Check-in failed: Event ${event.event_name} (${event.id}) has not started yet`
                );
                throw new Error("This event has not started yet");
            }

            if (eventEndDate < currentTime) {
                await logger.send(
                    "error",
                    "event_check_in",
                    `Check-in failed: Event ${event.event_name} (${event.id}) has already ended`
                );
                throw new Error("This event has already ended");
            }

            // Log successful validation before proceeding
            await logger.send(
                "info",
                "event_check_in",
                `Check-in validation successful for user ${currentUser.id} to event ${event.event_name} (${event.id})`
            );

            // If event has food, show food selection modal
            if (event.has_food) {
                setCurrentCheckInEvent(event);
                const modal = document.getElementById("foodSelectionModal") as HTMLDialogElement;
                modal.showModal();
            } else {
                // If no food, complete check-in directly
                await completeCheckIn(event, null);
            }
        } catch (error: any) {
            toast.error(error?.message || "Failed to check in to event");
        }
    }

    async function completeCheckIn(event: Event, foodSelection: string | null): Promise<void> {
        try {
            const auth = Authentication.getInstance();
            const update = Update.getInstance();
            const logger = SendLog.getInstance();
            const dataSync = DataSyncService.getInstance();

            const currentUser = auth.getCurrentUser();
            if (!currentUser) {
                throw new Error("You must be logged in to check in to events");
            }

            // Check if user is already checked in
            const userId = auth.getUserId();

            if (!userId) {
                toast.error("You must be logged in to check in to an event");
                return;
            }

            // Initialize attendees array if it doesn't exist
            const attendees = event.attendees || [];

            // Check if user is already checked in
            const isAlreadyCheckedIn = attendees.some(
                (attendee) => attendee.user_id === userId
            );

            if (isAlreadyCheckedIn) {
                toast("You are already checked in to this event", {
                    icon: '⚠️',
                    style: {
                        borderRadius: '10px',
                        background: '#FFC107',
                        color: '#000',
                    },
                });
                return;
            }

            // Create attendee entry with check-in details
            const attendeeEntry: AttendeeEntry = {
                user_id: currentUser.id,
                time_checked_in: new Date().toISOString(), // Will be properly converted to UTC by Update
                food: foodSelection || "none",
            };

            // Get existing attendees or initialize empty array
            const existingAttendees = event.attendees || [];

            // Check if user is already checked in
            if (existingAttendees.some((entry) => entry.user_id === currentUser.id)) {
                throw new Error("You have already checked in to this event");
            }

            // Add new attendee entry to the array
            const updatedAttendees = [...existingAttendees, attendeeEntry];

            // Update attendees array with the new entry
            await update.updateField("events", event.id, "attendees", updatedAttendees);

            // SECURITY FIX: Instead of syncing the entire events collection which would store event codes in IndexedDB,
            // only sync the user's collection to update their points
            if (event.points_to_reward > 0) {
                await dataSync.syncCollection(Collections.USERS);
            }

            // If food selection was made, log it
            if (foodSelection) {
                await logger.send(
                    "update",
                    "event check-in",
                    `Food selection for ${event.event_name}: ${foodSelection}`
                );
            }

            // Award points to user if available
            if (event.points_to_reward > 0) {
                const userPoints = currentUser.points || 0;
                await update.updateField(
                    "users",
                    currentUser.id,
                    "points",
                    userPoints + event.points_to_reward
                );

                // Log the points award
                await logger.send(
                    "update",
                    "event check-in",
                    `Awarded ${event.points_to_reward} points for checking in to ${event.event_name}`
                );
            }

            // Show success message with points if awarded
            toast.success(
                `Successfully checked in to ${event.event_name}${event.points_to_reward > 0
                    ? ` (+${event.points_to_reward} points!)`
                    : ""
                }`
            );

            // Log the check-in
            await logger.send(
                "check_in",
                "events",
                `Checked in to event ${event.event_name}`
            );

            // Close the food selection modal if it's open
            const modal = document.getElementById("foodSelectionModal") as HTMLDialogElement;
            if (modal) {
                modal.close();
                setFoodInput("");
            }
        } catch (error: any) {
            toast.error(error?.message || "Failed to check in to event");
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (currentCheckInEvent) {
            await completeCheckIn(currentCheckInEvent, foodInput.trim());
            setCurrentCheckInEvent(null);
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
                    <h3 className="font-bold text-lg mb-4">Food Selection</h3>
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
                            <button type="submit" className="btn btn-primary">Submit</button>
                        </div>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </>
    );
};

export default EventCheckIn;