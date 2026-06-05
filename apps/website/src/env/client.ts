import { z } from "zod";

const clientSchema = z.object({
  PUBLIC_FIREBASE_WEB_API_KEY: z.string().optional(),
  PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  PUBLIC_FIREBASE_APP_ID: z.string().optional(),
  PUBLIC_DASHBOARD_URL: z.string().url().optional(),
  PUBLIC_GOOGLE_CALENDAR_ID: z.string().optional(),
});

function readClientEnv() {
  const source =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env
      : ({} as Record<string, string | undefined>);

  return clientSchema.parse({
    PUBLIC_FIREBASE_WEB_API_KEY: source.PUBLIC_FIREBASE_WEB_API_KEY,
    PUBLIC_FIREBASE_AUTH_DOMAIN: source.PUBLIC_FIREBASE_AUTH_DOMAIN,
    PUBLIC_FIREBASE_PROJECT_ID: source.PUBLIC_FIREBASE_PROJECT_ID,
    PUBLIC_FIREBASE_STORAGE_BUCKET: source.PUBLIC_FIREBASE_STORAGE_BUCKET,
    PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      source.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    PUBLIC_FIREBASE_APP_ID: source.PUBLIC_FIREBASE_APP_ID,
    PUBLIC_DASHBOARD_URL: source.PUBLIC_DASHBOARD_URL,
    PUBLIC_GOOGLE_CALENDAR_ID: source.PUBLIC_GOOGLE_CALENDAR_ID,
  });
}

export const clientEnv = readClientEnv();

export const firebaseClientEnv = {
  apiKey: clientEnv.PUBLIC_FIREBASE_WEB_API_KEY ?? "",
  authDomain: clientEnv.PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: clientEnv.PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: clientEnv.PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: clientEnv.PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: clientEnv.PUBLIC_FIREBASE_APP_ID ?? "",
};
