/**
 * Safe localStorage helpers that guard against environments where storage is
 * unavailable (e.g. Safari private mode) or throws quota errors.
 */
export function safeLocalStorageGet(key: string): string | null {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeLocalStorageRemove(key: string): boolean {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return false;
  }

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all Firestore IndexedDB caches to resolve cache corruption issues.
 *
 * ⚠️ WARNING: This function is generally NOT RECOMMENDED because:
 * 1. It cannot delete databases while they're in use (will trigger "blocked" events)
 * 2. Requires a page refresh to take effect
 * 3. Doesn't solve the root cause of most loading issues
 * 4. Firestore's built-in cache management is usually sufficient
 *
 * Instead of clearing cache, consider:
 * - Using Firestore's cache-first pattern (default onSnapshot behavior)
 * - Checking network connectivity
 * - Verifying Firestore security rules
 * - Using getDocFromCache/getDocFromServer for explicit cache control
 *
 * This function is kept for emergency debugging purposes only.
 *
 * @returns Promise that resolves to true if cache was cleared successfully
 * @deprecated Prefer Firestore's built-in cache management
 */
export async function clearFirestoreCache(): Promise<boolean> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return false;
  }

  try {
    // Get all IndexedDB databases
    const databases = await indexedDB.databases();

    // Delete all Firebase-related databases
    const deletePromises = databases
      .filter(
        (db) =>
          db.name &&
          (db.name.includes("firestore") ||
            db.name.includes("firebase") ||
            db.name.startsWith("google-cloud-firestore")),
      )
      .map((db) => {
        return new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(db.name!);
          request.onsuccess = () => {
            console.log(`[clearFirestoreCache] Deleted database: ${db.name}`);
            resolve();
          };
          request.onerror = () => {
            console.error(
              `[clearFirestoreCache] Failed to delete database: ${db.name}`,
            );
            reject(request.error);
          };
          request.onblocked = () => {
            console.warn(
              `[clearFirestoreCache] Delete blocked for database: ${db.name}`,
            );
            // Still resolve as the database will be deleted when unblocked
            resolve();
          };
        });
      });

    await Promise.all(deletePromises);
    console.log("[clearFirestoreCache] Successfully cleared Firestore cache");
    return true;
  } catch (error) {
    console.error(
      "[clearFirestoreCache] Error clearing Firestore cache:",
      error,
    );
    return false;
  }
}
