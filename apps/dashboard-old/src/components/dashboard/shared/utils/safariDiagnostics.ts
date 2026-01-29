/**
 * Safari-specific diagnostic utilities for debugging Firestore loading issues
 * 
 * Usage in browser console:
 * ```
 * import { runSafariDiagnostics } from './safariDiagnostics';
 * runSafariDiagnostics();
 * ```
 * 
 * Or access via window object (if exposed):
 * ```
 * window.runSafariDiagnostics();
 * ```
 */

import { auth, db } from "../../../../firebase/client";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

/**
 * Detect if the current browser is Safari
 */
export const isSafari = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Edg");
};

/**
 * Get detailed browser information
 */
export const getBrowserInfo = () => {
  if (typeof navigator === "undefined") {
    return { available: false };
  }

  return {
    available: true,
    userAgent: navigator.userAgent,
    isSafari: isSafari(),
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
  };
};

/**
 * Check IndexedDB availability and status
 */
export const checkIndexedDB = async (): Promise<{
  available: boolean;
  databases?: any[];
  error?: string;
}> => {
  if (typeof indexedDB === "undefined") {
    return { available: false, error: "IndexedDB not available" };
  }

  try {
    const databases = await indexedDB.databases();
    return {
      available: true,
      databases: databases.map((db) => ({
        name: db.name,
        version: db.version,
      })),
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Check localStorage availability and status
 */
export const checkLocalStorage = (): {
  available: boolean;
  items?: Record<string, string>;
  error?: string;
} => {
  if (typeof localStorage === "undefined") {
    return { available: false, error: "localStorage not available" };
  }

  try {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        items[key] = localStorage.getItem(key) || "";
      }
    }
    return { available: true, items };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Test Firestore connection with getDoc (one-time read)
 */
export const testFirestoreGetDoc = async (): Promise<{
  success: boolean;
  duration?: number;
  error?: string;
  data?: any;
}> => {
  const user = auth.currentUser;
  if (!user) {
    return { success: false, error: "No authenticated user" };
  }

  const startTime = performance.now();

  try {
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);
    const duration = performance.now() - startTime;

    return {
      success: true,
      duration,
      data: snapshot.exists() ? snapshot.data() : null,
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Test Firestore connection with onSnapshot (real-time listener)
 */
export const testFirestoreOnSnapshot = (): Promise<{
  success: boolean;
  duration?: number;
  error?: string;
  data?: any;
}> => {
  return new Promise((resolve) => {
    const user = auth.currentUser;
    if (!user) {
      resolve({ success: false, error: "No authenticated user" });
      return;
    }

    const startTime = performance.now();
    const timeout = setTimeout(() => {
      unsubscribe();
      resolve({
        success: false,
        duration: performance.now() - startTime,
        error: "Timeout after 5 seconds",
      });
    }, 5000);

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        clearTimeout(timeout);
        unsubscribe();
        const duration = performance.now() - startTime;
        resolve({
          success: true,
          duration,
          data: snapshot.exists() ? snapshot.data() : null,
        });
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        const duration = performance.now() - startTime;
        resolve({
          success: false,
          duration,
          error: error.message,
        });
      },
    );
  });
};

/**
 * Run comprehensive Safari diagnostics
 */
export const runSafariDiagnostics = async () => {
  console.group("🔍 Safari Diagnostics");

  // Browser info
  console.group("📱 Browser Information");
  const browserInfo = getBrowserInfo();
  console.table(browserInfo);
  console.groupEnd();

  // IndexedDB check
  console.group("💾 IndexedDB Status");
  const indexedDBStatus = await checkIndexedDB();
  console.log("Available:", indexedDBStatus.available);
  if (indexedDBStatus.databases) {
    console.log("Databases:", indexedDBStatus.databases);
  }
  if (indexedDBStatus.error) {
    console.error("Error:", indexedDBStatus.error);
  }
  console.groupEnd();

  // localStorage check
  console.group("📦 localStorage Status");
  const localStorageStatus = checkLocalStorage();
  console.log("Available:", localStorageStatus.available);
  if (localStorageStatus.items) {
    console.log("IEEE-related items:");
    Object.entries(localStorageStatus.items)
      .filter(([key]) => key.toLowerCase().includes("ieee"))
      .forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
  }
  if (localStorageStatus.error) {
    console.error("Error:", localStorageStatus.error);
  }
  console.groupEnd();

  // Firebase Auth check
  console.group("🔐 Firebase Auth Status");
  const user = auth.currentUser;
  if (user) {
    console.log("Authenticated:", true);
    console.log("User ID:", user.uid);
    console.log("Email:", user.email);
  } else {
    console.log("Authenticated:", false);
  }
  console.groupEnd();

  // Firestore getDoc test
  console.group("📖 Firestore getDoc Test");
  const getDocResult = await testFirestoreGetDoc();
  console.log("Success:", getDocResult.success);
  console.log("Duration:", getDocResult.duration?.toFixed(2), "ms");
  if (getDocResult.error) {
    console.error("Error:", getDocResult.error);
  }
  if (getDocResult.data) {
    console.log("Data loaded:", true);
  }
  console.groupEnd();

  // Firestore onSnapshot test
  console.group("🔄 Firestore onSnapshot Test");
  const onSnapshotResult = await testFirestoreOnSnapshot();
  console.log("Success:", onSnapshotResult.success);
  console.log("Duration:", onSnapshotResult.duration?.toFixed(2), "ms");
  if (onSnapshotResult.error) {
    console.error("Error:", onSnapshotResult.error);
  }
  if (onSnapshotResult.data) {
    console.log("Data loaded:", true);
  }
  console.groupEnd();

  console.groupEnd();

  // Summary
  console.log("\n📊 Summary:");
  console.log("Browser:", browserInfo.isSafari ? "Safari ✅" : "Other");
  console.log("IndexedDB:", indexedDBStatus.available ? "✅" : "❌");
  console.log("localStorage:", localStorageStatus.available ? "✅" : "❌");
  console.log("Auth:", user ? "✅" : "❌");
  console.log("getDoc:", getDocResult.success ? "✅" : "❌");
  console.log("onSnapshot:", onSnapshotResult.success ? "✅" : "❌");

  if (!onSnapshotResult.success && getDocResult.success) {
    console.warn(
      "\n⚠️ WARNING: getDoc works but onSnapshot fails. This suggests an issue with real-time listeners in Safari.",
    );
  }

  if (isSafari() && !indexedDBStatus.available) {
    console.warn(
      "\n⚠️ WARNING: Safari detected but IndexedDB is not available. You may be in Private Browsing mode.",
    );
  }

  return {
    browserInfo,
    indexedDBStatus,
    localStorageStatus,
    authStatus: { authenticated: !!user, userId: user?.uid },
    getDocResult,
    onSnapshotResult,
  };
};

// Expose to window for easy console access
if (typeof window !== "undefined") {
  (window as any).runSafariDiagnostics = runSafariDiagnostics;
  (window as any).safariDiagnostics = {
    runSafariDiagnostics,
    getBrowserInfo,
    checkIndexedDB,
    checkLocalStorage,
    testFirestoreGetDoc,
    testFirestoreOnSnapshot,
  };
}

