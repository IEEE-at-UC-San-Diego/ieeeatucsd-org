export { clientEnv, firebaseClientEnv } from "./env/client";

export { serverEnv, firebaseServerEnv, requireServerEnv } from "./env/server";

export const isDevelopment =
  (typeof process !== "undefined" && process.env.NODE_ENV === "development") ||
  (typeof import.meta !== "undefined" && import.meta.env?.DEV);

export const isProduction =
  (typeof process !== "undefined" && process.env.NODE_ENV === "production") ||
  (typeof import.meta !== "undefined" && import.meta.env?.PROD);

import { firebaseClientEnv } from "./env/client";
import { firebaseServerEnv } from "./env/server";

/** @deprecated Import from ./env/client or ./env/server instead */
export const firebaseEnv =
  typeof window === "undefined" ? firebaseServerEnv : firebaseClientEnv;

export function validateFirebaseClientConfig(): {
  isValid: boolean;
  missing: string[];
  errors: string[];
} {
  const missing: string[] = [];
  const errors: string[] = [];

  if (!firebaseClientEnv.apiKey?.trim()) {
    missing.push("PUBLIC_FIREBASE_WEB_API_KEY");
  }
  if (!firebaseClientEnv.projectId?.trim()) {
    missing.push("PUBLIC_FIREBASE_PROJECT_ID");
  }

  if (
    firebaseClientEnv.apiKey &&
    !firebaseClientEnv.apiKey.startsWith("AIza")
  ) {
    errors.push(
      'PUBLIC_FIREBASE_WEB_API_KEY should start with "AIza" and be a valid API key',
    );
  }

  if (
    firebaseClientEnv.projectId &&
    !/^[a-z0-9-]+$/.test(firebaseClientEnv.projectId)
  ) {
    errors.push(
      "PUBLIC_FIREBASE_PROJECT_ID should contain only lowercase letters, numbers, and dashes",
    );
  }

  return {
    isValid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

export function validateFirebaseServerConfig(): {
  isValid: boolean;
  missing: string[];
  errors: string[];
} {
  const missing: string[] = [];
  const errors: string[] = [];

  if (!firebaseServerEnv.projectId?.trim()) {
    missing.push("PUBLIC_FIREBASE_PROJECT_ID");
  }
  if (!firebaseServerEnv.privateKey?.trim()) {
    missing.push("FIREBASE_PRIVATE_KEY");
  }
  if (!firebaseServerEnv.clientEmail?.trim()) {
    missing.push("FIREBASE_CLIENT_EMAIL");
  }

  if (
    firebaseServerEnv.clientEmail &&
    !firebaseServerEnv.clientEmail.includes("@")
  ) {
    errors.push(
      "FIREBASE_CLIENT_EMAIL should be a valid service account email",
    );
  }

  if (
    firebaseServerEnv.privateKey &&
    !firebaseServerEnv.privateKey.includes("BEGIN PRIVATE KEY")
  ) {
    errors.push("FIREBASE_PRIVATE_KEY should be a valid private key");
  }

  return {
    isValid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

export function validateFirebaseConfig(): boolean {
  return validateFirebaseClientConfig().isValid;
}

export const env = {
  firebase: firebaseEnv,
  isDev: isDevelopment,
  isProd: isProduction,
  validateFirebaseConfig,
  validateFirebaseClientConfig,
  validateFirebaseServerConfig,
};

export const firebaseConfig = firebaseEnv;

export const websiteEnv = {
  get convexSelfHostedUrl() {
    return typeof process !== "undefined"
      ? (process.env.CONVEX_SELF_HOSTED_URL ?? "")
      : "";
  },
  get publicGoogleCalendarId() {
    return (
      (typeof import.meta !== "undefined" &&
        import.meta.env.PUBLIC_GOOGLE_CALENDAR_ID) ||
      (typeof process !== "undefined" &&
        process.env.PUBLIC_GOOGLE_CALENDAR_ID) ||
      ""
    );
  },
};
