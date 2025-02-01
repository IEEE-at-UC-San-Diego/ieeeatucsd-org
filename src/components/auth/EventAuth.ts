import PocketBase from "pocketbase";
import type { RecordModel } from "pocketbase";
import yaml from "js-yaml";
import configYaml from "../../data/storeConfig.yaml?raw";
import JSZip from 'jszip';

// Configuration type definitions
interface Config {
  api: {
    baseUrl: string;
  };
  ui: {
    messages: {
      event: {
        saving: string;
        success: string;
        error: string;
        deleting: string;
        deleteSuccess: string;
        deleteError: string;
        messageTimeout: number;
      };
    };
    tables: {
      events: {
        title: string;
        columns: {
          event_name: string;
          event_id: string;
          event_code: string;
          start_date: string;
          end_date: string;
          points_to_reward: string;
          location: string;
          registered_users: string;
          actions: string;
        };
        form: {
          buttons: {
            edit: string;
            delete: string;
          };
        };
      };
    };
    defaults: {
      pageSize: number;
      sortField: string;
    };
  };
}

// Parse YAML configuration with type
const config = yaml.load(configYaml) as Config;
const { columns, form } = config.ui.tables.events;

interface Event {
  id: string;
  event_id: string;
  event_name: string;
  event_code: string;
  attendees: string; // JSON string of attendee IDs
  points_to_reward: number;
  start_date: string;
  end_date: string;
  location: string;
  files: string[]; // Array of file URLs
  collectionId: string;
  collectionName: string;
}

interface AuthElements {
  eventList: HTMLTableSectionElement;
  eventSearch: HTMLInputElement;
  searchEvents: HTMLButtonElement;
  addEvent: HTMLButtonElement;
  eventEditor: HTMLDialogElement;
  editorEventId: HTMLInputElement;
  editorEventName: HTMLInputElement;
  editorEventCode: HTMLInputElement;
  editorStartDate: HTMLInputElement;
  editorStartTime: HTMLInputElement;
  editorEndDate: HTMLInputElement;
  editorEndTime: HTMLInputElement;
  editorPointsToReward: HTMLInputElement;
  editorLocation: HTMLInputElement;
  editorFiles: HTMLInputElement;
  currentFiles: HTMLDivElement;
  saveEventButton: HTMLButtonElement;
}

interface ValidationErrors {
  eventId?: string;
  eventName?: string;
  eventCode?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  points?: string;
}

export class EventAuth {
  private pb: PocketBase;
  private elements: AuthElements;
  private cachedEvents: Event[] = [];
  private abortController: AbortController | null = null;
  private currentUploadXHR: XMLHttpRequest | null = null;

  constructor() {
    this.pb = new PocketBase(config.api.baseUrl);
    this.elements = this.getElements();
    this.init();
  }

  private getElements(): AuthElements {
    const eventList = document.getElementById("eventList") as HTMLTableSectionElement;
    const eventSearch = document.getElementById("eventSearch") as HTMLInputElement;
    const searchEvents = document.getElementById("searchEvents") as HTMLButtonElement;
    const addEvent = document.getElementById("addEvent") as HTMLButtonElement;
    const eventEditor = document.getElementById("eventEditor") as HTMLDialogElement;
    const editorEventId = document.getElementById("editorEventId") as HTMLInputElement;
    const editorEventName = document.getElementById("editorEventName") as HTMLInputElement;
    const editorEventCode = document.getElementById("editorEventCode") as HTMLInputElement;
    const editorStartDate = document.getElementById("editorStartDate") as HTMLInputElement;
    const editorStartTime = document.getElementById("editorStartTime") as HTMLInputElement;
    const editorEndDate = document.getElementById("editorEndDate") as HTMLInputElement;
    const editorEndTime = document.getElementById("editorEndTime") as HTMLInputElement;
    const editorPointsToReward = document.getElementById("editorPointsToReward") as HTMLInputElement;
    const editorLocation = document.getElementById("editorLocation") as HTMLInputElement;
    const editorFiles = document.getElementById("editorFiles") as HTMLInputElement;
    const currentFiles = document.getElementById("currentFiles") as HTMLDivElement;
    const saveEventButton = document.getElementById("saveEventButton") as HTMLButtonElement;

    if (
      !eventList ||
      !eventSearch ||
      !searchEvents ||
      !addEvent ||
      !eventEditor ||
      !editorEventId ||
      !editorEventName ||
      !editorEventCode ||
      !editorStartDate ||
      !editorStartTime ||
      !editorEndDate ||
      !editorEndTime ||
      !editorPointsToReward ||
      !editorLocation ||
      !editorFiles ||
      !currentFiles ||
      !saveEventButton
    ) {
      throw new Error("Required DOM elements not found");
    }

    return {
      eventList,
      eventSearch,
      searchEvents,
      addEvent,
      eventEditor,
      editorEventId,
      editorEventName,
      editorEventCode,
      editorStartDate,
      editorStartTime,
      editorEndDate,
      editorEndTime,
      editorPointsToReward,
      editorLocation,
      editorFiles,
      currentFiles,
      saveEventButton,
    };
  }

  private getRegisteredUsersCount(registeredUsers: string): number {
    // Handle different cases for registered_users field
    if (!registeredUsers) return 0;
    
    try {
      // Try to parse if it's a JSON string
      const users = JSON.parse(registeredUsers);
      // Ensure users is an array
      if (!Array.isArray(users)) {
        return 0;
      }
      return users.length;
    } catch (err) {
      console.warn("Failed to parse registered_users, using 0");
      return 0;
    }
  }

  private parseArrayField(field: any, defaultValue: any[] = []): any[] {
    if (!field) return defaultValue;
    if (Array.isArray(field)) return field;
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : defaultValue;
    } catch (err) {
      console.warn("Failed to parse array field:", err);
      return defaultValue;
    }
  }

  private async fetchEvents(searchQuery: string = "") {
    try {
      // Only fetch from API if we don't have cached data
      if (this.cachedEvents.length === 0) {
        const records = await this.pb.collection("events").getList(1, config.ui.defaults.pageSize, {
          sort: config.ui.defaults.sortField,
        });
        this.cachedEvents = records.items as Event[];
      }

      // Filter cached data based on search query
      let filteredEvents = this.cachedEvents;
      if (searchQuery) {
        const terms = searchQuery.toLowerCase().split(" ").filter(term => term.length > 0);
        if (terms.length > 0) {
          filteredEvents = this.cachedEvents.filter(event => {
            return terms.every(term => 
              (event.event_name?.toLowerCase().includes(term) || 
               event.event_id?.toLowerCase().includes(term) || 
               event.event_code?.toLowerCase().includes(term) ||
               event.location?.toLowerCase().includes(term))
            );
          });
        }
      }

      const { eventList } = this.elements;
      const fragment = document.createDocumentFragment();

      if (filteredEvents.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td colspan="10" class="text-center py-4">
            ${searchQuery ? "No events found matching your search." : "No events found."}
          </td>
        `;
        fragment.appendChild(row);
      } else {
        filteredEvents.forEach((event) => {
          const row = document.createElement("tr");
          const startDate = event.start_date ? new Date(event.start_date).toLocaleString() : "N/A";
          const endDate = event.end_date ? new Date(event.end_date).toLocaleString() : "N/A";
          
          // Parse attendees using the new helper method
          const attendees = this.parseArrayField(event.attendees);
          const attendeeCount = attendees.length;

          // Handle files display
          const filesHtml = event.files && Array.isArray(event.files) && event.files.length > 0
            ? `<button class="btn btn-ghost btn-xs view-files w-24" data-event-id="${event.id}">${event.files.length} File${event.files.length > 1 ? 's' : ''}</button>`
            : '<span class="text-sm opacity-50">No files</span>';

          // Format dates for display
          const formatDateTime = (dateStr: string) => {
            if (!dateStr) return { dateDisplay: 'N/A', timeDisplay: 'N/A' };
            const date = new Date(dateStr);
            return {
              dateDisplay: date.toLocaleDateString(),
              timeDisplay: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
          };

          const startDateTime = formatDateTime(event.start_date);
          const endDateTime = formatDateTime(event.end_date);

          row.innerHTML = `
            <td class="block lg:table-cell">
              <!-- Mobile View -->
              <div class="lg:hidden space-y-2">
                <div class="font-medium text-center">${event.event_name || "N/A"}</div>
                <div class="text-sm opacity-70 text-center">${columns.event_id}: ${event.event_id || "N/A"}</div>
                <div class="text-sm opacity-70 text-center">${columns.event_code}: ${event.event_code || "N/A"}</div>
                <div class="text-sm opacity-70 text-center">${columns.start_date}: ${startDateTime.dateDisplay}<br>${startDateTime.timeDisplay}</div>
                <div class="text-sm opacity-70 text-center">${columns.end_date}: ${endDateTime.dateDisplay}<br>${endDateTime.timeDisplay}</div>
                <div class="text-sm opacity-70 text-center">${columns.points_to_reward}: ${event.points_to_reward || 0}</div>
                <div class="text-sm opacity-70 text-center">${columns.location}: ${event.location || "N/A"}</div>
                <div class="text-sm opacity-70 text-center">Files: ${filesHtml}</div>
                <div class="text-sm opacity-70 text-center">Attendees: ${attendeeCount}</div>
                <div class="flex items-center justify-center gap-2 mt-2">
                  <button class="btn btn-ghost btn-xs view-attendees" data-event-id="${event.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    View Attendees
                  </button>
                  <button class="btn btn-ghost btn-xs edit-event" data-event-id="${event.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    ${form.buttons.edit}
                  </button>
                  <button class="btn btn-ghost btn-xs text-error delete-event" data-event-id="${event.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    ${form.buttons.delete}
                  </button>
                </div>
              </div>

              <!-- Desktop View -->
              <span class="hidden lg:block text-center">${event.event_name || "N/A"}</span>
            </td>
            <td class="hidden lg:table-cell text-center">${event.event_id || "N/A"}</td>
            <td class="hidden lg:table-cell text-center">${event.event_code || "N/A"}</td>
            <td class="hidden lg:table-cell text-center">
              <div class="flex flex-col items-center">
                <span>${startDateTime.dateDisplay}</span>
                <span class="text-sm opacity-70">${startDateTime.timeDisplay}</span>
              </div>
            </td>
            <td class="hidden lg:table-cell text-center">
              <div class="flex flex-col items-center">
                <span>${endDateTime.dateDisplay}</span>
                <span class="text-sm opacity-70">${endDateTime.timeDisplay}</span>
              </div>
            </td>
            <td class="hidden lg:table-cell text-center">${event.points_to_reward || 0}</td>
            <td class="hidden lg:table-cell text-center">${event.location || "N/A"}</td>
            <td class="hidden lg:table-cell text-center">${filesHtml}</td>
            <td class="hidden lg:table-cell text-center">
              <button class="btn btn-ghost btn-xs view-attendees" data-event-id="${event.id}">
                <span class="mr-2">${attendeeCount}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </button>
            </td>
            <td class="hidden lg:table-cell text-center">
              <div class="flex justify-center gap-2">
                <button class="btn btn-ghost btn-xs edit-event" data-event-id="${event.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  ${form.buttons.edit}
                </button>
                <button class="btn btn-ghost btn-xs text-error delete-event" data-event-id="${event.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  ${form.buttons.delete}
                </button>
              </div>
            </td>
          `;

          fragment.appendChild(row);
        });
      }

      eventList.innerHTML = "";
      eventList.appendChild(fragment);

      // Setup event listeners for buttons
      const editButtons = eventList.querySelectorAll(".edit-event");
      editButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const eventId = (button as HTMLButtonElement).dataset.eventId;
          if (eventId) {
            this.handleEventEdit(eventId);
          }
        });
      });

      const deleteButtons = eventList.querySelectorAll(".delete-event");
      deleteButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const eventId = (button as HTMLButtonElement).dataset.eventId;
          if (eventId) {
            this.handleEventDelete(eventId);
          }
        });
      });

      const viewAttendeesButtons = eventList.querySelectorAll(".view-attendees");
      viewAttendeesButtons.forEach((button) => {
        button.addEventListener("click", () => {
          const eventId = (button as HTMLButtonElement).dataset.eventId;
          if (eventId) {
            this.handleViewAttendees(eventId);
          }
        });
      });

      const viewFilesButtons = eventList.querySelectorAll(".view-files");
      viewFilesButtons.forEach((button) => {
        button.addEventListener("click", async () => {
          const eventId = (button as HTMLButtonElement).dataset.eventId;
          if (eventId) {
            await this.handleViewFiles(eventId);
          }
        });
      });
    } catch (err) {
      console.error("Failed to fetch events:", err);
      const { eventList } = this.elements;
      eventList.innerHTML = `
        <tr>
          <td colspan="10" class="text-center py-4 text-error">
            Failed to fetch events. Please try again.
          </td>
        </tr>
      `;
    }
  }

  private splitDateTime(dateTimeStr: string): { date: string; time: string } {
    if (!dateTimeStr) return { date: "", time: "" };
    
    // Create a date object in local timezone
    const dateTime = new Date(dateTimeStr);
    
    // Format date as YYYY-MM-DD
    const date = dateTime.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
    
    // Format time as HH:mm
    const time = dateTime.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return { date, time };
  }

  private combineDateTime(date: string, time: string): string {
    if (!date || !time) return "";
    
    // Create a new Date object from the date and time strings
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    
    // Create date in local timezone
    const dateTime = new Date(year, month - 1, day, hours, minutes);
    
    // Format the date to ISO string with timezone offset
    return dateTime.toISOString();
  }

  private getFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      return decodeURIComponent(pathParts[pathParts.length - 1]);
    } catch (e) {
      // If URL parsing fails, try to get the filename from the path directly
      return url.split("/").pop() || "Unknown File";
    }
  }

  private async handleEventEdit(eventId: string) {
    try {
      const event = await this.pb.collection("events").getOne(eventId);
      const {
        eventEditor,
        editorEventId,
        editorEventName,
        editorEventCode,
        editorStartDate,
        editorStartTime,
        editorEndDate,
        editorEndTime,
        editorPointsToReward,
        editorLocation,
        currentFiles,
        saveEventButton,
      } = this.elements;

      // Split start and end dates into separate date and time
      const startDateTime = this.splitDateTime(event.start_date);
      const endDateTime = this.splitDateTime(event.end_date);

      // Populate the form
      editorEventId.value = event.event_id || "";
      editorEventName.value = event.event_name || "";
      editorEventCode.value = event.event_code || "";
      editorStartDate.value = startDateTime.date;
      editorStartTime.value = startDateTime.time;
      editorEndDate.value = endDateTime.date;
      editorEndTime.value = endDateTime.time;
      editorPointsToReward.value = event.points_to_reward?.toString() || "0";
      editorLocation.value = event.location || "";

      // Display current files
      this.updateFilesDisplay(event);

      // Update file input to support multiple files
      const fileInput = this.elements.editorFiles;
      fileInput.setAttribute('multiple', 'true');
      fileInput.setAttribute('accept', '*/*');

      // Store the event ID for saving
      saveEventButton.dataset.eventId = eventId;

      // Disable event_id field for existing events
      editorEventId.disabled = true;

      // Show the dialog
      eventEditor.showModal();
    } catch (err) {
      console.error("Failed to load event for editing:", err);
    }
  }

  private validateForm(): ValidationErrors | null {
    const {
      editorEventId,
      editorEventName,
      editorEventCode,
      editorStartDate,
      editorStartTime,
      editorEndDate,
      editorEndTime,
      editorPointsToReward,
    } = this.elements;

    const errors: ValidationErrors = {};

    // Reset all error messages
    const errorElements = document.querySelectorAll('.label-text-alt.text-error');
    errorElements.forEach(el => el.classList.add('hidden'));

    // Event ID validation
    if (!editorEventId.disabled) { // Only validate if it's a new event
      if (!editorEventId.value) {
        errors.eventId = "Event ID is required";
      } else if (!editorEventId.value.match(/^[A-Za-z0-9_-]+$/)) {
        errors.eventId = "Event ID can only contain letters, numbers, underscores, and hyphens";
      } else if (editorEventId.value.length < 3) {
        errors.eventId = "Event ID must be at least 3 characters";
      } else if (editorEventId.value.length > 50) {
        errors.eventId = "Event ID must be less than 50 characters";
      }
    }

    // Event Name validation
    if (!editorEventName.value) {
      errors.eventName = "Event Name is required";
    } else if (editorEventName.value.length < 3) {
      errors.eventName = "Event Name must be at least 3 characters";
    } else if (editorEventName.value.length > 100) {
      errors.eventName = "Event Name must be less than 100 characters";
    }

    // Event Code validation
    if (!editorEventCode.value) {
      errors.eventCode = "Event Code is required";
    } else if (!editorEventCode.value.match(/^[A-Za-z0-9_-]+$/)) {
      errors.eventCode = "Event Code can only contain letters, numbers, underscores, and hyphens";
    } else if (editorEventCode.value.length < 3) {
      errors.eventCode = "Event Code must be at least 3 characters";
    } else if (editorEventCode.value.length > 20) {
      errors.eventCode = "Event Code must be less than 20 characters";
    }

    // Date and Time validation
    if (!editorStartDate.value) {
      errors.startDate = "Start Date is required";
    }
    if (!editorStartTime.value) {
      errors.startTime = "Start Time is required";
    }
    if (!editorEndDate.value) {
      errors.endDate = "End Date is required";
    }
    if (!editorEndTime.value) {
      errors.endTime = "End Time is required";
    }

    // Validate that end date/time is after start date/time
    if (editorStartDate.value && editorStartTime.value && editorEndDate.value && editorEndTime.value) {
      const startDateTime = new Date(`${editorStartDate.value}T${editorStartTime.value}`);
      const endDateTime = new Date(`${editorEndDate.value}T${editorEndTime.value}`);
      
      if (endDateTime <= startDateTime) {
        errors.endDate = "End date/time must be after start date/time";
      }
    }

    // Points validation
    const points = parseInt(editorPointsToReward.value);
    if (!editorPointsToReward.value) {
      errors.points = "Points are required";
    } else if (isNaN(points) || points < 0) {
      errors.points = "Points must be a positive number";
    } else if (points > 1000) {
      errors.points = "Points must be less than 1000";
    }

    // Show error messages
    if (errors.eventId) {
      const errorEl = document.getElementById('eventIdError');
      if (errorEl) {
        errorEl.textContent = errors.eventId;
        errorEl.classList.remove('hidden');
      }
    }
    if (errors.eventName) {
      const errorEl = document.getElementById('eventNameError');
      if (errorEl) {
        errorEl.textContent = errors.eventName;
        errorEl.classList.remove('hidden');
      }
    }
    if (errors.eventCode) {
      const errorEl = document.getElementById('eventCodeError');
      if (errorEl) {
        errorEl.textContent = errors.eventCode;
        errorEl.classList.remove('hidden');
      }
    }
    if (errors.startDate) {
      const errorEl = document.getElementById('startDateError');
      if (errorEl) {
        errorEl.textContent = errors.startDate;
        errorEl.classList.remove('hidden');
      }
    }
    if (errors.startTime) {
      const errorEl = document.getElementById('startTimeError');
      if (errorEl) {
        errorEl.textContent = errors.startTime;
        errorEl.classList.remove('hidden');
      }
    }
    if (errors.endDate) {
      const errorEl = document.getElementById('endDateError');
      if (errorEl) {
        errorEl.textContent = errors.endDate;
        errorEl.classList.remove('hidden');
      }
    }
    if (errors.endTime) {
      const errorEl = document.getElementById('endTimeError');
      if (errorEl) {
        errorEl.textContent = errors.endTime;
        errorEl.classList.remove('hidden');
      }
    }
    if (errors.points) {
      const errorEl = document.getElementById('pointsError');
      if (errorEl) {
        errorEl.textContent = errors.points;
        errorEl.classList.remove('hidden');
      }
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  private async handleEventSave() {
    const {
      eventEditor,
      editorEventId,
      editorEventName,
      editorEventCode,
      editorStartDate,
      editorStartTime,
      editorEndDate,
      editorEndTime,
      editorPointsToReward,
      editorLocation,
      editorFiles,
      saveEventButton,
    } = this.elements;

    const eventId = saveEventButton.dataset.eventId;
    const isNewEvent = !eventId;

    // Validate form before proceeding
    const errors = this.validateForm();
    if (errors) {
      return; // Stop if there are validation errors
    }

    try {
      // Combine date and time inputs
      const startDateTime = this.combineDateTime(editorStartDate.value, editorStartTime.value);
      const endDateTime = this.combineDateTime(editorEndDate.value, editorEndTime.value);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append("event_name", editorEventName.value);
      formData.append("event_code", editorEventCode.value);
      formData.append("start_date", startDateTime);
      formData.append("end_date", endDateTime);
      formData.append("points_to_reward", editorPointsToReward.value);
      formData.append("location", editorLocation.value);

      // For new events, set event_id and initialize attendees as empty array
      if (isNewEvent) {
        formData.append("event_id", editorEventId.value);
        formData.append("attendees", "[]"); // Initialize with empty array
      } else {
        // For existing events, preserve current attendees and files
        const currentEvent = await this.pb.collection("events").getOne(eventId);
        const currentAttendees = this.parseArrayField(currentEvent.attendees, []);
        formData.append("attendees", JSON.stringify(currentAttendees));
        
        // Preserve existing files if no new files are being uploaded
        if (currentEvent.files && (!editorFiles.files || editorFiles.files.length === 0)) {
          formData.append("files", JSON.stringify(currentEvent.files));
        }
      }

      // Handle file uploads
      if (editorFiles.files && editorFiles.files.length > 0) {
        Array.from(editorFiles.files).forEach(file => {
          formData.append("files", file);
        });
      }

      if (isNewEvent) {
        await this.pb.collection("events").create(formData);
      } else {
        await this.pb.collection("events").update(eventId, formData);
      }

      // Close the dialog and refresh the table
      eventEditor.close();
      this.cachedEvents = []; // Clear cache to force refresh
      this.fetchEvents();
    } catch (err) {
      console.error("Failed to save event:", err);
    }
  }

  private async handleEventDelete(eventId: string) {
    if (confirm("Are you sure you want to delete this event?")) {
      try {
        await this.pb.collection("events").delete(eventId);
        this.cachedEvents = []; // Clear cache to force refresh
        this.fetchEvents();
      } catch (err) {
        console.error("Failed to delete event:", err);
      }
    }
  }

  private async handleViewAttendees(eventId: string) {
    try {
      const event = await this.pb.collection("events").getOne(eventId);
      const attendees = this.parseArrayField(event.attendees);

      // Fetch user details for each attendee
      const userDetails = await Promise.all(
        attendees.map(async (userId: string) => {
          try {
            const user = await this.pb.collection("users").getOne(userId);
            return {
              name: user.name || "N/A",
              email: user.email || "N/A",
              member_id: user.member_id || "N/A"
            };
          } catch (err) {
            console.warn(`Failed to fetch user ${userId}:`, err);
            return {
              name: "Unknown User",
              email: "N/A",
              member_id: "N/A"
            };
          }
        })
      );

      // Create and show modal
      const modal = document.createElement("dialog");
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modal-box max-w-3xl">
          <h3 class="font-bold text-lg mb-4">Attendees for ${event.event_name}</h3>
          <div class="form-control w-full mb-4">
            <input
              type="text"
              id="attendeeSearch"
              placeholder="Search attendees by name, email, or member ID..."
              class="input input-bordered input-sm w-full"
            />
          </div>
          <div class="overflow-x-auto max-h-[60vh]">
            <table class="table table-zebra w-full">
              <thead class="sticky top-0 bg-base-100">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Member ID</th>
                </tr>
              </thead>
              <tbody id="attendeeList">
                ${userDetails.length === 0 
                  ? '<tr><td colspan="3" class="text-center py-4">No attendees yet</td></tr>'
                  : userDetails.map(user => `
                      <tr class="attendee-row">
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.member_id}</td>
                      </tr>
                    `).join("")
                }
              </tbody>
            </table>
          </div>
          <div class="modal-action">
            <form method="dialog">
              <button class="btn">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      `;

      document.body.appendChild(modal);
      modal.showModal();

      // Add search functionality
      const searchInput = modal.querySelector("#attendeeSearch") as HTMLInputElement;
      const attendeeRows = modal.querySelectorAll(".attendee-row");

      if (searchInput) {
        searchInput.addEventListener("input", () => {
          const searchTerm = searchInput.value.toLowerCase();
          attendeeRows.forEach((row) => {
            const text = row.textContent?.toLowerCase() || "";
            if (text.includes(searchTerm)) {
              (row as HTMLElement).style.display = "";
            } else {
              (row as HTMLElement).style.display = "none";
            }
          });
        });
      }

      // Remove modal when closed
      modal.addEventListener("close", () => {
        document.body.removeChild(modal);
      });
    } catch (err) {
      console.error("Failed to view attendees:", err);
    }
  }

  private async syncAttendees() {
    try {
      // Cancel any existing sync operation
      if (this.abortController) {
        this.abortController.abort();
      }
      
      // Create new abort controller for this sync operation
      this.abortController = new AbortController();
      
      console.log("=== STARTING ATTENDEE SYNC ===");
      
      // Fetch all events first with abort signal
      const events = await this.pb.collection("events").getFullList({
        sort: config.ui.defaults.sortField,
        $cancelKey: "syncAttendees",
      });

      // Early return if aborted
      if (this.abortController.signal.aborted) {
        console.log("Sync operation was cancelled");
        return;
      }

      console.log("=== EVENTS DATA ===");
      events.forEach(event => {
        console.log(`Event: ${event.event_name} (ID: ${event.id})`);
        console.log("- event_id:", event.event_id);
        console.log("- Raw attendees field:", event.attendees);
      });

      // Create a map of event_id to event record for faster lookup
      const eventMap = new Map();
      events.forEach(event => {
        const currentAttendees = this.parseArrayField(event.attendees);
        console.log(`Parsed attendees for event ${event.event_name}:`, currentAttendees);

        eventMap.set(event.event_id, {
          id: event.id,
          event_id: event.event_id,
          event_name: event.event_name,
          attendees: new Set(currentAttendees)
        });
        console.log(`Mapped event ${event.event_name} with event_id ${event.event_id}`);
      });

      // Check if aborted before fetching users
      if (this.abortController.signal.aborted) {
        console.log("Sync operation was cancelled");
        return;
      }

      // Fetch all users with abort signal
      const users = await this.pb.collection("users").getFullList({
        fields: "id,name,email,member_id,events_attended",
        $cancelKey: "syncAttendees",
      });

      console.log("=== USERS DATA ===");
      users.forEach(user => {
        console.log(`User: ${user.name || 'Unknown'} (ID: ${user.id})`);
        console.log("- Raw events_attended:", user.events_attended);
      });

      // Process each user's events_attended
      for (const user of users) {
        // Check if aborted before processing each user
        if (this.abortController.signal.aborted) {
          console.log("Sync operation was cancelled");
          return;
        }

        console.log(`\nProcessing user: ${user.name || 'Unknown'} (ID: ${user.id})`);
        const eventsAttended = this.parseArrayField(user.events_attended);
        console.log("Parsed events_attended:", eventsAttended);

        // For each event the user attended
        for (const eventId of eventsAttended) {
          console.log(`\nChecking event ${eventId} for user ${user.id}`);
          
          // Find the event by event_id
          const eventRecord = eventMap.get(eventId);
          if (eventRecord) {
            console.log(`Found event record:`, eventRecord);
            // If user not already in attendees, add them
            if (!eventRecord.attendees.has(user.id)) {
              eventRecord.attendees.add(user.id);
              console.log(`Added user ${user.id} to event ${eventId}`);
            } else {
              console.log(`User ${user.id} already in event ${eventId}`);
            }
          } else {
            console.log(`Event ${eventId} not found in event map. Available event_ids:`, 
              Array.from(eventMap.keys()));
          }
        }
      }

      // Update all events with new attendee lists
      console.log("\n=== UPDATING EVENTS ===");
      for (const [eventId, record] of eventMap.entries()) {
        // Check if aborted before each update
        if (this.abortController.signal.aborted) {
          console.log("Sync operation was cancelled");
          return;
        }

        try {
          const attendeeArray = Array.from(record.attendees);
          console.log(`Updating event ${eventId}:`);
          console.log("- Current attendees:", attendeeArray);
          
          await this.pb.collection("events").update(record.id, {
            attendees: JSON.stringify(attendeeArray)
          }, {
            $cancelKey: "syncAttendees",
          });
          console.log(`Successfully updated event ${eventId}`);
        } catch (err: any) {
          if (err?.name === "AbortError") {
            console.log("Update was cancelled");
            return;
          }
          console.error(`Failed to update attendees for event ${eventId}:`, err);
          console.error("Failed record:", record);
        }
      }

      // Clear the cache to force a refresh of the events list
      this.cachedEvents = [];
      console.log("\n=== SYNC COMPLETE ===");
      await this.fetchEvents();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        console.log("Sync operation was cancelled");
        return;
      }
      console.error("Failed to sync attendees:", err);
      console.error("Full error:", err);
    } finally {
      // Clear the abort controller when done
      this.abortController = null;
    }
  }

  private cleanup() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async refreshEventsAndSync() {
    try {
      // Clear the cache to force a fresh fetch
      this.cachedEvents = [];

      // Check if user is authorized to sync
      const user = this.pb.authStore.model;
      if (user && (user.member_type === "IEEE Officer" || user.member_type === "IEEE Administrator")) {
        await this.syncAttendees().catch(console.error);
      } else {
        // If not authorized to sync, just refresh the events
        await this.fetchEvents();
      }
    } catch (err) {
      console.error("Failed to refresh events:", err);
    }
  }

  private init() {
    // Add file input change handler for automatic upload
    const fileInput = this.elements.editorFiles;

    // Add dialog close handler to cancel uploads
    this.elements.eventEditor.addEventListener('close', () => {
      if (this.currentUploadXHR) {
        this.currentUploadXHR.abort();
        this.currentUploadXHR = null;
        
        // Hide progress bar
        const progressContainer = document.getElementById('uploadProgress');
        if (progressContainer) {
          progressContainer.classList.add('hidden');
        }
        
        // Clear file input
        fileInput.value = '';
      }
    });

    fileInput.addEventListener('change', async () => {
      const selectedFiles = fileInput.files;
      if (selectedFiles && selectedFiles.length > 0) {
        try {
          // Validate file sizes
          const MAX_FILE_SIZE = 999999999; // ~1GB max per file (server limit)
          const MAX_TOTAL_SIZE = 999999999; // ~1GB max total (server limit)
          let totalSize = 0;

          for (const file of selectedFiles) {
            if (file.size > MAX_FILE_SIZE) {
              throw new Error(`File "${file.name}" is too large. Maximum size per file is ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB.`);
            }
            totalSize += file.size;
          }

          if (totalSize > MAX_TOTAL_SIZE) {
            throw new Error(`Total file size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds the limit of ${(MAX_TOTAL_SIZE / 1024 / 1024).toFixed(0)}MB.`);
          }

          // Get the current event ID
          const eventId = this.elements.saveEventButton.dataset.eventId;
          if (!eventId) {
            throw new Error('No event ID found');
          }

          // Get current event to preserve existing files
          const currentEvent = await this.pb.collection("events").getOne(eventId);
          const formData = new FormData();

          // Preserve existing files by adding them to formData
          if (currentEvent.files && Array.isArray(currentEvent.files)) {
            formData.append("files", JSON.stringify(currentEvent.files));
          }
          
          // Add new files to the formData
          Array.from(selectedFiles).forEach(file => {
            formData.append("files", file);
          });
          
          // Show progress bar container
          const progressContainer = document.getElementById('uploadProgress');
          const progressBar = document.getElementById('uploadProgressBar') as HTMLProgressElement;
          const progressText = document.getElementById('uploadProgressText');
          if (progressContainer) {
            progressContainer.classList.remove('hidden');
            // Reset progress
            if (progressBar) progressBar.value = 0;
            if (progressText) progressText.textContent = '0%';
          }

          // Create XMLHttpRequest for better progress tracking
          const xhr = new XMLHttpRequest();
          this.currentUploadXHR = xhr;  // Store the XHR request
          const url = `${this.pb.baseUrl}/api/collections/events/records/${eventId}`;
          
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded * 100) / e.total);
              if (progressBar) progressBar.value = progress;
              if (progressText) progressText.textContent = `${progress}%`;
            }
          };

          xhr.onload = async () => {
            this.currentUploadXHR = null;  // Clear the XHR reference
            if (xhr.status === 200) {
              // Update was successful
              const response = JSON.parse(xhr.responseText);
              const event = await this.pb.collection("events").getOne(eventId);
              this.updateFilesDisplay(event);
              
              // Clear the file input
              fileInput.value = '';
              
              // Hide progress bar after a short delay
              setTimeout(() => {
                if (progressContainer) {
                  progressContainer.classList.add('hidden');
                  if (progressBar) progressBar.value = 0;
                  if (progressText) progressText.textContent = '0%';
                }
              }, 1000);
            } else {
              let errorMessage = 'Failed to upload files. ';
              try {
                const errorResponse = JSON.parse(xhr.responseText);
                errorMessage += errorResponse.message || 'Please try again.';
              } catch {
                if (xhr.status === 413) {
                  errorMessage += 'Files are too large. Please reduce file sizes and try again.';
                } else if (xhr.status === 401) {
                  errorMessage += 'Your session has expired. Please log in again.';
                } else {
                  errorMessage += 'Please try again.';
                }
              }
              console.error('Upload failed:', errorMessage);
              alert(errorMessage);
              if (progressContainer) progressContainer.classList.add('hidden');
              fileInput.value = '';
            }
          };

          xhr.onerror = () => {
            this.currentUploadXHR = null;  // Clear the XHR reference
            console.error('Upload failed');
            let errorMessage = 'Failed to upload files. ';
            if (xhr.status === 413) {
              errorMessage += 'Files are too large. Please reduce file sizes and try again.';
            } else if (xhr.status === 0) {
              errorMessage += 'Network error or CORS issue. Please try again later.';
            } else {
              errorMessage += 'Please try again.';
            }
            alert(errorMessage);
            if (progressContainer) progressContainer.classList.add('hidden');
            fileInput.value = '';
          };

          xhr.onabort = () => {
            this.currentUploadXHR = null;  // Clear the XHR reference
            console.log('Upload cancelled');
            if (progressContainer) progressContainer.classList.add('hidden');
            fileInput.value = '';
          };

          // Get the auth token
          const token = this.pb.authStore.token;

          // Send the request
          xhr.open('PATCH', url, true);
          xhr.setRequestHeader('Authorization', token);
          xhr.send(formData);
        } catch (err) {
          console.error('Failed to upload files:', err);
          alert(err instanceof Error ? err.message : 'Failed to upload files. Please try again.');
          
          // Hide progress bar on error
          const progressContainer = document.getElementById('uploadProgress');
          if (progressContainer) progressContainer.classList.add('hidden');
          
          // Clear file input
          fileInput.value = '';
        }
      }
    });

    // Only sync attendees if user is an officer or administrator
    setTimeout(async () => {
      const user = this.pb.authStore.model;
      if (user && (user.member_type === "IEEE Officer" || user.member_type === "IEEE Administrator")) {
        await this.syncAttendees().catch(console.error);
      }
    }, 100);

    // Initial fetch
    this.fetchEvents();

    // Search functionality
    const handleSearch = () => {
      const searchQuery = this.elements.eventSearch.value.trim();
      this.fetchEvents(searchQuery);
    };

    // Real-time search
    this.elements.eventSearch.addEventListener("input", handleSearch);

    // Search button click handler
    this.elements.searchEvents.addEventListener("click", handleSearch);

    // Refresh button click handler
    const refreshButton = document.getElementById("refreshEvents");
    if (refreshButton) {
      refreshButton.addEventListener("click", () => {
        this.refreshEventsAndSync();
      });
    }

    // Add event button
    this.elements.addEvent.addEventListener("click", () => {
      const { eventEditor, editorEventId, saveEventButton } = this.elements;
      
      // Clear the form
      this.elements.editorEventId.value = "";
      this.elements.editorEventName.value = "";
      this.elements.editorEventCode.value = "";
      this.elements.editorStartDate.value = "";
      this.elements.editorStartTime.value = "";
      this.elements.editorEndDate.value = "";
      this.elements.editorEndTime.value = "";
      this.elements.editorPointsToReward.value = "0";
      
      // Enable event_id field for new events
      editorEventId.disabled = false;
      
      // Clear the event ID to indicate this is a new event
      saveEventButton.dataset.eventId = "";
      
      // Show the dialog
      eventEditor.showModal();
    });

    // Event editor dialog
    const { eventEditor, saveEventButton } = this.elements;

    // Close dialog when clicking outside
    eventEditor.addEventListener("click", (e) => {
      if (e.target === eventEditor) {
        eventEditor.close();
      }
    });

    // Save event button
    saveEventButton.addEventListener("click", (e) => {
      e.preventDefault();
      this.handleEventSave();
    });
  }

  // Add this new method to handle files display update
  private updateFilesDisplay(event: RecordModel) {
    const { currentFiles } = this.elements;
    currentFiles.innerHTML = "";
    
    if (event.files && Array.isArray(event.files) && event.files.length > 0) {
      const filesList = document.createElement("div");
      filesList.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";
      
      event.files.forEach((file: string) => {
        const fileUrl = this.pb.files.getURL(event, file);
        const fileName = this.getFileNameFromUrl(file);
        const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        
        const fileItem = document.createElement("div");
        fileItem.className = "bg-base-200 rounded-lg overflow-hidden";

        // Generate preview based on file type
        let previewHtml = '';
        if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) {
          previewHtml = `
            <div class="aspect-video bg-base-300 overflow-hidden">
              <img src="${fileUrl}" alt="${fileName}" class="w-full h-full object-contain">
            </div>
          `;
        } else {
          // For other file types, show an icon based on type
          const iconHtml = fileExt === 'txt' || fileExt === 'md' 
            ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-50" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 100 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
              </svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-50" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
              </svg>`;
          
          previewHtml = `
            <div class="aspect-video bg-base-300 flex items-center justify-center">
              ${iconHtml}
            </div>
          `;
        }

        fileItem.innerHTML = `
          ${previewHtml}
          <div class="card-body p-4">
            <h3 class="card-title text-sm flex items-center justify-between gap-2" title="${fileName}">
              <span class="truncate min-w-0">${nameWithoutExt}</span>
              <span class="text-base-content/50 text-xs uppercase font-mono shrink-0">${fileExt}</span>
            </h3>
          </div>
          <div class="border-t border-base-300 grid grid-cols-2">
            <a href="${fileUrl}" target="_blank" class="btn btn-ghost btn-sm rounded-none rounded-bl-lg gap-2 h-12">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
              Open
            </a>
            <button class="btn btn-ghost btn-sm text-error rounded-none rounded-br-lg gap-2 h-12 border-l border-base-300" title="Remove file" data-file="${file}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              Remove
            </button>
          </div>
        `;
        
        // Add delete handler
        const deleteButton = fileItem.querySelector('.text-error');
        if (deleteButton) {
          deleteButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to remove this file?')) {
              try {
                const fileToRemove = deleteButton.getAttribute('data-file');
                if (!fileToRemove) throw new Error('File not found');

                // Get the current event data
                const currentEvent = await this.pb.collection('events').getOne(event.id);
                
                // Filter out the file to be removed
                const updatedFiles = currentEvent.files.filter((f: string) => f !== fileToRemove);
                
                // Update the event with the new files array
                await this.pb.collection('events').update(event.id, {
                  files: updatedFiles
                });
                
                // Update the local event object
                event.files = updatedFiles;
                
                // Remove the file item from the UI
                fileItem.remove();
                
                // If no files left, show the "No files" message
                if (!event.files || event.files.length === 0) {
                  currentFiles.innerHTML = '<span class="text-sm opacity-50">No files</span>';
                }
              } catch (err) {
                console.error('Failed to remove file:', err);
                alert('Failed to remove file. Please try again.');
              }
            }
          });
        }
        
        filesList.appendChild(fileItem);
      });
      
      currentFiles.appendChild(filesList);
    } else {
      currentFiles.innerHTML = '<span class="text-sm opacity-50">No files</span>';
    }
  }

  private async handleViewFiles(eventId: string): Promise<void> {
    try {
      const event = await this.pb.collection("events").getOne<Event>(eventId);
      
      // Create and show modal
      const modal = document.createElement("dialog");
      modal.className = "modal";
      const modalContent = `
        <div class="modal-box max-w-5xl">
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg">Files for ${event.event_name}</h3>
            ${event.files && Array.isArray(event.files) && event.files.length > 0 
              ? `<button class="download-all btn btn-sm gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  Download ${event.files.length > 1 ? 'All' : 'File'}
                </button>`
              : ''
            }
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${event.files && Array.isArray(event.files) && event.files.length > 0 
              ? event.files.map((file: string) => {
                  const fileUrl = this.pb.files.getURL(event, file);
                  const fileName = this.getFileNameFromUrl(file);
                  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
                  
                  let previewHtml = '';
                  if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) {
                    previewHtml = `
                      <div class="aspect-video bg-base-300 rounded-t-lg overflow-hidden">
                        <img src="${fileUrl}" alt="${fileName}" class="w-full h-full object-contain">
                      </div>
                    `;
                  } else {
                    // For other file types, show an icon based on type
                    const iconHtml = fileExt === 'txt' || fileExt === 'md' 
                      ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-50" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 100 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
                        </svg>`
                      : `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-50" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                        </svg>`;

                    previewHtml = `
                      <div class="aspect-video bg-base-300 flex items-center justify-center">
                        ${iconHtml}
                      </div>
                    `;
                  }

                  return `
                    <div class="card bg-base-200">
                      ${previewHtml}
                      <div class="card-body p-4">
                        <h3 class="card-title text-sm flex items-center justify-between gap-2" title="${fileName}">
                          <span class="truncate min-w-0">${fileName.substring(0, fileName.lastIndexOf("."))}</span>
                          <span class="text-base-content/50 text-xs uppercase font-mono shrink-0">${fileExt}</span>
                        </h3>
                      </div>
                      <div class="border-t border-base-300">
                        <a href="${fileUrl}" target="_blank" class="btn btn-ghost btn-sm w-full rounded-none rounded-b-lg gap-2 h-12">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                          </svg>
                          Open in New Tab
                        </a>
                      </div>
                    </div>
                  `;
                }).join("")
              : `<div class="col-span-full text-center py-4 opacity-70">No files available</div>`
            }
          </div>
          <div class="modal-action">
            <form method="dialog">
              <button class="btn">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>`;

      modal.innerHTML = modalContent;
      document.body.appendChild(modal);
      modal.showModal();

      // Add download all functionality
      const downloadAllButton = modal.querySelector('.download-all') as HTMLButtonElement;
      if (downloadAllButton) {
        downloadAllButton.addEventListener('click', async () => {
          try {
            // Create a new JSZip instance
            const zip = new JSZip();

            // Add each file to the zip
            for (const file of event.files) {
              const fileUrl = this.pb.files.getURL(event, file);
              const fileName = this.getFileNameFromUrl(file);
              const response = await fetch(fileUrl);
              const blob = await response.blob();
              zip.file(fileName, blob);
            }

            // Generate the zip file
            const content = await zip.generateAsync({ type: "blob" });

            // Create a download link and trigger it
            const downloadUrl = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${event.event_name} Files.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
          } catch (err) {
            console.error('Failed to download files:', err);
            alert('Failed to download files. Please try again.');
          }
        });
      }

      // Remove modal when closed
      modal.addEventListener("close", () => {
        document.body.removeChild(modal);
      });
    } catch (err) {
      console.error("Failed to view files:", err);
    }
  }
}