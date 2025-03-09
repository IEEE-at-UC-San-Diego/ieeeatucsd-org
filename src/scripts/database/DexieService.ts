import Dexie from "dexie";
import type {
  User,
  Event,
  EventRequest,
  Log,
  Officer,
  Reimbursement,
  Receipt,
  Sponsor,
  EventAttendee,
} from "../../schemas/pocketbase/schema";

// Check if we're in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

// Interface for tracking offline changes
interface OfflineChange {
  id: string;
  collection: string;
  recordId: string;
  operation: "create" | "update" | "delete";
  data?: any;
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
}

export class DashboardDatabase extends Dexie {
  users!: Dexie.Table<User, string>;
  events!: Dexie.Table<Event, string>;
  eventAttendees!: Dexie.Table<EventAttendee, string>;
  eventRequests!: Dexie.Table<EventRequest, string>;
  logs!: Dexie.Table<Log, string>;
  officers!: Dexie.Table<Officer, string>;
  reimbursements!: Dexie.Table<Reimbursement, string>;
  receipts!: Dexie.Table<Receipt, string>;
  sponsors!: Dexie.Table<Sponsor, string>;
  offlineChanges!: Dexie.Table<OfflineChange, string>;

  // Store last sync timestamps
  syncInfo!: Dexie.Table<
    { id: string; collection: string; lastSync: number },
    string
  >;

  constructor() {
    super("IEEEDashboardDB");

    this.version(1).stores({
      users: "id, email, name",
      events: "id, event_name, event_code, start_date, end_date, published",
      eventRequests: "id, name, status, requested_user, created, updated",
      logs: "id, user, type, created",
      officers: "id, user, role, type",
      reimbursements: "id, title, status, submitted_by, created",
      receipts: "id, created_by, date",
      sponsors: "id, user, company",
      syncInfo: "id, collection, lastSync",
    });

    // Add version 2 with offlineChanges table
    this.version(2).stores({
      offlineChanges:
        "id, collection, recordId, operation, timestamp, synced, syncAttempts",
    });

    // Add version 3 with eventAttendees table and updated events table (no attendees field)
    this.version(3).stores({
      events: "id, event_name, event_code, start_date, end_date, published",
      eventAttendees: "id, user, event, time_checked_in",
    });

    // Add version 4 with files field in events table
    this.version(4).stores({
      events:
        "id, event_name, event_code, start_date, end_date, published, files",
    });
  }

  // Initialize the database with default values
  async initialize() {
    const collections = [
      "users",
      "events",
      "event_attendees",
      "event_request",
      "logs",
      "officers",
      "reimbursement",
      "receipts",
      "sponsors",
    ];

    for (const collection of collections) {
      const exists = await this.syncInfo.get(collection);
      if (!exists) {
        await this.syncInfo.put({
          id: collection,
          collection,
          lastSync: 0,
        });
      }
    }
  }
}

// Mock database for server-side rendering
class MockDashboardDatabase {
  // Implement empty methods that won't fail during SSR
  async initialize() {
    // Do nothing
  }
}

// Singleton pattern
export class DexieService {
  private static instance: DexieService;
  private db: DashboardDatabase | MockDashboardDatabase;

  private constructor() {
    if (isBrowser) {
      // Only initialize Dexie in browser environments
      this.db = new DashboardDatabase();
      this.db.initialize();
    } else {
      // Use a mock database in non-browser environments
      // console.log("Running in Node.js environment, using mock database");
      this.db = new MockDashboardDatabase() as any;
    }
  }

  public static getInstance(): DexieService {
    if (!DexieService.instance) {
      DexieService.instance = new DexieService();
    }
    return DexieService.instance;
  }

  // Get the database instance
  public getDB(): DashboardDatabase {
    if (!isBrowser) {
      console.warn(
        "Attempting to access IndexedDB in a non-browser environment",
      );
    }
    return this.db as DashboardDatabase;
  }

  // Update the last sync timestamp for a collection
  public async updateLastSync(collection: string): Promise<void> {
    if (!isBrowser) return;
    await (this.db as DashboardDatabase).syncInfo.update(collection, {
      lastSync: Date.now(),
    });
  }

  // Get the last sync timestamp for a collection
  public async getLastSync(collection: string): Promise<number> {
    if (!isBrowser) return 0;
    const info = await (this.db as DashboardDatabase).syncInfo.get(collection);
    return info?.lastSync || 0;
  }

  // Clear all data (useful for logout)
  public async clearAllData(): Promise<void> {
    if (!isBrowser) return;

    const db = this.db as DashboardDatabase;
    await db.users.clear();
    await db.events.clear();
    await db.eventAttendees.clear();
    await db.eventRequests.clear();
    await db.logs.clear();
    await db.officers.clear();
    await db.reimbursements.clear();
    await db.receipts.clear();
    await db.sponsors.clear();
    await db.offlineChanges.clear();

    // Reset sync timestamps
    const collections = [
      "users",
      "events",
      "event_attendees",
      "event_request",
      "logs",
      "officers",
      "reimbursement",
      "receipts",
      "sponsors",
    ];

    for (const collection of collections) {
      await db.syncInfo.update(collection, { lastSync: 0 });
    }
  }
}
