/**
 * Storage adapter implementations for authentication system
 *
 * This file provides different storage mechanisms for persisting auth data,
 * including in-memory storage and browser localStorage.
 */

/**
 * Storage adapter interface for key-value storage operations
 * @interface
 */
export interface StorageAdapter {
  /**
   * Retrieve a value from storage by key
   * @param key - The storage key
   * @returns The stored value or null if not found
   */
  get<T>(key: string): T | null;

  /**
   * Store a value with the given key
   * @param key - The storage key
   * @param value - The value to store
   */
  set<T>(key: string, value: T): void;

  /**
   * Remove a value from storage by key
   * @param key - The storage key to remove
   */
  remove(key: string): void;

  /**
   * Clear all values from storage
   */
  clear(): void;
}

/**
 * In-memory storage implementation using Map
 * Useful for server-side rendering or testing scenarios
 * @class
 */
export class MemoryStorage implements StorageAdapter {
  private storage: Map<string, unknown>;

  constructor() {
    this.storage = new Map();
  }

  /**
   * Retrieve a value from memory storage
   * @param key - The storage key
   * @returns The stored value or null if not found
   */
  get<T>(key: string): T | null {
    const value = this.storage.get(key);
    return value !== undefined ? (value as T) : null;
  }

  /**
   * Store a value in memory
   * @param key - The storage key
   * @param value - The value to store
   */
  set<T>(key: string, value: T): void {
    this.storage.set(key, value);
  }

  /**
   * Remove a value from memory storage
   * @param key - The storage key to remove
   */
  remove(key: string): void {
    this.storage.delete(key);
  }

  /**
   * Clear all values from memory storage
   */
  clear(): void {
    this.storage.clear();
  }
}

/**
 * Browser localStorage implementation with JSON serialization
 * Persists data across browser sessions
 * @class
 */
export class LocalStorage implements StorageAdapter {
  /**
   * Retrieve and deserialize a value from localStorage
   * @param key - The storage key
   * @returns The deserialized value or null if not found
   */
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Error reading from localStorage [${key}]:`, error);
      return null;
    }
  }

  /**
   * Serialize and store a value in localStorage
   * @param key - The storage key
   * @param value - The value to store
   */
  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      window.localStorage.setItem(key, serialized);
    } catch (error) {
      console.error(`Error writing to localStorage [${key}]:`, error);
    }
  }

  /**
   * Remove a value from localStorage
   * @param key - The storage key to remove
   */
  remove(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage [${key}]:`, error);
    }
  }

  /**
   * Clear all values from localStorage
   */
  clear(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.clear();
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }
}

/**
 * Factory function to create a storage adapter instance
 * @param type - The type of storage adapter to create ('memory' or 'local')
 * @returns A StorageAdapter instance
 */
export function createStorageAdapter(type: 'memory' | 'local'): StorageAdapter {
  switch (type) {
    case 'memory':
      return new MemoryStorage();
    case 'local':
      return new LocalStorage();
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}
