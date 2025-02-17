import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
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

// Memoize the FilePreview component
const MemoizedFilePreview = memo(FilePreview);

// Define EventForm props interface
interface EventFormProps {
    event: Event | null;
    setEvent: React.Dispatch<React.SetStateAction<Event | null>>;
    selectedFiles: Map<string, File>;
    setSelectedFiles: React.Dispatch<React.SetStateAction<Map<string, File>>>;
    filesToDelete: Set<string>;
    setFilesToDelete: React.Dispatch<React.SetStateAction<Set<string>>>;
    handlePreviewFile: (url: string, filename: string) => void;
    isSubmitting: boolean;
    fileManager: FileManager;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onCancel: () => void;
}

// Create a memoized form component
const EventForm = memo(({
    event,
    setEvent,
    selectedFiles,
    setSelectedFiles,
    filesToDelete,
    setFilesToDelete,
    handlePreviewFile,
    isSubmitting,
    fileManager,
    onSubmit,
    onCancel
}: EventFormProps): React.ReactElement => {
    return (
        <div id="editFormSection">
            <h3 className="font-bold text-lg mb-4" id="editModalTitle">
                {event?.id ? 'Edit Event' : 'Add New Event'}
            </h3>
            <form
                id="editEventForm"
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!isSubmitting) {
                        onSubmit(e);
                    }
                }}
            >
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
                        name="editEventFiles"
                        onChange={(e) => {
                            if (e.target.files) {
                                const newFiles = new Map(selectedFiles);
                                Array.from(e.target.files).forEach(file => {
                                    newFiles.set(file.name, file);
                                });
                                setSelectedFiles(newFiles);
                            }
                        }}
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
                                                        onClick={() => {
                                                            const newFilesToDelete = new Set(filesToDelete);
                                                            newFilesToDelete.delete(filename);
                                                            setFilesToDelete(newFilesToDelete);
                                                        }}
                                                    >
                                                        Undo
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn btn-ghost btn-xs text-error"
                                                        onClick={() => {
                                                            const newFilesToDelete = new Set(filesToDelete);
                                                            newFilesToDelete.add(filename);
                                                            setFilesToDelete(newFilesToDelete);
                                                        }}
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

                {/* Action Buttons */}
                <div className="modal-action mt-6">
                    <button
                        type="submit"
                        className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                        type="button"
                        className="btn"
                        onClick={onCancel}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
});

// Add new interfaces for change tracking
interface EventChanges {
    event_name?: string;
    event_description?: string;
    event_code?: string;
    location?: string;
    points_to_reward?: number;
    start_date?: string;
    end_date?: string;
    published?: boolean;
    has_food?: boolean;
}

interface FileChanges {
    added: Map<string, File>;
    deleted: Set<string>;
    unchanged: string[];
}

// Add queue management for large datasets
class UploadQueue {
    private queue: Array<() => Promise<void>> = [];
    private processing = false;
    private readonly BATCH_SIZE = 5;

    async add(task: () => Promise<void>) {
        this.queue.push(task);
        if (!this.processing) {
            await this.process();
        }
    }

    private async process() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;
        try {
            while (this.queue.length > 0) {
                const batch = this.queue.splice(0, this.BATCH_SIZE);
                await Promise.all(batch.map(task => task()));
            }
        } finally {
            this.processing = false;
        }
    }
}

// Add change tracking utility
class ChangeTracker {
    private initialState: Event | null = null;
    private currentState: Event | null = null;
    private fileChanges: FileChanges = {
        added: new Map(),
        deleted: new Set(),
        unchanged: []
    };

    initialize(event: Event | null) {
        this.initialState = event ? { ...event } : null;
        this.currentState = event ? { ...event } : null;
        this.fileChanges = {
            added: new Map(),
            deleted: new Set(),
            unchanged: event?.files || []
        };
    }

    trackChange(field: keyof Event, value: any) {
        if (!this.currentState) {
            this.currentState = {} as Event;
        }
        (this.currentState as any)[field] = value;
    }

    trackFileChange(added: Map<string, File>, deleted: Set<string>) {
        this.fileChanges.added = added;
        this.fileChanges.deleted = deleted;
        if (this.initialState?.files) {
            this.fileChanges.unchanged = this.initialState.files.filter(
                file => !deleted.has(file)
            );
        }
    }

    getChanges(): EventChanges {
        if (!this.initialState || !this.currentState) return {};

        const changes: EventChanges = {};
        const fields: (keyof EventChanges)[] = [
            'event_name',
            'event_description',
            'event_code',
            'location',
            'points_to_reward',
            'start_date',
            'end_date',
            'published',
            'has_food'
        ];

        for (const field of fields) {
            if (this.initialState[field] !== this.currentState[field]) {
                (changes[field] as any) = this.currentState[field];
            }
        }

        return changes;
    }

    getFileChanges(): FileChanges {
        return this.fileChanges;
    }

    hasChanges(): boolean {
        return Object.keys(this.getChanges()).length > 0 ||
            this.fileChanges.added.size > 0 ||
            this.fileChanges.deleted.size > 0;
    }
}

// Modify EventEditor component to use optimizations
export default function EventEditor({ onEventSaved }: EventEditorProps) {
    // State for form data and UI
    const [event, setEvent] = useState<Event | null>(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewFilename, setPreviewFilename] = useState("");
    const [showPreview, setShowPreview] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<Map<string, File>>(new Map());
    const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Add new state and utilities
    const changeTracker = useMemo(() => new ChangeTracker(), []);
    const uploadQueue = useMemo(() => new UploadQueue(), []);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Memoize service instances
    const services = useMemo(() => ({
        get: Get.getInstance(),
        auth: Authentication.getInstance(),
        update: Update.getInstance(),
        fileManager: FileManager.getInstance(),
        sendLog: SendLog.getInstance()
    }), []);

    // Memoize handlers
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(prev => {
                const newFiles = new Map(prev);
                Array.from(e.target.files!).forEach(file => {
                    newFiles.set(file.name, file);
                });
                return newFiles;
            });
        }
    }, []);

    const handleFileDelete = useCallback((filename: string) => {
        if (confirm("Are you sure you want to remove this file?")) {
            setFilesToDelete(prev => new Set([...prev, filename]));
        }
    }, []);

    const handleUndoFileDelete = useCallback((filename: string) => {
        setFilesToDelete(prev => {
            const newSet = new Set(prev);
            newSet.delete(filename);
            return newSet;
        });
    }, []);

    const handlePreviewFile = useCallback((url: string, filename: string) => {
        setPreviewUrl(url);
        setPreviewFilename(filename);
        setShowPreview(true);
    }, []);

    // Add modal close handling
    const handleModalClose = useCallback(async (e?: MouseEvent | React.MouseEvent) => {
        if (e) e.preventDefault();

        if (hasUnsavedChanges) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
            if (!confirmed) return;
        }

        // Reset all state
        setEvent(null);
        setSelectedFiles(new Map());
        setFilesToDelete(new Set());
        setShowPreview(false);
        setHasUnsavedChanges(false);
        changeTracker.initialize(null);

        // Close the modal
        const modal = document.getElementById("editEventModal") as HTMLDialogElement;
        if (modal) modal.close();
    }, [hasUnsavedChanges, changeTracker]);

    // Update the EventForm cancel button handler
    const handleCancel = useCallback(() => {
        handleModalClose();
    }, [handleModalClose]);

    // Modify form submission to use the new close handler
    const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        const form = e.target as HTMLFormElement;
        const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        const cancelButton = form.querySelector('button[type="button"]') as HTMLButtonElement;

        if (!changeTracker.hasChanges()) {
            handleModalClose();
            return;
        }

        setIsSubmitting(true);
        if (submitButton) submitButton.disabled = true;
        if (cancelButton) cancelButton.disabled = true;

        try {
            window.showLoading?.();
            const pb = services.auth.getPocketBase();

            if (event?.id) {
                // Handle existing event update
                const changes = changeTracker.getChanges();
                const fileChanges = changeTracker.getFileChanges();

                // Process files in parallel
                const fileProcessingTasks: Promise<any>[] = [];

                // Handle file deletions
                if (fileChanges.deleted.size > 0) {
                    const deletePromises = Array.from(fileChanges.deleted).map(filename =>
                        uploadQueue.add(async () => {
                            await services.sendLog.send(
                                "delete",
                                "event_file",
                                `Deleted file ${filename} from event ${event.event_name}`
                            );
                        })
                    );
                    fileProcessingTasks.push(...deletePromises);
                }

                // Handle file additions
                if (fileChanges.added.size > 0) {
                    const uploadTasks = Array.from(fileChanges.added.values()).map(file =>
                        uploadQueue.add(async () => {
                            const formData = new FormData();
                            formData.append("files", file);
                            await pb.collection("events").update(event.id, formData);
                        })
                    );
                    fileProcessingTasks.push(...uploadTasks);
                }

                // Update event data if there are changes
                if (Object.keys(changes).length > 0) {
                    await services.update.updateFields("events", event.id, changes);
                    await services.sendLog.send(
                        "update",
                        "event",
                        `Updated event: ${changes.event_name || event.event_name}`
                    );
                }

                // Wait for all file operations to complete
                await Promise.all(fileProcessingTasks);
            } else {
                // Handle new event creation
                const formData = new FormData(form);
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
                    attendees: []
                };

                // Create event and upload files in parallel
                const [newEvent] = await Promise.all([
                    pb.collection("events").create(eventData),
                    ...Array.from(selectedFiles.values()).map(file =>
                        uploadQueue.add(async () => {
                            const fileFormData = new FormData();
                            fileFormData.append("files", file);
                            await pb.collection("events").update(newEvent.id, fileFormData);
                        })
                    )
                ]);

                await services.sendLog.send(
                    "create",
                    "event",
                    `Created event: ${eventData.event_name}`
                );
            }

            // Show success state
            if (submitButton) {
                submitButton.classList.remove("btn-disabled");
                submitButton.classList.add("btn-success");
                submitButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                `;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            form.reset();
            onEventSaved?.();
            handleModalClose();
        } catch (error) {
            console.error("Failed to save event:", error);
            if (submitButton) {
                submitButton.classList.remove("btn-disabled");
                submitButton.classList.add("btn-error");
                submitButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    </svg>
                `;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            alert("Failed to save event. Please try again.");
        } finally {
            setIsSubmitting(false);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.classList.remove("btn-disabled", "btn-success", "btn-error");
                submitButton.innerHTML = 'Save Changes';
            }
            if (cancelButton) cancelButton.disabled = false;
            window.hideLoading?.();
        }
    }, [event, selectedFiles, filesToDelete, services, onEventSaved, isSubmitting, changeTracker, uploadQueue, handleModalClose]);

    // Update change tracking when event data changes
    useEffect(() => {
        changeTracker.initialize(event);
        setHasUnsavedChanges(false);
    }, [event, changeTracker]);

    // Add change detection to form inputs
    const handleFieldChange = useCallback((field: keyof Event, value: any) => {
        changeTracker.trackChange(field, value);
        setHasUnsavedChanges(true);
        setEvent(prev => prev ? { ...prev, [field]: value } : null);
    }, [changeTracker]);

    // Add change detection to file operations
    const handleFileChange = useCallback((files: Map<string, File>, deletedFiles: Set<string>) => {
        changeTracker.trackFileChange(files, deletedFiles);
        setHasUnsavedChanges(true);
        setSelectedFiles(files);
        setFilesToDelete(deletedFiles);
    }, [changeTracker]);

    // Add unsaved changes warning
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // Method to initialize form with event data
    const initializeEventData = async (eventId: string) => {
        try {
            const eventData = await services.get.getOne<Event>("events", eventId);
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

    // Add modal close event listener
    useEffect(() => {
        const modal = document.getElementById("editEventModal") as HTMLDialogElement;
        if (modal) {
            const closeHandler = (e: { preventDefault: () => void }) => {
                if (isSubmitting) {
                    e.preventDefault();
                    return;
                }
                handleModalClose();
            };

            modal.addEventListener('close', closeHandler);
            return () => modal.removeEventListener('close', closeHandler);
        }
    }, [handleModalClose, isSubmitting]);

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
                        <MemoizedFilePreview
                            url={previewUrl}
                            filename={previewFilename}
                            isModal={false}
                        />
                    </div>
                </div>
            ) : (
                <div className="modal-box max-w-2xl">
                    <EventForm
                        event={event}
                        setEvent={setEvent}
                        selectedFiles={selectedFiles}
                        setSelectedFiles={setSelectedFiles}
                        filesToDelete={filesToDelete}
                        setFilesToDelete={setFilesToDelete}
                        handlePreviewFile={handlePreviewFile}
                        isSubmitting={isSubmitting}
                        fileManager={services.fileManager}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                    />
                </div>
            )}
            <div
                className="modal-backdrop"
                onClick={(e: React.MouseEvent) => handleModalClose(e)}
            >
                <button onClick={(e) => e.preventDefault()}>close</button>
            </div>
        </dialog>
    );
}
