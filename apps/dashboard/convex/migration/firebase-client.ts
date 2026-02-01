import admin from 'firebase-admin';
import { Timestamp as FirebaseTimestamp } from 'firebase-admin/firestore';

let appInstance: admin.app.App | null = null;

export interface FirebaseConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  databaseUrl?: string;
  storageBucket?: string;
}

/**
 * Initialize Firebase Admin SDK from environment variables.
 * This is a singleton to prevent multiple initialization errors.
 */
export function initializeFirebase(config: FirebaseConfig): admin.app.App {
  if (appInstance) {
    return appInstance;
  }

  const privateKey = config.privateKey.replace(/\\n/g, '\n');

  const firebaseConfig: admin.AppOptions = {
    credential: admin.credential.cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey,
    }),
  };

  if (config.databaseUrl) {
    firebaseConfig.databaseURL = config.databaseUrl;
  }

  if (config.storageBucket) {
    firebaseConfig.storageBucket = config.storageBucket;
  }

  appInstance = admin.initializeApp(firebaseConfig);

  return appInstance;
}

/**
 * Get or create the Firebase Admin app instance.
 */
export function getFirebaseApp(): admin.app.App {
  if (!appInstance) {
    throw new Error(
      'Firebase Admin SDK not initialized. Call initializeFirebase() first.',
    );
  }
  return appInstance;
}

/**
 * Get Firestore instance.
 */
export function getFirestore() {
  const app = getFirebaseApp();
  return app.firestore();
}

/**
 * Get Storage instance.
 */
export function getStorage() {
  const app = getFirebaseApp();
  return app.storage();
}

/**
 * Get Auth instance.
 */
export function getAuth() {
  const app = getFirebaseApp();
  return app.auth();
}

/**
 * Helper to convert Firebase Timestamp to ISO string.
 */
export function timestampToIso(timestamp: FirebaseTimestamp): string {
  return timestamp.toDate().toISOString();
}

/**
 * Helper to convert Firebase Timestamp to Unix milliseconds.
 */
export function timestampToMs(timestamp: FirebaseTimestamp): number {
  return timestamp.toMillis();
}

/**
 * Recursively convert all Firebase Timestamps in an object to ISO strings.
 */
export function convertTimestampsToIso(data: unknown): unknown {
  if (data instanceof FirebaseTimestamp) {
    return timestampToIso(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => convertTimestampsToIso(item));
  }

  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = convertTimestampsToIso(value);
    }
    return result;
  }

  return data;
}

/**
 * Initialize Firebase from environment variables.
 */
export function initializeFirebaseFromEnv(): admin.app.App {
  const config: FirebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY || '',
    databaseUrl: process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  };

  if (!config.projectId || !config.clientEmail || !config.privateKey) {
    throw new Error(
      'Missing required Firebase environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY',
    );
  }

  return initializeFirebase(config);
}
