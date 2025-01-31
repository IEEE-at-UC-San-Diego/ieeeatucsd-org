import PocketBase from "pocketbase";
import yaml from "js-yaml";
import configYaml from "../../data/storeConfig.yaml?raw";

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
    defaults: {
      pageSize: number;
      sortField: string;
    };
  };
}

// Parse YAML configuration with type
const config = yaml.load(configYaml) as Config;

interface Event {
  id: string;
  event_id: string;
  event_name: string;
  event_code: string;
  registered_users: string; // JSON string
  points_to_reward: number;
  start_date: string;
  end_date: string;
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
  editorEndDate: HTMLInputElement;
  editorPointsToReward: HTMLInputElement;
  saveEventButton: HTMLButtonElement;
}

export class EventAuth {
  private pb: PocketBase;
  private elements: AuthElements;
  private cachedEvents: Event[] = [];

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
    const editorEndDate = document.getElementById("editorEndDate") as HTMLInputElement;
    const editorPointsToReward = document.getElementById("editorPointsToReward") as HTMLInputElement;
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
      !editorEndDate ||
      !editorPointsToReward ||
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
      editorEndDate,
      editorPointsToReward,
      saveEventButton,
    };
  }

  private getRegisteredUsersCount(registeredUsers: string): number {
    try {
      if (!registeredUsers) return 0;
      const users = JSON.parse(registeredUsers);
      return Array.isArray(users) ? users.length : 0;
    } catch (err) {
      console.warn("Failed to parse registered_users:", err);
      return 0;
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
               event.event_code?.toLowerCase().includes(term))
            );
          });
        }
      }

      const { eventList } = this.elements;
      const fragment = document.createDocumentFragment();

      if (filteredEvents.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td colspan="8" class="text-center py-4">
            ${searchQuery ? "No events found matching your search." : "No events found."}
          </td>
        `;
        fragment.appendChild(row);
      } else {
        filteredEvents.forEach((event) => {
          const row = document.createElement("tr");
          const startDate = event.start_date ? new Date(event.start_date).toLocaleString() : "N/A";
          const endDate = event.end_date ? new Date(event.end_date).toLocaleString() : "N/A";
          const registeredCount = this.getRegisteredUsersCount(event.registered_users);

          row.innerHTML = `
            <td class="block lg:table-cell">
              <!-- Mobile View -->
              <div class="lg:hidden space-y-2">
                <div class="font-medium">${event.event_name || "N/A"}</div>
                <div class="text-sm opacity-70">Event ID: ${event.event_id || "N/A"}</div>
                <div class="text-sm opacity-70">Code: ${event.event_code || "N/A"}</div>
                <div class="text-sm opacity-70">Start: ${startDate}</div>
                <div class="text-sm opacity-70">End: ${endDate}</div>
                <div class="text-sm opacity-70">Points: ${event.points_to_reward || 0}</div>
                <div class="text-sm opacity-70">Registered: ${registeredCount}</div>
                <div class="flex items-center justify-between mt-2">
                  <button class="btn btn-ghost btn-xs edit-event" data-event-id="${event.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Edit
                  </button>
                  <button class="btn btn-ghost btn-xs text-error delete-event" data-event-id="${event.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>

              <!-- Desktop View -->
              <span class="hidden lg:block">${event.event_name || "N/A"}</span>
            </td>
            <td class="hidden lg:table-cell">${event.event_id || "N/A"}</td>
            <td class="hidden lg:table-cell">${event.event_code || "N/A"}</td>
            <td class="hidden lg:table-cell">${startDate}</td>
            <td class="hidden lg:table-cell">${endDate}</td>
            <td class="hidden lg:table-cell">${event.points_to_reward || 0}</td>
            <td class="hidden lg:table-cell">${registeredCount}</td>
            <td class="hidden lg:table-cell">
              <div class="flex gap-2">
                <button class="btn btn-ghost btn-xs edit-event" data-event-id="${event.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                </button>
                <button class="btn btn-ghost btn-xs text-error delete-event" data-event-id="${event.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                  </svg>
                  Delete
                </button>
              </div>
            </td>
          `;

          fragment.appendChild(row);
        });
      }

      eventList.innerHTML = "";
      eventList.appendChild(fragment);

      // Setup event listeners for edit and delete buttons
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
    } catch (err) {
      console.error("Failed to fetch events:", err);
      const { eventList } = this.elements;
      eventList.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-error">
            Failed to fetch events. Please try again.
          </td>
        </tr>
      `;
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
        editorEndDate,
        editorPointsToReward,
        saveEventButton,
      } = this.elements;

      // Populate the form
      editorEventId.value = event.event_id || "";
      editorEventName.value = event.event_name || "";
      editorEventCode.value = event.event_code || "";
      editorStartDate.value = event.start_date ? new Date(event.start_date).toISOString().slice(0, 16) : "";
      editorEndDate.value = event.end_date ? new Date(event.end_date).toISOString().slice(0, 16) : "";
      editorPointsToReward.value = event.points_to_reward?.toString() || "0";

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

  private async handleEventSave() {
    const {
      eventEditor,
      editorEventId,
      editorEventName,
      editorEventCode,
      editorStartDate,
      editorEndDate,
      editorPointsToReward,
      saveEventButton,
    } = this.elements;

    const eventId = saveEventButton.dataset.eventId;
    const isNewEvent = !eventId;

    try {
      const eventData: Record<string, any> = {
        event_name: editorEventName.value,
        event_code: editorEventCode.value,
        start_date: editorStartDate.value,
        end_date: editorEndDate.value,
        points_to_reward: parseInt(editorPointsToReward.value) || 0,
      };

      // Only set registered_users for new events
      if (isNewEvent) {
        eventData.event_id = editorEventId.value;
        eventData.registered_users = "[]";
      }

      if (isNewEvent) {
        await this.pb.collection("events").create(eventData);
      } else {
        await this.pb.collection("events").update(eventId, eventData);
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

  private init() {
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

    // Add event button
    this.elements.addEvent.addEventListener("click", () => {
      const { eventEditor, editorEventId, saveEventButton } = this.elements;
      
      // Clear the form
      this.elements.editorEventId.value = "";
      this.elements.editorEventName.value = "";
      this.elements.editorEventCode.value = "";
      this.elements.editorStartDate.value = "";
      this.elements.editorEndDate.value = "";
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
} 