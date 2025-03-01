import { useEffect, useState } from "react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { Update } from "../../../scripts/pocketbase/Update";
import { SendLog } from "../../../scripts/pocketbase/SendLog";
import { Icon } from "@iconify/react";
import type { Event, AttendeeEntry } from "../../../schemas/pocketbase";

// Extended Event interface with additional properties needed for this component
interface ExtendedEvent extends Event {
    description?: string; // This component uses 'description' but schema has 'event_description'
}

// Note: Date conversion is now handled automatically by the Get and Update classes.
// When fetching events, UTC dates are converted to local time.
// When saving events, local dates are converted back to UTC.

// Toast management system
const createToast = (
    message: string,
    type: "success" | "error" | "warning" = "success"
) => {
    let toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.className = "toast-container fixed bottom-4 right-4 z-50";
        document.body.appendChild(toastContainer);
    }

    const existingToasts = document.querySelectorAll(".toast-container .toast");
    if (existingToasts.length >= 2) {
        const oldestToast = existingToasts[0];
        oldestToast.classList.add("toast-exit");
        setTimeout(() => oldestToast.remove(), 150);
    }

    // Update positions of existing toasts
    existingToasts.forEach((t) => {
        const toast = t as HTMLElement;
        const currentIndex = parseInt(toast.getAttribute("data-index") || "0");
        toast.setAttribute("data-index", (currentIndex + 1).toString());
    });

    const toast = document.createElement("div");
    toast.className = "toast translate-x-full";
    toast.setAttribute("data-index", "0");

    // Update alert styling based on type
    const alertClass =
        type === "success"
            ? "alert-success bg-success text-success-content"
            : type === "error"
                ? "alert-error bg-error text-error-content"
                : "alert-warning bg-warning text-warning-content";

    const iconName = type === "success"
        ? "heroicons:check-circle"
        : type === "error"
            ? "heroicons:x-circle"
            : "heroicons:exclamation-triangle";

    toast.innerHTML = `
      <div class="alert ${alertClass} shadow-lg min-w-[300px]">
        <div class="flex items-center gap-2">
            <iconify-icon icon="${iconName}" width="20" height="20"></iconify-icon>
            <span>${message}</span>
        </div>
      </div>
    `;

    toastContainer.appendChild(toast);

    // Force a reflow to ensure the animation triggers
    toast.offsetHeight;

    // Add the transition class and remove transform
    toast.classList.add("transition-all", "duration-300", "ease-out");
    requestAnimationFrame(() => {
        toast.classList.remove("translate-x-full");
    });

    // Setup exit animation
    setTimeout(() => {
        toast.classList.add("toast-exit");
        setTimeout(() => toast.remove(), 150);
    }, 3000);
};

const EventCheckIn = () => {
    const [currentCheckInEvent, setCurrentCheckInEvent] = useState<Event | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [foodInput, setFoodInput] = useState("");

    async function handleEventCheckIn(eventCode: string): Promise<void> {
        try {
            const get = Get.getInstance();
            const auth = Authentication.getInstance();

            const currentUser = auth.getCurrentUser();
            if (!currentUser) {
                createToast("You must be logged in to check in to events", "error");
                return;
            }

            // Find the event with the given code
            const event = await get.getFirst<Event>(
                "events",
                `event_code = "${eventCode}"`
            );
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
            createToast(error?.message || "Failed to check in to event", "error");
        }
    }

    async function completeCheckIn(event: Event, foodSelection: string | null): Promise<void> {
        try {
            const auth = Authentication.getInstance();
            const update = Update.getInstance();
            const logger = SendLog.getInstance();

            const currentUser = auth.getCurrentUser();
            if (!currentUser) {
                throw new Error("You must be logged in to check in to events");
            }

            // Check if user is already checked in
            const userId = auth.getUserId();

            if (!userId) {
                createToast("You must be logged in to check in to an event", "error");
                return;
            }

            // Initialize attendees array if it doesn't exist
            const attendees = event.attendees || [];

            // Check if user is already checked in
            const isAlreadyCheckedIn = attendees.some(
                (attendee) => attendee.user_id === userId
            );

            if (isAlreadyCheckedIn) {
                createToast("You are already checked in to this event", "warning");
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
            createToast(
                `Successfully checked in to ${event.event_name}${event.points_to_reward > 0
                    ? ` (+${event.points_to_reward} points!)`
                    : ""
                }`,
                "success"
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
            createToast(error?.message || "Failed to check in to event", "error");
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
                                createToast("Please enter an event code", "warning");
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