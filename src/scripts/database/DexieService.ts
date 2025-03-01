import Dexie from 'dexie';
import type { 
  User, 
  Event, 
  EventRequest, 
  Log, 
  Officer, 
  Reimbursement, 
  Receipt, 
  Sponsor 
} from '../../schemas/pocketbase/schema';

// Interface for tracking offline changes
interface OfflineChange {
  id: string;
  collection: string;
  recordId: string;
  operation: 'create' | 'update' | 'delete';
  data?: any;
  timestamp: number;
  synced: boolean;
  syncAttempts: number;
}

export class DashboardDatabase extends Dexie {
  users!: Dexie.Table<User, string>;
  events!: Dexie.Table<Event, string>;
  eventRequests!: Dexie.Table<EventRequest, string>;
  logs!: Dexie.Table<Log, string>;
  officers!: Dexie.Table<Officer, string>;
  reimbursements!: Dexie.Table<Reimbursement, string>;
  receipts!: Dexie.Table<Receipt, string>;
  sponsors!: Dexie.Table<Sponsor, string>;
  offlineChanges!: Dexie.Table<OfflineChange, string>;
  
  // Store last sync timestamps
  syncInfo!: Dexie.Table<{id: string, collection: string, lastSync: number}, string>;

  constructor() {
    super('IEEEDashboardDB');
    
    this.version(1).stores({
      users: 'id, email, name',
      events: 'id, event_name, event_code, start_date, end_date, published',
      eventRequests: 'id, name, status, requested_user, created, updated',
      logs: 'id, user, type, created',
      officers: 'id, user, role, type',
      reimbursements: 'id, title, status, submitted_by, created',
      receipts: 'id, created_by, date',
      sponsors: 'id, user, company',
      syncInfo: 'id, collection, lastSync'
    });

    // Add version 2 with offlineChanges table
    this.version(2).stores({
      offlineChanges: 'id, collection, recordId, operation, timestamp, synced, syncAttempts'
    });
  }

  // Initialize the database with default values
  async initialize() {
    const collections = [
      'users', 'events', 'event_request', 'logs', 
      'officers', 'reimbursement', 'receipts', 'sponsors'
    ];
    
    for (const collection of collections) {
      const exists = await this.syncInfo.get(collection);
      if (!exists) {
        await this.syncInfo.put({
          id: collection,
          collection,
          lastSync: 0
        });
      }
    }
  }
}

// Singleton pattern
export class DexieService {
  private static instance: DexieService;
  private db: DashboardDatabase;

  private constructor() {
    this.db = new DashboardDatabase();
    this.db.initialize();
  }

  public static getInstance(): DexieService {
    if (!DexieService.instance) {
      DexieService.instance = new DexieService();
    }
    return DexieService.instance;
  }

  // Get the database instance
  public getDB(): DashboardDatabase {
    return this.db;
  }

  // Update the last sync timestamp for a collection
  public async updateLastSync(collection: string): Promise<void> {
    await this.db.syncInfo.update(collection, { lastSync: Date.now() });
  }

  // Get the last sync timestamp for a collection
  public async getLastSync(collection: string): Promise<number> {
    const info = await this.db.syncInfo.get(collection);
    return info?.lastSync || 0;
  }

  // Clear all data (useful for logout)
  public async clearAllData(): Promise<void> {
    await this.db.users.clear();
    await this.db.events.clear();
    await this.db.eventRequests.clear();
    await this.db.logs.clear();
    await this.db.officers.clear();
    await this.db.reimbursements.clear();
    await this.db.receipts.clear();
    await this.db.sponsors.clear();
    await this.db.offlineChanges.clear();
    
    // Reset sync timestamps
    const collections = [
      'users', 'events', 'event_request', 'logs', 
      'officers', 'reimbursement', 'receipts', 'sponsors'
    ];
    
    for (const collection of collections) {
      await this.db.syncInfo.update(collection, { lastSync: 0 });
    }
  }
} 