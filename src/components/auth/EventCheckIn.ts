import PocketBase from "pocketbase";
import yaml from "js-yaml";
import pocketbaseConfig from "../../config/pocketbaseConfig.yml?raw";
import textConfig from "../../config/text.yml?raw";
import { SendLog } from "../pocketbase/SendLog";

// Configuration type definitions
interface Config {
  api: {
    baseUrl: string;
    oauth2: {
      redirectPath: string;
      providerName: string;
    };
  };
}

// Parse YAML configuration
const config = yaml.load(pocketbaseConfig) as Config;
const text = yaml.load(textConfig) as any;

interface AuthElements {
  eventCodeInput: HTMLInputElement;
  checkInButton: HTMLButtonElement;
  checkInStatus: HTMLParagraphElement;
}

export class EventCheckIn {
  private pb: PocketBase;
  private elements: AuthElements;
  private logger: SendLog;

  constructor() {
    this.pb = new PocketBase(config.api.baseUrl);
    this.elements = this.getElements();
    this.logger = SendLog.getInstance();
    
    // Add event listener for the check-in button
    this.elements.checkInButton.addEventListener("click", () => this.handleCheckIn());

    // Add event listener for the enter key on the input field
    this.elements.eventCodeInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        this.handleCheckIn();
      }
    });
  }

  private getElements(): AuthElements {
    // Get both skeleton and content elements
    const eventCodeInput = document.getElementById("eventCodeInput") as HTMLInputElement;
    const checkInButton = document.getElementById("checkInButton") as HTMLButtonElement;
    const checkInStatus = document.getElementById("checkInStatus") as HTMLParagraphElement;

    // Get skeleton elements
    const skeletonEventCodeInput = document.getElementById("skeletonEventCodeInput") as HTMLInputElement;
    const skeletonCheckInButton = document.getElementById("skeletonCheckInButton") as HTMLButtonElement;
    const skeletonCheckInStatus = document.getElementById("skeletonCheckInStatus") as HTMLParagraphElement;

    // Check for required elements (only need one set)
    if ((!eventCodeInput || !checkInButton || !checkInStatus) && 
        (!skeletonEventCodeInput || !skeletonCheckInButton || !skeletonCheckInStatus)) {
      throw new Error("Required DOM elements not found");
    }

    // Return whichever set is available (prefer content over skeleton)
    return {
      eventCodeInput: eventCodeInput || skeletonEventCodeInput,
      checkInButton: checkInButton || skeletonCheckInButton,
      checkInStatus: checkInStatus || skeletonCheckInStatus,
    };
  }

  private async validateEventCode(code: string): Promise<{ isValid: boolean; event?: any; message?: string }> {
    try {
        // Find event by code
        const events = await this.pb.collection('events').getFullList({
            filter: `event_code = "${code}"`,
        });

        if (events.length === 0) {
            return { 
                isValid: false, 
                message: text.ui.messages.event.checkIn.invalid
            };
        }

        const event = events[0];
        const now = new Date();
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date);

        // Check if current time is within event window
        if (now < startDate) {
            return { 
                isValid: false, 
                event,
                message: text.ui.messages.event.checkIn.expired
            };
        }

        if (now > endDate) {
            return { 
                isValid: false, 
                event,
                message: text.ui.messages.event.checkIn.expired
            };
        }

        return { isValid: true, event };
    } catch (err) {
        console.error('Failed to validate event code:', err);
        return { 
            isValid: false, 
            message: text.ui.messages.event.checkIn.error
        };
    }
  }

  private async handleCheckIn() {
    const { eventCodeInput, checkInStatus } = this.elements;
    const eventCode = eventCodeInput.value.trim();

    if (!eventCode) {
      this.showStatus(text.ui.messages.event.checkIn.invalid, "error");
      return;
    }

    let validation: { isValid: boolean; event?: any; message?: string } | undefined;

    try {
      this.showStatus(text.ui.messages.event.checkIn.checking, "info");

      // Get current user
      const user = this.pb.authStore.model;
      if (!user) {
        this.showStatus(text.ui.messages.auth.notSignedIn, "error");
        await this.logger.send(
          "error",
          "event check in",
          "Check-in attempt failed: User not authenticated"
        );
        return;
      }

      // Validate event code and check time window
      validation = await this.validateEventCode(eventCode);
      if (!validation.isValid) {
        this.showStatus(validation.message || text.ui.messages.event.checkIn.invalid, "error");
        await this.logger.send(
          "error",
          "event check in",
          `Invalid event code attempt: "${eventCode}". Reason: ${validation.message}`
        );
        return;
      }

      const event = validation.event;

      // Get user's attended events and current points
      const currentUser = await this.pb.collection("users").getOne(user.id);
      let eventsAttended: string[] = [];
      let currentPoints = currentUser.points || 0;
      
      // Handle different cases for events_attended field
      if (currentUser.events_attended) {
        if (Array.isArray(currentUser.events_attended)) {
          eventsAttended = currentUser.events_attended;
        } else if (typeof currentUser.events_attended === 'string') {
          try {
            eventsAttended = JSON.parse(currentUser.events_attended);
          } catch (err) {
            eventsAttended = [];
          }
        }
      }

      // Ensure eventsAttended is an array
      if (!Array.isArray(eventsAttended)) {
        eventsAttended = [];
      }

      // Check if already checked in using event_id
      const isAlreadyCheckedIn = eventsAttended.includes(event.event_id);
      
      if (isAlreadyCheckedIn) {
        this.showStatus(text.ui.messages.event.checkIn.alreadyCheckedIn, "info");
        await this.logger.send(
          "error",
          "event check in",
          `Duplicate check-in attempt for event "${event.event_name}" (${event.event_id})`
        );
        eventCodeInput.value = ""; // Clear input
        return;
      }

      // Add event_id to user's attended events and update points
      eventsAttended.push(event.event_id);
      const pointsToAdd = event.points_to_reward || 0;
      const newTotalPoints = currentPoints + pointsToAdd;

      // Update user with new events_attended and points
      await this.pb.collection("users").update(user.id, {
        events_attended: JSON.stringify(eventsAttended),
        points: newTotalPoints
      });

      // Update event's attendees list
      let eventAttendees = [];
      try {
        eventAttendees = JSON.parse(event.attendees || '[]');
      } catch (err) {
        eventAttendees = [];
      }
      if (!Array.isArray(eventAttendees)) {
        eventAttendees = [];
      }
      
      // Add user to attendees if not already present
      if (!eventAttendees.includes(user.id)) {
        eventAttendees.push(user.id);
        await this.pb.collection("events").update(event.id, {
          attendees: JSON.stringify(eventAttendees)
        });
      }

      // Show success message with points
      this.showStatus(text.ui.messages.event.checkIn.success, "success");
      eventCodeInput.value = ""; // Clear input

      // Log the successful check-in
      await this.logger.send(
        "create",
        "event check in",
        `Successfully checked in to event ${event.id}`
      );

      // Log the points update
      await this.logger.send(
        "update",
        "loyalty points",
        `Points updated from ${currentPoints} to ${newTotalPoints} (+${pointsToAdd} from event ${event.id})`
      );

      // Update event attendance count
      const currentAttendance = event.attendance_count || 0;
      
      await this.pb.collection('events').update(event.id, {
        attendance_count: currentAttendance + 1
      });

      // Log the attendance update
      await this.logger.send(
        "update",
        "event attendance",
        `Event ${event.id} attendance updated to ${currentAttendance + 1}`
      );

    } catch (err) {
      console.error("Check-in error:", err);
      this.showStatus(text.ui.messages.event.checkIn.error, "error");

      // Log any errors that occur during check-in
      if (validation?.event) {
        await this.logger.send(
          "error",
          "event check in",
          `Failed to check in to event ${validation.event.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      } else {
        await this.logger.send(
          "error",
          "event check in",
          `Failed to check in: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }
  }

  private showStatus(message: string, type: "error" | "success" | "info") {
    const { checkInStatus } = this.elements;
    checkInStatus.textContent = message;
    checkInStatus.className = "text-xs mt-1";

    switch (type) {
      case "error":
        checkInStatus.classList.add("text-error");
        break;
      case "success":
        checkInStatus.classList.add("text-success");
        break;
      case "info":
        checkInStatus.classList.add("opacity-70");
        break;
    }

    // Clear status after timeout
    if (type !== "info") {
      setTimeout(() => {
        checkInStatus.textContent = "";
      }, text.ui.messages.event.checkIn.messageTimeout);
    }
  }

  /**
   * Gets all events a user has checked into
   * @param userId The ID of the user
   */
  public async getUserEventHistory(userId: string) {
    try {
      const records = await this.pb.collection('event_checkins').getFullList({
        filter: `user_id="${userId}"`,
        sort: '-created',
        expand: 'event_id'
      });

      // Log the history retrieval
      await this.logger.send(
        "update",
        "event attendance",
        `Retrieved attendance history for user: ${records.length} events found`
      );

      return records;
    } catch (error) {
      // Log any errors in retrieving history
      await this.logger.send(
        "error",
        "event attendance",
        `Failed to retrieve event history: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw error;
    }
  }
} 