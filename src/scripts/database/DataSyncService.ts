import { DexieService } from './DexieService';
import { Get } from '../pocketbase/Get';
import { Update } from '../pocketbase/Update';
import { Authentication } from '../pocketbase/Authentication';
import { Collections, type BaseRecord } from '../../schemas/pocketbase/schema';
import type Dexie from 'dexie';

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

export class DataSyncService {
  private static instance: DataSyncService;
  private dexieService: DexieService;
  private get: Get;
  private update: Update;
  private auth: Authentication;
  private syncInProgress: Record<string, boolean> = {};
  private offlineMode: boolean = false;
  private offlineChangesTable: Dexie.Table<OfflineChange, string> | null = null;

  private constructor() {
    this.dexieService = DexieService.getInstance();
    this.get = Get.getInstance();
    this.update = Update.getInstance();
    this.auth = Authentication.getInstance();
    
    // Initialize offline changes table
    this.initOfflineChangesTable();
    
    // Check for network status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      this.offlineMode = !navigator.onLine;
    }
  }

  public static getInstance(): DataSyncService {
    if (!DataSyncService.instance) {
      DataSyncService.instance = new DataSyncService();
    }
    return DataSyncService.instance;
  }

  /**
   * Initialize the offline changes table
   */
  private initOfflineChangesTable(): void {
    try {
      const db = this.dexieService.getDB();
      // Check if the table exists in the schema
      if ('offlineChanges' in db) {
        this.offlineChangesTable = db.offlineChanges as Dexie.Table<OfflineChange, string>;
      } else {
        console.warn('Offline changes table not found in schema');
      }
    } catch (error) {
      console.error('Error initializing offline changes table:', error);
    }
  }

  /**
   * Handle device coming online
   */
  private async handleOnline(): Promise<void> {
    console.log('Device is online, syncing pending changes...');
    this.offlineMode = false;
    await this.syncOfflineChanges();
  }

  /**
   * Handle device going offline
   */
  private handleOffline(): void {
    console.log('Device is offline, enabling offline mode...');
    this.offlineMode = true;
  }

  /**
   * Sync a specific collection from PocketBase to IndexedDB
   */
  public async syncCollection<T extends BaseRecord>(
    collection: string, 
    filter: string = '', 
    sort: string = '-created',
    expand: Record<string, any> | string[] | string = {}
  ): Promise<T[]> {
    // Prevent multiple syncs of the same collection at the same time
    if (this.syncInProgress[collection]) {
      console.log(`Sync already in progress for ${collection}`);
      return [];
    }

    this.syncInProgress[collection] = true;
    
    try {
      // Check if we're authenticated
      if (!this.auth.isAuthenticated()) {
        console.log(`Not authenticated, skipping sync for ${collection}`);
        return [];
      }

      // Check if we're offline
      if (this.offlineMode) {
        console.log(`Device is offline, using cached data for ${collection}`);
        const db = this.dexieService.getDB();
        const table = this.getTableForCollection(collection);
        return table ? (await table.toArray() as T[]) : [];
      }

      console.log(`Syncing ${collection}...`);
      
      // Normalize expand parameter to be an array of strings
      let normalizedExpand: string[] | undefined;
      
      if (expand) {
        if (typeof expand === 'string') {
          // If expand is a string, convert it to an array
          normalizedExpand = [expand];
        } else if (Array.isArray(expand)) {
          // If expand is already an array, use it as is
          normalizedExpand = expand;
        } else if (typeof expand === 'object') {
          // If expand is an object, extract the keys
          normalizedExpand = Object.keys(expand);
        }
      }
      
      // Get data from PocketBase
      const items = await this.get.getAll<T>(collection, filter, sort, {
        expand: normalizedExpand
      });
      console.log(`Fetched ${items.length} items from ${collection}`);
      
      // Get the database table
      const db = this.dexieService.getDB();
      const table = this.getTableForCollection(collection);
      
      if (!table) {
        console.error(`No table found for collection ${collection}`);
        return [];
      }
      
      // Get existing items to handle conflicts
      const existingItems = await table.toArray();
      const existingItemsMap = new Map(existingItems.map(item => [item.id, item]));
      
      // Handle conflicts and merge changes
      const itemsToStore = await Promise.all(items.map(async (item) => {
        const existingItem = existingItemsMap.get(item.id);
        
        if (existingItem) {
          // Check for conflicts (local changes vs server changes)
          const resolvedItem = await this.resolveConflict(collection, existingItem, item);
          return resolvedItem;
        }
        
        return item;
      }));
      
      // Store in IndexedDB
      await table.bulkPut(itemsToStore);
      
      // Update last sync timestamp
      await this.dexieService.updateLastSync(collection);
      
      return itemsToStore as T[];
    } catch (error) {
      console.error(`Error syncing ${collection}:`, error);
      throw error;
    } finally {
      this.syncInProgress[collection] = false;
    }
  }

  /**
   * Resolve conflicts between local and server data
   */
  private async resolveConflict<T extends BaseRecord>(
    collection: string,
    localItem: T,
    serverItem: T
  ): Promise<T> {
    // Check if there are pending offline changes for this item
    const pendingChanges = await this.getPendingChangesForRecord(collection, localItem.id);
    
    if (pendingChanges.length > 0) {
      console.log(`Found ${pendingChanges.length} pending changes for ${collection}:${localItem.id}`);
      
      // Server-wins strategy by default, but preserve local changes that haven't been synced
      const mergedItem = { ...serverItem };
      
      // Apply pending changes on top of server data
      for (const change of pendingChanges) {
        if (change.operation === 'update' && change.data) {
          // Apply each field change individually
          Object.entries(change.data).forEach(([key, value]) => {
            (mergedItem as any)[key] = value;
          });
        }
      }
      
      return mergedItem;
    }
    
    // No pending changes, use server data
    return serverItem;
  }

  /**
   * Get pending changes for a specific record
   */
  private async getPendingChangesForRecord(collection: string, recordId: string): Promise<OfflineChange[]> {
    if (!this.offlineChangesTable) return [];
    
    try {
      return await this.offlineChangesTable
        .where('collection')
        .equals(collection)
        .and(item => item.recordId === recordId && !item.synced)
        .toArray();
    } catch (error) {
      console.error(`Error getting pending changes for ${collection}:${recordId}:`, error);
      return [];
    }
  }

  /**
   * Sync all pending offline changes
   */
  public async syncOfflineChanges(): Promise<boolean> {
    if (!this.offlineChangesTable || this.offlineMode) return false;
    
    try {
      // Get all unsynced changes
      const pendingChanges = await this.offlineChangesTable
        .where('synced')
        .equals(0) // Use 0 instead of false for indexable type
        .toArray();
      
      if (pendingChanges.length === 0) {
        console.log('No pending offline changes to sync');
        return true;
      }
      
      console.log(`Syncing ${pendingChanges.length} offline changes...`);
      
      // Group changes by collection for more efficient processing
      const changesByCollection = pendingChanges.reduce((groups, change) => {
        const key = change.collection;
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(change);
        return groups;
      }, {} as Record<string, OfflineChange[]>);
      
      // Process each collection's changes
      for (const [collection, changes] of Object.entries(changesByCollection)) {
        // First sync the collection to get latest data
        await this.syncCollection(collection);
        
        // Then apply each change
        for (const change of changes) {
          try {
            if (change.operation === 'update' && change.data) {
              await this.update.updateFields(collection, change.recordId, change.data);
              
              // Mark as synced
              await this.offlineChangesTable.update(change.id, {
                synced: true,
                syncAttempts: change.syncAttempts + 1
              });
            }
            // Add support for create and delete operations as needed
          } catch (error) {
            console.error(`Error syncing change ${change.id}:`, error);
            
            // Increment sync attempts
            await this.offlineChangesTable.update(change.id, {
              syncAttempts: change.syncAttempts + 1
            });
          }
        }
        
        // Sync again to ensure we have the latest data
        await this.syncCollection(collection);
      }
      
      return true;
    } catch (error) {
      console.error('Error syncing offline changes:', error);
      return false;
    }
  }

  /**
   * Record an offline change
   */
  public async recordOfflineChange(
    collection: string,
    recordId: string,
    operation: 'create' | 'update' | 'delete',
    data?: any
  ): Promise<string | null> {
    if (!this.offlineChangesTable) return null;
    
    try {
      const change: Omit<OfflineChange, 'id'> = {
        collection,
        recordId,
        operation,
        data,
        timestamp: Date.now(),
        synced: false,
        syncAttempts: 0
      };
      
      const id = await this.offlineChangesTable.add(change as OfflineChange);
      console.log(`Recorded offline change: ${operation} on ${collection}:${recordId}`);
      
      // Try to sync immediately if we're online
      if (!this.offlineMode) {
        this.syncOfflineChanges().catch(err => {
          console.error('Error syncing after recording change:', err);
        });
      }
      
      return id;
    } catch (error) {
      console.error(`Error recording offline change for ${collection}:${recordId}:`, error);
      return null;
    }
  }

  /**
   * Get data from IndexedDB, syncing from PocketBase if needed
   */
  public async getData<T extends BaseRecord>(
    collection: string, 
    forceSync: boolean = false,
    filter: string = '', 
    sort: string = '-created',
    expand: Record<string, any> | string[] | string = {}
  ): Promise<T[]> {
    const db = this.dexieService.getDB();
    const table = this.getTableForCollection(collection);
    
    if (!table) {
      console.error(`No table found for collection ${collection}`);
      return [];
    }
    
    // Check if we need to sync
    const lastSync = await this.dexieService.getLastSync(collection);
    const now = Date.now();
    const syncThreshold = 5 * 60 * 1000; // 5 minutes
    
    if (!this.offlineMode && (forceSync || (now - lastSync > syncThreshold))) {
      try {
        await this.syncCollection<T>(collection, filter, sort, expand);
      } catch (error) {
        console.error(`Error syncing ${collection}, using cached data:`, error);
      }
    }
    
    // Get data from IndexedDB
    let data = await table.toArray();
    
    // Apply filter if provided
    if (filter) {
      // This is a simple implementation - in a real app, you'd want to parse the filter string
      // and apply it properly. This is just a basic example.
      data = data.filter((item: any) => {
        // Split filter by logical operators
        const conditions = filter.split(' && ');
        return conditions.every(condition => {
          // Parse condition (very basic implementation)
          if (condition.includes('=')) {
            const [field, value] = condition.split('=');
            const cleanValue = value.replace(/"/g, '');
            return item[field] === cleanValue;
          }
          return true;
        });
      });
    }
    
    // Apply sort if provided
    if (sort) {
      const isDesc = sort.startsWith('-');
      const field = isDesc ? sort.substring(1) : sort;
      
      data.sort((a: any, b: any) => {
        if (a[field] < b[field]) return isDesc ? 1 : -1;
        if (a[field] > b[field]) return isDesc ? -1 : 1;
        return 0;
      });
    }
    
    return data as T[];
  }

  /**
   * Get a single item by ID
   */
  public async getItem<T extends BaseRecord>(collection: string, id: string, forceSync: boolean = false): Promise<T | undefined> {
    const db = this.dexieService.getDB();
    const table = this.getTableForCollection(collection);
    
    if (!table) {
      console.error(`No table found for collection ${collection}`);
      return undefined;
    }
    
    // Try to get from IndexedDB first
    let item = await table.get(id) as T | undefined;
    
    // If not found or force sync, try to get from PocketBase
    if ((!item || forceSync) && !this.offlineMode) {
      try {
        const pbItem = await this.get.getOne<T>(collection, id);
        if (pbItem) {
          await table.put(pbItem);
          item = pbItem;
        }
      } catch (error) {
        console.error(`Error fetching ${collection} item ${id}:`, error);
      }
    }
    
    return item;
  }

  /**
   * Update an item and handle offline changes
   */
  public async updateItem<T extends BaseRecord>(
    collection: string,
    id: string,
    data: Partial<T>
  ): Promise<T | undefined> {
    const table = this.getTableForCollection(collection);
    
    if (!table) {
      console.error(`No table found for collection ${collection}`);
      return undefined;
    }
    
    // Get the current item
    const currentItem = await table.get(id) as T | undefined;
    if (!currentItem) {
      console.error(`Item ${id} not found in ${collection}`);
      return undefined;
    }
    
    // Update the item in IndexedDB
    const updatedItem = { ...currentItem, ...data, updated: new Date().toISOString() };
    await table.put(updatedItem);
    
    // If offline, record the change for later sync
    if (this.offlineMode) {
      await this.recordOfflineChange(collection, id, 'update', data);
      return updatedItem;
    }
    
    // If online, update in PocketBase
    try {
      const result = await this.update.updateFields(collection, id, data);
      return result as T;
    } catch (error) {
      console.error(`Error updating ${collection} item ${id}:`, error);
      
      // Record as offline change to retry later
      await this.recordOfflineChange(collection, id, 'update', data);
      return updatedItem;
    }
  }

  /**
   * Clear all cached data
   */
  public async clearCache(): Promise<void> {
    await this.dexieService.clearAllData();
  }

  /**
   * Check if device is in offline mode
   */
  public isOffline(): boolean {
    return this.offlineMode;
  }

  /**
   * Get the appropriate Dexie table for a collection
   */
  private getTableForCollection(collection: string): Dexie.Table<any, string> | null {
    const db = this.dexieService.getDB();
    
    switch (collection) {
      case Collections.USERS:
        return db.users;
      case Collections.EVENTS:
        return db.events;
      case Collections.EVENT_REQUESTS:
        return db.eventRequests;
      case Collections.LOGS:
        return db.logs;
      case Collections.OFFICERS:
        return db.officers;
      case Collections.REIMBURSEMENTS:
        return db.reimbursements;
      case Collections.RECEIPTS:
        return db.receipts;
      case Collections.SPONSORS:
        return db.sponsors;
      default:
        console.error(`Unknown collection: ${collection}`);
        return null;
    }
  }
} 