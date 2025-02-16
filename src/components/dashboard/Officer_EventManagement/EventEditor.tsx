import { useState, useEffect } from "react";
import { Get } from "../../pocketbase/Get";
import { Authentication } from "../../pocketbase/Authentication";
import { Update } from "../../pocketbase/Update";
import { FileManager } from "../../pocketbase/FileManager";
import { SendLog } from "../../pocketbase/SendLog";
import FilePreview from "./FilePreview";

// Extend Window interface
declare global {
    interface Window {
        showLoading?: () => void;
        hideLoading?: () => void;
    }
}

interface Event {
    id: string;
    event_name: string;
    event_description: string;
    event_code: string;
    location: string;
    files: string[];
    points_to_reward: number;
    start_date: string;
    end_date: string;
    published: boolean;
    has_food: boolean;
    attendees: AttendeeEntry[];
}

interface AttendeeEntry {
    user_id: string;
    time_checked_in: string;
    food: string;
}

interface EventEditorProps {
    onEventSaved?: () => void;
}

export default function EventEditor({ onEventSaved }: EventEditorProps) {
    // State for form data and UI
    const [event, setEvent] = useState<Event | null>(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewFilename, setPreviewFilename] = useState("");
    const [showPreview, setShowPreview] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<Map<string, File>>(new Map());
    const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize services
    const get = Get.getInstance();
    const auth = Authentication.getInstance();
    const update = Update.getInstance();
    const fileManager = FileManager.getInstance();
    const sendLog = SendLog.getInstance();

    // Method to initialize form with event data
    const initializeEventData = async (eventId: string) => {
        try {
            const eventData = await get.getOne<Event>("events", eventId);
            setEvent(eventData);
            setSelectedFiles(new Map());
            setFilesToDelete(new Set());
            setShowPreview(false);
        } catch (error) {
            console.error("Failed to fetch event data:", error);
            alert("Failed to load event data. Please try again.");
        }
    };

    // Expose initializeEventData to window
    useEffect(() => {
        (window as any).openEditModal = async (event?: Event) => {
            const modal = document.getElementById("editEventModal") as HTMLDialogElement;
            if (!modal) return;

            if (event?.id) {
                await initializeEventData(event.id);
            } else {
                setEvent(null);
                setSelectedFiles(new Map());
                setFilesToDelete(new Set());
                setShowPreview(false);
            }

            modal.showModal();
        };

        return () => {
            delete (window as any).openEditModal;
        };
    }, []);

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const updatedFiles = new Map(selectedFiles);

            newFiles.forEach(file => {
                updatedFiles.set(file.name, file);
            });

            setSelectedFiles(updatedFiles);
        }
    };

    // Handle file deletion
    const handleFileDelete = (filename: string) => {
        if (confirm("Are you sure you want to remove this file?")) {
            const updatedFilesToDelete = new Set(filesToDelete);
            updatedFilesToDelete.add(filename);
            setFilesToDelete(updatedFilesToDelete);
        }
    };

    // Handle file deletion undo
    const handleUndoFileDelete = (filename: string) => {
        const updatedFilesToDelete = new Set(filesToDelete);
        updatedFilesToDelete.delete(filename);
        setFilesToDelete(updatedFilesToDelete);
    };

    // Handle file preview
    const handlePreviewFile = (url: string, filename: string) => {
        setPreviewUrl(url);
        setPreviewFilename(filename);
        setShowPreview(true);
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);

        setIsSubmitting(true);
        try {
            window.showLoading?.();
            const eventData = {
                event_name: formData.get("editEventName"),
                event_code: formData.get("editEventCode"),
                event_description: formData.get("editEventDescription"),
                location: formData.get("editEventLocation"),
                points_to_reward: Number(formData.get("editEventPoints")),
                start_date: new Date(formData.get("editEventStartDate") as string).toISOString(),
                end_date: new Date(formData.get("editEventEndDate") as string).toISOString(),
                published: formData.get("editEventPublished") === "on",
                has_food: formData.get("editEventHasFood") === "on",
            };

            const pb = auth.getPocketBase();

            if (event?.id) {
                // Update existing event
                const currentEvent = await pb.collection("events").getOne(event.id);
                const currentFiles = currentEvent.files || [];

                // Filter out files marked for deletion
                const remainingFiles = currentFiles.filter(
                    (filename: string) => !filesToDelete.has(filename)
                );

                // Create FormData for update
                const updateFormData = new FormData();

                // Add event data
                Object.entries(eventData).forEach(([key, value]) => {
                    updateFormData.append(key, String(value));
                });

                // Add remaining and new files
                const filePromises = remainingFiles.map(async (filename: string) => {
                    try {
                        const response = await fetch(
                            fileManager.getFileUrl("events", event.id, filename)
                        );
                        const blob = await response.blob();
                        return new File([blob], filename, { type: blob.type });
                    } catch (error) {
                        console.error(`Failed to fetch file ${filename}:`, error);
                        return null;
                    }
                });

                const existingFiles = (await Promise.all(filePromises)).filter(
                    (file): file is File => file !== null
                );

                [...existingFiles, ...Array.from(selectedFiles.values())].forEach(
                    (file: File) => {
                        updateFormData.append("files", file);
                    }
                );

                await pb.collection("events").update(event.id, updateFormData);
                await sendLog.send(
                    "update",
                    "event",
                    `Updated event: ${eventData.event_name}`
                );

                // Log file deletions
                for (const filename of filesToDelete) {
                    await sendLog.send(
                        "delete",
                        "event_file",
                        `Deleted file ${filename} from event ${eventData.event_name}`
                    );
                }
            } else {
                // Create new event
                const createFormData = new FormData();

                // Add event data
                Object.entries(eventData).forEach(([key, value]) => {
                    createFormData.append(key, String(value));
                });

                // Initialize empty attendees array
                createFormData.append("attendees", JSON.stringify([]));

                // Add new files
                Array.from(selectedFiles.values()).forEach((file: File) => {
                    createFormData.append("files", file);
                });

                await pb.collection("events").create(createFormData);
                await sendLog.send(
                    "create",
                    "event",
                    `Created event: ${eventData.event_name}`
                );
            }

            // Close modal and reset state
            const modal = document.getElementById("editEventModal") as HTMLDialogElement;
            if (modal) modal.close();

            setEvent(null);
            setSelectedFiles(new Map());
            setFilesToDelete(new Set());
            setShowPreview(false);
            form.reset();

            // Notify parent component
            onEventSaved?.();

        } catch (error) {
            console.error("Failed to save event:", error);
            alert("Failed to save event. Please try again.");
        } finally {
            setIsSubmitting(false);
            window.hideLoading?.();
        }
    };

    return (
        <dialog id="editEventModal" className="modal">
            {showPreview ? (
                <div className="modal-box max-w-4xl">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setShowPreview(false)}
                            >
                                Close
                            </button>
                            <h3 className="font-bold text-lg truncate">
                                {previewFilename}
                            </h3>
                        </div>
                    </div>
                    <div className="relative">
                        <FilePreview
                            url={previewUrl}
                            filename={previewFilename}
                            isModal={false}
                        />
                    </div>
                </div>
            ) : (
                <div className="modal-box max-w-2xl">
                    {/* Main Edit Form Section */}
                    <div id="editFormSection">
                        <h3 className="font-bold text-lg mb-4" id="editModalTitle">
                            {event?.id ? 'Edit Event' : 'Add New Event'}
                        </h3>
                        <form id="editEventForm" onSubmit={handleSubmit} className="space-y-4">
                            <input type="hidden" id="editEventId" name="editEventId" value={event?.id || ''} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Event Name */}
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">Event Name</span>
                                        <span className="label-text-alt text-error">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="editEventName"
                                        className="input input-bordered"
                                        value={event?.event_name || ""}
                                        onChange={(e) => setEvent(prev => prev ? { ...prev, event_name: e.target.value } : null)}
                                        required
                                    />
                                </div>

                                {/* Event Code */}
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">Event Code</span>
                                        <span className="label-text-alt text-error">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="editEventCode"
                                        className="input input-bordered"
                                        value={event?.event_code || ""}
                                        onChange={(e) => setEvent(prev => prev ? { ...prev, event_code: e.target.value } : null)}
                                        required
                                    />
                                </div>

                                {/* Location */}
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">Location</span>
                                        <span className="label-text-alt text-error">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="editEventLocation"
                                        className="input input-bordered"
                                        value={event?.location || ""}
                                        onChange={(e) => setEvent(prev => prev ? { ...prev, location: e.target.value } : null)}
                                        required
                                    />
                                </div>

                                {/* Points to Reward */}
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">Points to Reward</span>
                                        <span className="label-text-alt text-error">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="editEventPoints"
                                        className="input input-bordered"
                                        value={event?.points_to_reward || 0}
                                        onChange={(e) => setEvent(prev => prev ? { ...prev, points_to_reward: Number(e.target.value) } : null)}
                                        min="0"
                                        required
                                    />
                                </div>

                                {/* Start Date */}
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">Start Date</span>
                                        <span className="label-text-alt text-error">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        name="editEventStartDate"
                                        className="input input-bordered"
                                        value={event?.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : ""}
                                        onChange={(e) => setEvent(prev => prev ? { ...prev, start_date: e.target.value } : null)}
                                        required
                                    />
                                </div>

                                {/* End Date */}
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">End Date</span>
                                        <span className="label-text-alt text-error">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        name="editEventEndDate"
                                        className="input input-bordered"
                                        value={event?.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : ""}
                                        onChange={(e) => setEvent(prev => prev ? { ...prev, end_date: e.target.value } : null)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Description</span>
                                    <span className="label-text-alt text-error">*</span>
                                </label>
                                <textarea
                                    name="editEventDescription"
                                    className="textarea textarea-bordered"
                                    value={event?.event_description || ""}
                                    onChange={(e) => setEvent(prev => prev ? { ...prev, event_description: e.target.value } : null)}
                                    rows={3}
                                    required
                                ></textarea>
                            </div>

                            {/* Files */}
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Upload Files</span>
                                </label>
                                <input
                                    type="file"
                                    onChange={handleFileSelect}
                                    className="file-input file-input-bordered"
                                    multiple
                                />
                                <div className="mt-4 space-y-2">
                                    {/* New Files */}
                                    {Array.from(selectedFiles.entries()).map(([name, file]) => (
                                        <div key={name} className="flex items-center justify-between p-2 bg-base-200 rounded-lg">
                                            <span className="truncate">{name}</span>
                                            <div className="flex gap-2">
                                                <div className="badge badge-primary">New</div>
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-xs text-error"
                                                    onClick={() => {
                                                        const updatedFiles = new Map(selectedFiles);
                                                        updatedFiles.delete(name);
                                                        setSelectedFiles(updatedFiles);
                                                    }}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Current Files */}
                                    {event?.files && event.files.length > 0 && (
                                        <>
                                            <div className="divider">Current Files</div>
                                            {event.files.map((filename) => (
                                                <div key={filename} className={`flex items-center justify-between p-2 bg-base-200 rounded-lg${filesToDelete.has(filename) ? " opacity-50" : ""}`}>
                                                    <span className="truncate">{filename}</span>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost btn-xs"
                                                            onClick={() => {
                                                                if (event?.id) {
                                                                    handlePreviewFile(
                                                                        fileManager.getFileUrl("events", event.id, filename),
                                                                        filename
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                        <div className="text-error">
                                                            {filesToDelete.has(filename) ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-ghost btn-xs"
                                                                    onClick={() => handleUndoFileDelete(filename)}
                                                                >
                                                                    Undo
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-ghost btn-xs text-error"
                                                                    onClick={() => handleFileDelete(filename)}
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Published */}
                            <div className="form-control">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        name="editEventPublished"
                                        className="toggle"
                                        checked={event?.published || false}
                                        onChange={(e) => setEvent(prev => prev ? { ...prev, published: e.target.checked } : null)}
                                    />
                                    <span className="label-text">Publish Event</span>
                                </label>
                                <label className="label">
                                    <span className="label-text-alt text-info">
                                        This has to be clicked if you want to make this event available
                                        to the public
                                    </span>
                                </label>
                            </div>

                            {/* Has Food */}
                            <div className="form-control">
                                <label className="label cursor-pointer justify-start gap-4">
                                    <input
                                        type="checkbox"
                                        name="editEventHasFood"
                                        className="toggle"
                                        checked={event?.has_food || false}
                                        onChange={(e) => setEvent(prev => prev ? { ...prev, has_food: e.target.checked } : null)}
                                    />
                                    <span className="label-text">Has Food</span>
                                </label>
                                <label className="label">
                                    <span className="label-text-alt text-info">
                                        Check this if food will be provided at the event
                                    </span>
                                </label>
                            </div>
                        </form>
                    </div>

                    <div className="modal-action">
                        <button
                            type="submit"
                            className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
                            form="editEventForm"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button
                            type="button"
                            className="btn"
                            onClick={() => {
                                const modal = document.getElementById("editEventModal") as HTMLDialogElement;
                                if (modal) modal.close();
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            <form method="dialog" className="modal-backdrop">
                <button>close</button>
            </form>
        </dialog>
    );
}
