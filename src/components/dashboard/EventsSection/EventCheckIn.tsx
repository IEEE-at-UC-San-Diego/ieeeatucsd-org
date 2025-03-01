import { useState } from "react";
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

    async function handleEventCheckIn(eventCode: string): Promise<void> {
        try {
            const get = Get.getInstance();
            const auth = Authentication.getInstance();
            const dataSync = DataSyncService.getInstance();

            const currentUser = auth.getCurrentUser();
            if (!currentUser) {
                toast.error("You must be logged in to check in to events");
                return;
            }

            // Find the event with the given code using IndexedDB
            // Force sync to ensure we have the latest data
            await dataSync.syncCollection(Collections.EVENTS, `event_code = "${eventCode}"`);

            // Get the event from IndexedDB
            const events = await dataSync.getData<Event>(
                Collections.EVENTS,
                false, // Don't force sync again
                `event_code = "${eventCode}"`
            );

            const event = events.length > 0 ? events[0] : null;

            if (!event) {
                throw new Error("Invalid event code");
            }

            // Check if user is already checked in
            const attendees = event.attendees || [];
            if (attendees.some((entry) => entry.user_id === currentUser.id)) {
                throw new Error("You have already checked in to this event");
            }

            // Check if the event is active (has started and hasn't ended yet)
            const currentTime = new Date();
            const eventStartDate = new Date(event.start_date); // Now properly converted to local time by Get
            const eventEndDate = new Date(event.end_date); // Now properly converted to local time by Get

            if (eventStartDate > currentTime) {
                throw new Error("This event has not started yet");
            }

            if (eventEndDate < currentTime) {
                throw new Error("This event has already ended");
            }

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

            // Force sync the events collection to update IndexedDB
            await dataSync.syncCollection(Collections.EVENTS);

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

                // Force sync the users collection to update IndexedDB
                await dataSync.syncCollection(Collections.USERS);

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
        </>
    );
};

export default EventCheckIn;