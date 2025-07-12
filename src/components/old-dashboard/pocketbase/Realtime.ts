import { Authentication } from "./Authentication";
import { Collections } from "../../schemas/pocketbase";
import { Get } from "./Get";

// Type for subscription callbacks
type SubscriptionCallback<T> = (data: T) => void;

// Type for realtime event data
interface RealtimeEvent<T> {
  action: "create" | "update" | "delete";
  record: T;
}

// Interface for subscription options
interface SubscriptionOptions {
  expand?: string[] | string;
}

export class Realtime {
  private auth: Authentication;
  private static instance: Realtime;
  private subscriptions: Map<string, { callbacks: Set<SubscriptionCallback<any>>, options?: SubscriptionOptions }>;
  private getService: Get;

  private constructor() {
    this.auth = Authentication.getInstance();
    this.getService = Get.getInstance();
    this.subscriptions = new Map();
  }

  /**
   * Get the singleton instance of Realtime
   */
  public static getInstance(): Realtime {
    if (!Realtime.instance) {
      Realtime.instance = new Realtime();
    }
    return Realtime.instance;
  }

  /**
   * Subscribe to collection changes
   * @param collectionName The name of the collection to subscribe to
   * @param callback Function to call when changes occur
   * @param options Subscription options like expanding relations
   * @returns Subscription ID
   */
  public subscribeToCollection<T>(
    collectionName: string, 
    callback: SubscriptionCallback<T>,
    options?: SubscriptionOptions
  ): string {
    const subscriptionId = collectionName;
    
    // Register the callback
    if (!this.subscriptions.has(subscriptionId)) {
      this.subscriptions.set(subscriptionId, { 
        callbacks: new Set([callback]),
        options
      });
      this.initializeSubscription(collectionName);
    } else {
      this.subscriptions.get(subscriptionId)!.callbacks.add(callback);
    }
    
    return subscriptionId;
  }

  /**
   * Subscribe to a specific record's changes
   * @param collectionName The name of the collection
   * @param recordId The ID of the record to subscribe to
   * @param callback Function to call when changes occur
   * @param options Subscription options like expanding relations
   * @returns Subscription ID
   */
  public subscribeToRecord<T>(
    collectionName: string,
    recordId: string,
    callback: SubscriptionCallback<T>,
    options?: SubscriptionOptions
  ): string {
    const subscriptionId = `${collectionName}/${recordId}`;
    
    // Register the callback
    if (!this.subscriptions.has(subscriptionId)) {
      this.subscriptions.set(subscriptionId, { 
        callbacks: new Set([callback]),
        options
      });
      this.initializeSubscription(collectionName, recordId);
    } else {
      this.subscriptions.get(subscriptionId)!.callbacks.add(callback);
    }
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from all or specific collection/record changes
   * @param subscriptionId The subscription ID to unsubscribe from
   * @param callback Optional specific callback to remove
   */
  public unsubscribe(subscriptionId: string, callback?: SubscriptionCallback<any>): void {
    if (!this.subscriptions.has(subscriptionId)) return;
    
    if (callback) {
      // Remove specific callback
      this.subscriptions.get(subscriptionId)!.callbacks.delete(callback);
      
      // If no callbacks remain, remove the entire subscription
      if (this.subscriptions.get(subscriptionId)!.callbacks.size === 0) {
        this.subscriptions.delete(subscriptionId);
        this.removeSubscription(subscriptionId);
      }
    } else {
      // Remove entire subscription
      this.subscriptions.delete(subscriptionId);
      this.removeSubscription(subscriptionId);
    }
  }

  /**
   * Initialize a subscription to a collection or record
   * @param collectionName The name of the collection
   * @param recordId Optional record ID to subscribe to
   */
  private initializeSubscription(collectionName: string, recordId?: string): void {
    const pb = this.auth.getPocketBase();
    const topic = recordId ? `${collectionName}/${recordId}` : collectionName;
    
    // Subscribe to the topic
    pb.collection(collectionName).subscribe(recordId || "*", async (data) => {
      const event = data as unknown as RealtimeEvent<any>;
      const subscriptionId = recordId ? `${collectionName}/${recordId}` : collectionName;
      
      if (!this.subscriptions.has(subscriptionId)) return;
      
      const subscription = this.subscriptions.get(subscriptionId)!;
      const callbacks = subscription.callbacks;
      
      // Process the event data (convert UTC dates to local, expand relations if needed)
      let processedRecord = Get.convertUTCToLocal(event.record);
      
      // If there are any expansion options, fetch the expanded record
      if (subscription.options?.expand && recordId) {
        try {
          const expandOptions = { expand: subscription.options.expand };
          const expandedRecord = await this.getService.getOne(collectionName, recordId, expandOptions);
          processedRecord = expandedRecord;
        } catch (error) {
          console.error("Error expanding record in realtime event:", error);
        }
      }
      
      // Notify all callbacks
      callbacks.forEach(callback => {
        callback({
          action: event.action,
          record: processedRecord
        });
      });
    });
  }

  /**
   * Remove a subscription
   * @param subscriptionId The subscription ID to remove
   */
  private removeSubscription(subscriptionId: string): void {
    const pb = this.auth.getPocketBase();
    const [collectionName, recordId] = subscriptionId.split('/');
    
    if (collectionName) {
      pb.collection(collectionName).unsubscribe(recordId || '*');
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  public unsubscribeAll(): void {
    const pb = this.auth.getPocketBase();
    
    // Unsubscribe from all topics
    this.subscriptions.forEach((_, subscriptionId) => {
      const [collectionName, recordId] = subscriptionId.split('/');
      if (collectionName) {
        pb.collection(collectionName).unsubscribe(recordId || '*');
      }
    });
    
    // Clear the subscriptions map
    this.subscriptions.clear();
  }
} 