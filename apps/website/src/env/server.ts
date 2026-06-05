import { z } from "zod";

const serverSchema = z.object({
  CONVEX_SELF_HOSTED_URL: z.string().url().optional(),
  PUBLIC_GOOGLE_CALENDAR_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_CLIENT_ID: z.string().optional(),
  FIREBASE_AUTH_URL: z.string().url().optional(),
  FIREBASE_TOKEN_URL: z.string().url().optional(),
  FIREBASE_AUTH_CERT_URL: z.string().url().optional(),
  FIREBASE_CLIENT_CERT_URL: z.string().url().optional(),
  PUBLIC_FIREBASE_WEB_API_KEY: z.string().optional(),
  PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().optional(),
  PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  PUBLIC_FIREBASE_APP_ID: z.string().optional(),
  API_BASE_URL: z.string().url().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().optional(),
  REPLY_TO_EMAIL: z.string().optional(),
});

function readServerEnv() {
  if (typeof process === "undefined") {
    return serverSchema.parse({});
  }

  return serverSchema.parse({
    CONVEX_SELF_HOSTED_URL: process.env.CONVEX_SELF_HOSTED_URL,
    PUBLIC_GOOGLE_CALENDAR_ID: process.env.PUBLIC_GOOGLE_CALENDAR_ID,
    FIREBASE_PRIVATE_KEY_ID: process.env.FIREBASE_PRIVATE_KEY_ID,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    PUBLIC_FIREBASE_PROJECT_ID: process.env.PUBLIC_FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_CLIENT_ID: process.env.FIREBASE_CLIENT_ID,
    FIREBASE_AUTH_URL: process.env.FIREBASE_AUTH_URL,
    FIREBASE_TOKEN_URL: process.env.FIREBASE_TOKEN_URL,
    FIREBASE_AUTH_CERT_URL: process.env.FIREBASE_AUTH_CERT_URL,
    FIREBASE_CLIENT_CERT_URL: process.env.FIREBASE_CLIENT_CERT_URL,
    PUBLIC_FIREBASE_WEB_API_KEY: process.env.PUBLIC_FIREBASE_WEB_API_KEY,
    PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    PUBLIC_FIREBASE_APP_ID: process.env.PUBLIC_FIREBASE_APP_ID,
    API_BASE_URL: process.env.API_BASE_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FROM_EMAIL: process.env.FROM_EMAIL,
    REPLY_TO_EMAIL: process.env.REPLY_TO_EMAIL,
  });
}

export const serverEnv = readServerEnv();

export const firebaseServerEnv = {
  projectId: serverEnv.PUBLIC_FIREBASE_PROJECT_ID ?? "",
  privateKeyId: serverEnv.FIREBASE_PRIVATE_KEY_ID ?? "",
  privateKey: serverEnv.FIREBASE_PRIVATE_KEY ?? "",
  clientEmail: serverEnv.FIREBASE_CLIENT_EMAIL ?? "",
  clientId: serverEnv.FIREBASE_CLIENT_ID ?? "",
  authUri:
    serverEnv.FIREBASE_AUTH_URL ?? "https://accounts.google.com/o/oauth2/auth",
  tokenUri:
    serverEnv.FIREBASE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
  authCertUrl:
    serverEnv.FIREBASE_AUTH_CERT_URL ??
    "https://www.googleapis.com/oauth2/v1/certs",
  clientCertUrl: serverEnv.FIREBASE_CLIENT_CERT_URL ?? "",
  apiKey: serverEnv.PUBLIC_FIREBASE_WEB_API_KEY ?? "",
  authDomain: serverEnv.PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  storageBucket: serverEnv.PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: serverEnv.PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: serverEnv.PUBLIC_FIREBASE_APP_ID ?? "",
};

export function requireServerEnv<K extends keyof typeof serverEnv>(
  key: K,
  feature: string,
): NonNullable<(typeof serverEnv)[K]> {
  const value = serverEnv[key];
  if (!value || (typeof value === "string" && value.trim() === "")) {
    throw new Error(
      `Missing required environment variable ${String(key)} for ${feature}`,
    );
  }
  return value;
}
