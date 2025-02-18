import { useEffect, useState } from "react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { Update } from "../../../scripts/pocketbase/Update";
import { SendLog } from "../../../scripts/pocketbase/SendLog";
import { Icon } from "@iconify/react";


interface Event {
    id: string;
    event_name: string;
    event_code: string;
    location: string;
    points_to_reward: number;
    attendees: AttendeeEntry[];
    start_date: string;
    end_date: string;
    has_food: boolean;
    description: string;
    files: string[];
}

interface AttendeeEntry {
    user_id: string;
    time_checked_in: string;
    food: string;
}

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
                throw new Error("You must be logged in to check in to events");
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
            if (event.attendees.some((entry) => entry.user_id === currentUser.id)) {
                throw new Error("You have already checked in to this event");
            }

            // Check if the event hasn't ended yet
            const eventEndDate = new Date(event.end_date);
            if (eventEndDate < new Date()) {
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

            // Create attendee entry with check-in details
            const attendeeEntry: AttendeeEntry = {
                user_id: currentUser.id,
                time_checked_in: new Date().toISOString(),
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
                                    className={`btn btn-primary h-10 min-h-[2.5rem] text-sm sm:text-base w-full sm:w-auto`}
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

            <dialog id="foodSelectionModal" className="modal">
                <div className="modal-box max-w-[90vw] sm:max-w-lg p-4 sm:p-6">
                    <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4">Food Selection</h3>
                    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text text-sm sm:text-base">What food would you like?</span>
                                <span className="label-text-alt text-error">*</span>
                            </label>
                            <input
                                type="text"
                                value={foodInput}
                                onChange={(e) => setFoodInput(e.target.value)}
                                className="input input-bordered text-sm sm:text-base h-10 min-h-[2.5rem] w-full"
                                placeholder="Enter your food choice or 'none'"
                                required
                            />
                            <label className="label">
                                <span className="label-text-alt text-info text-xs sm:text-sm">
                                    Enter 'none' if you don't want any food
                                </span>
                            </label>
                        </div>
                        <div className="modal-action flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <button type="submit" className="btn btn-primary text-sm sm:text-base h-10 min-h-[2.5rem] w-full sm:w-auto">
                                Submit
                            </button>
                            <button
                                type="button"
                                className="btn text-sm sm:text-base h-10 min-h-[2.5rem] w-full sm:w-auto"
                                onClick={() => {
                                    const modal = document.getElementById("foodSelectionModal") as HTMLDialogElement;
                                    modal.close();
                                    setCurrentCheckInEvent(null);
                                    setFoodInput("");
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>

            <style>{`
                .toast-container {
                    display: flex;
                    flex-direction: column;
                    pointer-events: none;
                }
                .toast {
                    pointer-events: auto;
                    transform: translateX(0);
                    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                .toast-exit {
                    transform: translateX(100%);
                    opacity: 0;
                }
                .toast.translate-x-full {
                    transform: translateX(100%);
                }
                .toast-container .toast {
                    transform: translateY(calc((1 - attr(data-index number)) * -0.25rem));
                }
                .toast-container .toast[data-index="0"] {
                    transform: translateY(0);
                }
                .toast-container .toast[data-index="1"] {
                    transform: translateY(-0.025rem);
                }
            `}</style>
        </>
    );
};

export default EventCheckIn;
