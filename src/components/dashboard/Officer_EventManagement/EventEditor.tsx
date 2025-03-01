import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Icon } from "@iconify/react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { Update } from "../../../scripts/pocketbase/Update";
import { FileManager } from "../../../scripts/pocketbase/FileManager";
import { SendLog } from "../../../scripts/pocketbase/SendLog";
import FilePreview from "../universal/FilePreview";
import type { Event as SchemaEvent, AttendeeEntry } from "../../../schemas/pocketbase";

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
                            value={event?.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : ""}
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
                            value={event?.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : ""}
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
        id: '',
        event_name: '',
        event_description: '',
        event_code: '',
        location: '',
        files: [],
        points_to_reward: 0,
        start_date: new Date().toISOString(),
        end_date: new Date().toISOString(),
        published: false,
        has_food: false,
        attendees: []
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
                const eventData = await services.get.getOne<Event>("events", eventId);
                setEvent(eventData);
            } else {
                setEvent({
                    id: '',
                    event_name: '',
                    event_description: '',
                    event_code: '',
                    location: '',
                    files: [],
                    points_to_reward: 0,
                    start_date: new Date().toISOString(),
                    end_date: new Date().toISOString(),
                    published: false,
                    has_food: false,
                    attendees: []
                });
            }
            setSelectedFiles(new Map());
            setFilesToDelete(new Set());
            setShowPreview(false);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error("Failed to initialize event data:", error);
            alert("Failed to load event data. Please try again.");
        }
    }, [services.get]);

    // Expose initializeEventData to window
    useEffect(() => {
        (window as any).openEditModal = async (event?: Event) => {
            const modal = document.getElementById("editEventModal") as HTMLDialogElement;
            if (!modal) return;

            try {
                if (event?.id) {
                    await initializeEventData(event.id);
                } else {
                    await initializeEventData('');
                }
                modal.showModal();
            } catch (error) {
                console.error("Failed to open edit modal:", error);
                alert("Failed to open edit modal. Please try again.");
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
        if (hasUnsavedChanges) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
            if (!confirmed) return;
        }

        setEvent({
            id: '',
            event_name: '',
            event_description: '',
            event_code: '',
            location: '',
            files: [],
            points_to_reward: 0,
            start_date: new Date().toISOString(),
            end_date: new Date().toISOString(),
            published: false,
            has_food: false,
            attendees: []
        });
        setSelectedFiles(new Map());
        setFilesToDelete(new Set());
        setShowPreview(false);
        setHasUnsavedChanges(false);

        const modal = document.getElementById("editEventModal") as HTMLDialogElement;
        if (modal) modal.close();
    }, [hasUnsavedChanges]);

    const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        const form = e.target as HTMLFormElement;
        const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        const cancelButton = form.querySelector('button[type="button"]') as HTMLButtonElement;

        setIsSubmitting(true);
        if (submitButton) submitButton.disabled = true;
        if (cancelButton) cancelButton.disabled = true;

        try {
            window.showLoading?.();
            const pb = services.auth.getPocketBase();

            console.log('Form submission started');
            console.log('Event data:', event);

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
                attendees: event.attendees || []
            };

            if (event.id) {
                // Update existing event
                console.log('Updating event:', event.id);
                await services.update.updateFields("events", event.id, eventData);

                // Handle file deletions first
                if (filesToDelete.size > 0) {
                    console.log('Deleting files:', Array.from(filesToDelete));
                    // Get current files
                    const currentRecord = await pb.collection("events").getOne(event.id);
                    let remainingFiles = [...currentRecord.files];

                    // Remove files marked for deletion
                    for (const filename of filesToDelete) {
                        const fileIndex = remainingFiles.indexOf(filename);
                        if (fileIndex > -1) {
                            remainingFiles.splice(fileIndex, 1);
                        }
                    }

                    // Update record with remaining files
                    await pb.collection("events").update(event.id, {
                        files: remainingFiles
                    });
                }

                // Handle file additions
                if (selectedFiles.size > 0) {
                    try {
                        // Convert Map to array of Files
                        const filesToUpload = Array.from(selectedFiles.values());
                        console.log('Uploading files:', filesToUpload.map(f => f.name));

                        // Use appendFiles to preserve existing files
                        await services.fileManager.appendFiles("events", event.id, "files", filesToUpload);
                    } catch (error: any) {
                        if (error.status === 413) {
                            throw new Error("Files are too large. Please try uploading smaller files or fewer files at once.");
                        }
                        throw error;
                    }
                }
            } else {
                // Create new event
                console.log('Creating new event');
                const newEvent = await pb.collection("events").create(eventData);
                console.log('New event created:', newEvent);

                // Upload files if any
                if (selectedFiles.size > 0) {
                    try {
                        const filesToUpload = Array.from(selectedFiles.values());
                        console.log('Uploading files:', filesToUpload.map(f => f.name));

                        // Use uploadFiles for new event
                        await services.fileManager.uploadFiles("events", newEvent.id, "files", filesToUpload);
                    } catch (error: any) {
                        if (error.status === 413) {
                            throw new Error("Files are too large. Please try uploading smaller files or fewer files at once.");
                        }
                        throw error;
                    }
                }
            }

            // Show success message
            if (submitButton) {
                submitButton.classList.remove("btn-disabled");
                submitButton.classList.add("btn-success");
                const successIcon = document.createElement('span');
                successIcon.innerHTML = '<i class="iconify" data-icon="heroicons:check" style="width: 20px; height: 20px;"></i>';
                submitButton.textContent = '';
                submitButton.appendChild(successIcon);
            }

            // Reset all state
            setHasUnsavedChanges(false);
            setSelectedFiles(new Map());
            setFilesToDelete(new Set());
            setEvent({
                id: '',
                event_name: '',
                event_description: '',
                event_code: '',
                location: '',
                files: [],
                points_to_reward: 0,
                start_date: new Date().toISOString(),
                end_date: new Date().toISOString(),
                published: false,
                has_food: false,
                attendees: []
            });

            // Reset cache timestamp to force refresh
            if (window.lastCacheUpdate) {
                window.lastCacheUpdate = 0;
            }

            // Trigger the callback
            onEventSaved?.();

            // Close modal directly instead of using handleModalClose
            const modal = document.getElementById("editEventModal") as HTMLDialogElement;
            if (modal) modal.close();

            // Force refresh of events list
            if (typeof window.fetchEvents === 'function') {
                window.fetchEvents();
            }
        } catch (error: any) {
            console.error("Failed to save event:", error);
            if (submitButton) {
                submitButton.classList.remove("btn-disabled");
                submitButton.classList.add("btn-error");
                const errorIcon = document.createElement('span');
                errorIcon.innerHTML = '<i class="iconify" data-icon="heroicons:x-circle" style="width: 20px; height: 20px;"></i>';
                submitButton.textContent = '';
                submitButton.appendChild(errorIcon);
            }
            alert(error.message || "Failed to save event. Please try again.");
        } finally {
            setIsSubmitting(false);
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.classList.remove("btn-disabled", "btn-success", "btn-error");
                submitButton.textContent = 'Save Changes';
            }
            if (cancelButton) cancelButton.disabled = false;
            window.hideLoading?.();
        }
    }, [event, selectedFiles, filesToDelete, services, onEventSaved, isSubmitting]);

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
