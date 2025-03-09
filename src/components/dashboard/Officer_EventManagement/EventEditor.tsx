import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Icon } from "@iconify/react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { Update } from "../../../scripts/pocketbase/Update";
import { FileManager } from "../../../scripts/pocketbase/FileManager";
import { SendLog } from "../../../scripts/pocketbase/SendLog";
import FilePreview from "../universal/FilePreview";
import type { Event as SchemaEvent, AttendeeEntry } from "../../../schemas/pocketbase";
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Collections } from '../../../schemas/pocketbase/schema';
import toast from "react-hot-toast";

// Note: Date conversion is now handled automatically by the Get and Update classes.
// When fetching events, UTC dates are converted to local time by the Get class.
// When saving events, local dates are converted back to UTC by the Update class.
// For datetime-local inputs, we format dates without seconds (YYYY-MM-DDThh:mm).

// Extended Event interface with optional created and updated fields
interface Event extends Omit<SchemaEvent, 'created' | 'updated'> {
    created?: string;
    updated?: string;
}

// Extend Window interface
declare global {
    interface Window {
        showLoading?: () => void;
        hideLoading?: () => void;
        lastCacheUpdate?: number;
        fetchEvents?: () => void;
    }
}

interface EventEditorProps {
    onEventSaved?: () => void;
}

// Memoize the FilePreview component
const MemoizedFilePreview = memo(FilePreview);

// Define EventForm props interface
interface EventFormProps {
    event: Event | null;
    setEvent: (field: keyof Event, value: any) => void;
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
    const handleChange = (field: keyof Event, value: any) => {
        setEvent(field, value);
    };

    return (
        <div id="editFormSection">
            <h3 className="font-bold text-lg mb-4" id="editModalTitle">
                {event?.id ? 'Edit Event' : 'Add New Event'}
            </h3>
            <form
                id="editEventForm"
                className="space-y-4"
                onSubmit={onSubmit}
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
                            onChange={(e) => handleChange('event_name', e.target.value)}
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
                            onChange={(e) => handleChange('event_code', e.target.value)}
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
                            onChange={(e) => handleChange('location', e.target.value)}
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
                            onChange={(e) => handleChange('points_to_reward', Number(e.target.value))}
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
                            value={event?.start_date || ""}
                            onChange={(e) => handleChange('start_date', e.target.value)}
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
                            value={event?.end_date || ""}
                            onChange={(e) => handleChange('end_date', e.target.value)}
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
                        onChange={(e) => handleChange('event_description', e.target.value)}
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
                                const rejectedFiles: { name: string, reason: string }[] = [];
                                const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

                                Array.from(e.target.files).forEach(file => {
                                    // Validate file size
                                    if (file.size > MAX_FILE_SIZE) {
                                        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                                        rejectedFiles.push({
                                            name: file.name,
                                            reason: `exceeds size limit (${fileSizeMB}MB > 200MB)`
                                        });
                                        return;
                                    }

                                    // Validate file type
                                    const validation = fileManager.validateFileType(file);
                                    if (!validation.valid) {
                                        rejectedFiles.push({
                                            name: file.name,
                                            reason: validation.reason || 'unsupported file type'
                                        });
                                        return;
                                    }

                                    // Only add valid files
                                    newFiles.set(file.name, file);
                                });

                                // Show error for rejected files
                                if (rejectedFiles.length > 0) {
                                    const errorMessage = `The following files were not added:\n${rejectedFiles.map(f => `${f.name}: ${f.reason}`).join('\n')}`;
                                    toast.error(errorMessage);
                                }

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
                                        <Icon icon="heroicons:x-circle" className="h-4 w-4" />
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
                                                <Icon icon="heroicons:eye" className="h-4 w-4" />
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
                                                        <Icon icon="heroicons:trash" className="h-4 w-4" />
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
                                                        <Icon icon="heroicons:trash" className="h-4 w-4" />
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
                            onChange={(e) => handleChange('published', e.target.checked)}
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
                            onChange={(e) => handleChange('has_food', e.target.checked)}
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

// Add new interfaces for loading states
interface LoadingState {
    isLoading: boolean;
    error: string | null;
    timeoutId: NodeJS.Timeout | null;
}

// Add loading spinner component
const LoadingSpinner = memo(() => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="loading loading-spinner loading-lg text-primary"></div>
        <p className="text-base-content/70">Loading event data...</p>
    </div>
));

// Add error display component
const ErrorDisplay = memo(({ error, onRetry }: { error: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="text-error">
            <Icon icon="heroicons:x-circle" className="h-12 w-12" />
        </div>
        <p className="text-error font-medium">{error}</p>
        <button className="btn btn-error btn-sm" onClick={onRetry}>
            Try Again
        </button>
    </div>
));

// Modify EventEditor component
export default function EventEditor({ onEventSaved }: EventEditorProps) {
    // State for form data and UI
    const [event, setEvent] = useState<Event>({
        id: "",
        created: "",
        updated: "",
        event_name: "",
        event_description: "",
        event_code: "",
        location: "",
        files: [],
        points_to_reward: 0,
        start_date: "",
        end_date: "",
        published: false,
        has_food: false
    });

    const [previewUrl, setPreviewUrl] = useState("");
    const [previewFilename, setPreviewFilename] = useState("");
    const [showPreview, setShowPreview] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<Map<string, File>>(new Map());
    const [filesToDelete, setFilesToDelete] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Memoize service instances
    const services = useMemo(() => ({
        get: Get.getInstance(),
        auth: Authentication.getInstance(),
        update: Update.getInstance(),
        fileManager: FileManager.getInstance(),
        sendLog: SendLog.getInstance()
    }), []);

    // Handle field changes
    const handleFieldChange = useCallback((field: keyof Event, value: any) => {
        setEvent(prev => {
            const newEvent = { ...prev, [field]: value };
            // Only set hasUnsavedChanges if the value actually changed
            if (prev[field] !== value) {
                setHasUnsavedChanges(true);
            }
            return newEvent;
        });
    }, []);

    // Initialize event data
    const initializeEventData = useCallback(async (eventId: string) => {
        try {
            if (eventId) {
                // Clear cache to ensure fresh data
                const dataSync = DataSyncService.getInstance();
                await dataSync.clearCache();

                // Fetch fresh event data
                const eventData = await services.get.getOne<Event>(Collections.EVENTS, eventId);

                if (!eventData) {
                    throw new Error("Event not found");
                }

                // Ensure dates are properly formatted for datetime-local input
                if (eventData.start_date) {
                    // Convert to Date object first to ensure proper formatting
                    const startDate = new Date(eventData.start_date);
                    eventData.start_date = Get.formatLocalDate(startDate, false);
                }

                if (eventData.end_date) {
                    // Convert to Date object first to ensure proper formatting
                    const endDate = new Date(eventData.end_date);
                    eventData.end_date = Get.formatLocalDate(endDate, false);
                }

                // Ensure all fields are properly set
                setEvent({
                    id: eventData.id || '',
                    created: eventData.created || '',
                    updated: eventData.updated || '',
                    event_name: eventData.event_name || '',
                    event_description: eventData.event_description || '',
                    event_code: eventData.event_code || '',
                    location: eventData.location || '',
                    files: eventData.files || [],
                    points_to_reward: eventData.points_to_reward || 0,
                    start_date: eventData.start_date || '',
                    end_date: eventData.end_date || '',
                    published: eventData.published || false,
                    has_food: eventData.has_food || false
                });

                // console.log("Event data loaded successfully:", eventData);
            } else {
                setEvent({
                    id: '',
                    created: '',
                    updated: '',
                    event_name: '',
                    event_description: '',
                    event_code: '',
                    location: '',
                    files: [],
                    points_to_reward: 0,
                    start_date: '',
                    end_date: '',
                    published: false,
                    has_food: false
                });
            }
            setSelectedFiles(new Map());
            setFilesToDelete(new Set());
            setShowPreview(false);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error("Failed to initialize event data:", error);
            toast.error("Failed to load event data. Please try again.");
        }
    }, [services.get]);

    // Expose initializeEventData to window
    useEffect(() => {
        (window as any).openEditModal = async (event?: Event) => {
            const modal = document.getElementById("editEventModal") as HTMLDialogElement;
            if (!modal) return;

            try {
                if (event?.id) {
                    // Always fetch fresh data from PocketBase for the event
                    await initializeEventData(event.id);
                } else {
                    // Reset form for new event
                    await initializeEventData('');
                }
                modal.showModal();
            } catch (error) {
                console.error("Failed to open edit modal:", error);
                toast.error("Failed to open edit modal. Please try again.");
            }
        };

        return () => {
            delete (window as any).openEditModal;
        };
    }, [initializeEventData]);

    // Handler functions
    const handlePreviewFile = useCallback((url: string, filename: string) => {
        setPreviewUrl(url);
        setPreviewFilename(filename);
        setShowPreview(true);
    }, []);

    const handleModalClose = useCallback(() => {
        if (hasUnsavedChanges && !isSubmitting) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
            if (!confirmed) return;
        }

        setEvent({
            id: "",
            created: "",
            updated: "",
            event_name: "",
            event_description: "",
            event_code: "",
            location: "",
            files: [],
            points_to_reward: 0,
            start_date: "",
            end_date: "",
            published: false,
            has_food: false
        });
        setSelectedFiles(new Map());
        setFilesToDelete(new Set());
        setShowPreview(false);
        setPreviewUrl("");
        setPreviewFilename("");

        const modal = document.getElementById("editEventModal") as HTMLDialogElement;
        if (modal) modal.close();
    }, [hasUnsavedChanges, isSubmitting]);

    // Function to close modal after saving (without confirmation)
    const closeModalAfterSave = useCallback(() => {
        setEvent({
            id: "",
            created: "",
            updated: "",
            event_name: "",
            event_description: "",
            event_code: "",
            location: "",
            files: [],
            points_to_reward: 0,
            start_date: "",
            end_date: "",
            published: false,
            has_food: false
        });
        setSelectedFiles(new Map());
        setFilesToDelete(new Set());
        setShowPreview(false);
        setPreviewUrl("");
        setPreviewFilename("");

        const modal = document.getElementById("editEventModal") as HTMLDialogElement;
        if (modal) modal.close();
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        try {
            setIsSubmitting(true);
            window.showLoading?.();

            const submitButton = document.getElementById("submitEventButton") as HTMLButtonElement;
            const cancelButton = document.getElementById("cancelEventButton") as HTMLButtonElement;

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.classList.add("btn-disabled");
            }
            if (cancelButton) cancelButton.disabled = true;

            // Get form data
            const formData = new FormData(e.currentTarget);

            // Create updated event object
            const updatedEvent: Omit<Event, 'created' | 'updated'> = {
                id: event.id,
                event_name: formData.get("editEventName") as string,
                event_description: formData.get("editEventDescription") as string,
                event_code: formData.get("editEventCode") as string,
                location: formData.get("editEventLocation") as string,
                files: event.files || [],
                points_to_reward: parseInt(formData.get("editEventPoints") as string) || 0,
                start_date: formData.get("editEventStartDate") as string,
                end_date: formData.get("editEventEndDate") as string,
                published: formData.get("editEventPublished") === "on",
                has_food: formData.get("editEventHasFood") === "on"
            };

            // Log the update attempt
            await services.sendLog.send(
                "update",
                "event",
                `${event.id ? "Updating" : "Creating"} event: ${updatedEvent.event_name} (${event.id || "new"})`
            );

            if (event.id) {
                // We're updating an existing event

                // First, update the event data without touching files
                const { files, ...cleanPayload } = updatedEvent;
                await services.update.updateFields<Event>(
                    Collections.EVENTS,
                    event.id,
                    cleanPayload
                );

                // Handle file operations
                if (filesToDelete.size > 0 || selectedFiles.size > 0) {
                    // Get the current event with its files
                    const currentEvent = await services.get.getOne<Event>(Collections.EVENTS, event.id);
                    let currentFiles = currentEvent?.files || [];

                    // 1. Remove files marked for deletion
                    if (filesToDelete.size > 0) {
                        // console.log(`Removing ${filesToDelete.size} files from event ${event.id}`);
                        currentFiles = currentFiles.filter(file => !filesToDelete.has(file));

                        // Update the files field first to remove deleted files
                        await services.update.updateFields<Event>(
                            Collections.EVENTS,
                            event.id,
                            { files: currentFiles }
                        );
                    }

                    // 2. Add new files one by one to preserve existing ones
                    if (selectedFiles.size > 0) {
                        // console.log(`Adding ${selectedFiles.size} new files to event ${event.id}`);

                        // Convert Map to array of File objects
                        const newFiles = Array.from(selectedFiles.values());

                        // Use FileManager to upload each file individually
                        for (const file of newFiles) {
                            // Use the FileManager to upload this file
                            await services.fileManager.uploadFile(
                                Collections.EVENTS,
                                event.id,
                                'files',
                                file,
                                true  // Set append mode to true to preserve existing files
                            );
                        }
                    }
                }

                // Get the final updated event with all changes
                const savedEvent = await services.get.getOne<Event>(Collections.EVENTS, event.id);

                // Clear cache to ensure fresh data
                const dataSync = DataSyncService.getInstance();
                await dataSync.clearCache();

                // Update the window object with the latest event data
                const eventDataId = `event_${event.id}`;
                if ((window as any)[eventDataId]) {
                    (window as any)[eventDataId] = savedEvent;
                }

                toast.success("Event updated successfully!");

                // Call the onEventSaved callback if provided
                if (onEventSaved) onEventSaved();

                // Reset unsaved changes flag before closing
                setHasUnsavedChanges(false);

                // Close the modal
                closeModalAfterSave();

            } else {
                // We're creating a new event

                // Create the event first without files
                const { files, ...cleanPayload } = updatedEvent;
                const newEvent = await services.update.create<Event>(
                    Collections.EVENTS,
                    cleanPayload
                );

                // Then upload files if any
                if (selectedFiles.size > 0 && newEvent?.id) {
                    // console.log(`Adding ${selectedFiles.size} files to new event ${newEvent.id}`);

                    // Convert Map to array of File objects
                    const newFiles = Array.from(selectedFiles.values());

                    // Upload files to the new event
                    for (const file of newFiles) {
                        await services.fileManager.uploadFile(
                            Collections.EVENTS,
                            newEvent.id,
                            'files',
                            file,
                            true  // Set append mode to true
                        );
                    }
                }

                // Clear cache to ensure fresh data
                const dataSync = DataSyncService.getInstance();
                await dataSync.clearCache();

                toast.success("Event created successfully!");

                // Call the onEventSaved callback if provided
                if (onEventSaved) onEventSaved();

                // Reset unsaved changes flag before closing
                setHasUnsavedChanges(false);

                // Close the modal
                closeModalAfterSave();
            }

            // Refresh events list if available
            if (window.fetchEvents) window.fetchEvents();

        } catch (error) {
            console.error("Failed to save event:", error);
            toast.error(`Failed to save event: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
            window.hideLoading?.();
        }
    }, [event, selectedFiles, filesToDelete, services, onEventSaved, isSubmitting, closeModalAfterSave]);


    return (
        <dialog id="editEventModal" className="modal">
            {showPreview ? (
                <div className="modal-box max-w-4xl">
                    <div className="flex justify-between items-center mb-4">
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setShowPreview(false)}
                        >
                            Close
                        </button>
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
                    <EventForm
                        event={event}
                        setEvent={handleFieldChange}
                        selectedFiles={selectedFiles}
                        setSelectedFiles={setSelectedFiles}
                        filesToDelete={filesToDelete}
                        setFilesToDelete={setFilesToDelete}
                        handlePreviewFile={handlePreviewFile}
                        isSubmitting={isSubmitting}
                        fileManager={services.fileManager}
                        onSubmit={handleSubmit}
                        onCancel={handleModalClose}
                    />
                </div>
            )}
        </dialog>
    );
}
