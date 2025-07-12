# PocketBase Integration

This directory contains the necessary scripts for interacting with PocketBase.

## Authentication

The `Authentication.ts` file handles user authentication, including login, logout, and token management.

## Data Retrieval

The `Get.ts` file provides methods for retrieving data from PocketBase collections.

## Data Updates

The `Update.ts` file provides methods for updating data in PocketBase collections.

## File Management

The `FileManager.ts` file handles file uploads and downloads.

## Realtime Subscriptions

The `Realtime.ts` file provides methods for subscribing to realtime changes in PocketBase collections and records.

### Usage

#### Subscribe to a Collection

Subscribe to changes in an entire collection:

```typescript
import { Realtime } from "../scripts/pocketbase/Realtime";
import { Collections } from "../schemas/pocketbase";
import type { Event } from "../schemas/pocketbase/schema";

// Define the RealtimeEvent type for proper typing
interface RealtimeEvent<T> {
  action: "create" | "update" | "delete";
  record: T;
}

// Get the singleton instance
const realtime = Realtime.getInstance();

// Subscribe to all event changes
const subscriptionId = realtime.subscribeToCollection<RealtimeEvent<Event>>(
  Collections.EVENTS,
  (data) => {
    console.log(`Event ${data.action}:`, data.record);

    // Handle different actions
    switch (data.action) {
      case "create":
        console.log("New event created:", data.record.event_name);
        break;
      case "update":
        console.log("Event updated:", data.record.event_name);
        break;
      case "delete":
        console.log("Event deleted:", data.record.id);
        break;
    }
  },
);

// Later, when you're done with the subscription
realtime.unsubscribe(subscriptionId);
```

#### Subscribe to a Specific Record

Subscribe to changes for a specific record:

```typescript
// Subscribe to a specific event
const eventId = "your_event_id";
const specificEventSubscriptionId = realtime.subscribeToRecord<
  RealtimeEvent<Event>
>(
  Collections.EVENTS,
  eventId,
  (data) => {
    console.log(`Specific event ${data.action}:`, data.record);
  },
  { expand: "attendees" }, // Optional: expand relations
);

// Later, when you're done with the subscription
realtime.unsubscribe(specificEventSubscriptionId);
```

#### Using in React Components

```tsx
import { useEffect } from "react";
import { Realtime } from "../scripts/pocketbase/Realtime";
import { Collections } from "../schemas/pocketbase";
import type { Event } from "../schemas/pocketbase/schema";

// Define the RealtimeEvent type for proper typing
interface RealtimeEvent<T> {
  action: "create" | "update" | "delete";
  record: T;
}

function EventsComponent() {
  useEffect(() => {
    const realtime = Realtime.getInstance();

    // Subscribe to events collection
    const subscriptionId = realtime.subscribeToCollection<RealtimeEvent<Event>>(
      Collections.EVENTS,
      (data) => {
        // Handle the realtime update
        console.log(`Event ${data.action}:`, data.record);

        // Update your component state here
        // For example:
        // if (data.action === 'create') {
        //   setEvents(prevEvents => [...prevEvents, data.record]);
        // }
      },
    );

    // Cleanup function to unsubscribe when component unmounts
    return () => {
      realtime.unsubscribe(subscriptionId);
    };
  }, []); // Empty dependency array means this runs once when component mounts

  return (
    <div>
      <h1>Events</h1>
      {/* Your component JSX */}
    </div>
  );
}
```

#### Unsubscribe from All Subscriptions

```typescript
// Unsubscribe from all subscriptions at once
realtime.unsubscribeAll();
```
