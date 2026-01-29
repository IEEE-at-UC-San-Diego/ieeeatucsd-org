import { initializeApp } from "firebase/app";
import { firebaseEnv } from "../env";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  browserPopupRedirectResolver,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase client configuration for web app
// IMPORTANT: authDomain must match your Firebase project's authorized domains
// to avoid "missing initial state" errors in OAuth flows. This should be set
// in your environment as PUBLIC_FIREBASE_AUTH_DOMAIN (e.g., your-project.firebaseapp.com)
// or a custom domain you've configured in Firebase Console > Authentication > Settings
const firebaseConfig = {
  apiKey: firebaseEnv.apiKey,
  authDomain:
    firebaseEnv.authDomain || `${firebaseEnv.projectId}.firebaseapp.com`,
  projectId: firebaseEnv.projectId,
  storageBucket:
    firebaseEnv.storageBucket || `${firebaseEnv.projectId}.firebasestorage.app`,
  messagingSenderId: firebaseEnv.messagingSenderId,
  appId: firebaseEnv.appId,
};

export const app = initializeApp(firebaseConfig);

// Initialize Auth with explicit popup resolver for better compatibility
export const auth = getAuth(app);

// Export the popup resolver for use in sign-in flows
export { browserPopupRedirectResolver };

// Initialize Firestore with persistent cache (new API - replaces enableMultiTabIndexedDbPersistence)
// This allows the app to cache Firestore data locally and work offline
// Multi-tab support allows multiple tabs to share the same cache
// IMPORTANT SECURITY NOTE:
// - Persistent caches (IndexedDB) may retain user data on shared/public devices.
// - We never store secrets in Firestore docs; still, be mindful of data visibility after logout.
// - You can disable persistence via:
//     1) environment: PUBLIC_DISABLE_FIREBASE_PERSISTENCE=true
//     2) localStorage flag: DISABLE_FIREBASE_PERSISTENCE=true
// - We also auto-fallback to in-memory cache when IndexedDB is unavailable (e.g., some private modes).
// IMPORTANT: This must be the FIRST initialization of Firestore for this app

// Detect Safari browser - Safari has unreliable IndexedDB that can fail at runtime
const isSafari =
  typeof window !== "undefined" &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const disablePersistence =
  typeof window !== "undefined" &&
  (isSafari || // Disable persistence for Safari due to unreliable IndexedDB
    (typeof localStorage !== "undefined" &&
      localStorage.getItem("DISABLE_FIREBASE_PERSISTENCE") === "true") ||
    (!!(import.meta as any)?.env?.PUBLIC_DISABLE_FIREBASE_PERSISTENCE &&
      (import.meta as any).env.PUBLIC_DISABLE_FIREBASE_PERSISTENCE === "true"));
const supportsIndexedDB = typeof indexedDB !== "undefined";

let firestoreInstance;

try {
  if (!disablePersistence && supportsIndexedDB) {
    console.log(
      "[firebase] Initializing Firestore with persistent cache (multi-tab IndexedDB)",
    );
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } else {
    const reason = isSafari
      ? "Safari browser detected (unreliable IndexedDB)"
      : disablePersistence
        ? "Persistence disabled via config"
        : "IndexedDB not supported";
    console.log(
      `[firebase] Initializing Firestore with memory-only cache (${reason})`,
    );
    firestoreInstance = initializeFirestore(app, {});
  }
} catch (error) {
  console.warn(
    "[firebase] Persistent cache initialization failed, falling back to memory-only Firestore.",
    error,
  );
  firestoreInstance = initializeFirestore(app, {});
}

export const db = firestoreInstance;

export const storage = getStorage(app);

export { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider };
