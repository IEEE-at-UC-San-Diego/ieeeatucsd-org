import { config } from "dotenv";
import { resolve } from "path";
import { initializeApp, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { ConvexHttpClient } from "convex/browser";

// Load .env.migration from the script directory
const scriptDir = new URL(".", import.meta.url).pathname;
config({ path: resolve(scriptDir, "..", ".env.migration") });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// Firebase Admin SDK initialization
function initFirebase() {
  const privateKeyRaw = requireEnv("FIREBASE_PRIVATE_KEY");

  // Decode base64 if needed
  let privateKey: string;
  try {
    if (privateKeyRaw.includes("BEGIN PRIVATE KEY")) {
      privateKey = privateKeyRaw;
    } else {
      privateKey = Buffer.from(privateKeyRaw, "base64").toString("utf8");
    }
  } catch {
    privateKey = privateKeyRaw;
  }

  // Fix escaped newlines
  privateKey = privateKey.replace(/\\n/g, "\n");

  const serviceAccount: ServiceAccount = {
    projectId: requireEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey,
  };

  const app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: requireEnv("FIREBASE_STORAGE_BUCKET"),
  });

  return {
    db: getFirestore(app),
    storage: getStorage(app),
  };
}

// Convex HTTP client initialization
function initConvex() {
  const url = requireEnv("CONVEX_URL");
  const client = new ConvexHttpClient(url);
  return client;
}

// Logto config
export function getLogtoConfig() {
  return {
    endpoint: requireEnv("LOGTO_ENDPOINT"),
    appId: requireEnv("LOGTO_M2M_APP_ID"),
    appSecret: requireEnv("LOGTO_M2M_APP_SECRET"),
  };
}

export const firebase = initFirebase();
export const convex = initConvex();
