import { z } from "zod";

// Load dotenv only on server-side
let dotenvLoaded = false;
if (
  typeof process !== "undefined" &&
  typeof window === "undefined" &&
  !dotenvLoaded
) {
  try {
    // Use require for synchronous loading when available
    if (typeof require !== "undefined") {
      require("dotenv").config();
    }
    dotenvLoaded = true;
  } catch (error) {
    console.warn("Failed to load dotenv:", error);
  }
}

interface ImportMetaEnv {
  // Firebase Environment Variables
  readonly FIREBASE_PRIVATE_KEY_ID: string;
  readonly FIREBASE_PRIVATE_KEY: string;
  readonly PUBLIC_FIREBASE_PROJECT_ID: string;
  readonly FIREBASE_CLIENT_EMAIL: string;
  readonly FIREBASE_CLIENT_ID: string;
  readonly FIREBASE_AUTH_URI: string;
  readonly FIREBASE_TOKEN_URI: string;
  readonly FIREBASE_AUTH_CERT_URL: string;
  readonly FIREBASE_CLIENT_CERT_URL: string;
  readonly PUBLIC_FIREBASE_WEB_API_KEY: string;
  readonly PUBLIC_FIREBASE_AUTH_DOMAIN: string;
  readonly PUBLIC_FIREBASE_STORAGE_BUCKET: string;
  readonly PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly PUBLIC_FIREBASE_APP_ID: string;

  // LogTo Configuration
  readonly LOGTO_APP_ID: string;
  readonly LOGTO_APP_SECRET: string;
  readonly LOGTO_ENDPOINT: string;
  readonly LOGTO_TOKEN_ENDPOINT: string;
  readonly LOGTO_API_ENDPOINT: string;
  readonly LOGTO_USERINFO_ENDPOINT: string;
  readonly API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Helper function to get environment variable with fallback
function getEnvVar(key: string, fallback: string = ""): string {
  // Try process.env first (for dotenv), then import.meta.env (for Astro)
  if (typeof process !== "undefined" && process.env[key]) {
    return process.env[key] || fallback;
  }
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env[key]
  ) {
    return import.meta.env[key] || fallback;
  }
  return fallback;
}

/**
 * Firebase environment configuration using dotenv and Astro's environment system
 */
export const firebaseEnv = {
  // Client-side configuration (for web app)
  apiKey: getEnvVar("PUBLIC_FIREBASE_WEB_API_KEY"),
  authDomain: getEnvVar("PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnvVar("PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: getEnvVar("PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnvVar("PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnvVar("PUBLIC_FIREBASE_APP_ID"),

  // Server-side configuration (service account)
  privateKeyId: getEnvVar("FIREBASE_PRIVATE_KEY_ID"),
  privateKey: getEnvVar("FIREBASE_PRIVATE_KEY"), // dotenv should auto-parse this
  clientEmail: getEnvVar("FIREBASE_CLIENT_EMAIL"),
  clientId: getEnvVar("FIREBASE_CLIENT_ID"),
  authUri: getEnvVar(
    "FIREBASE_AUTH_URL",
    "https://accounts.google.com/o/oauth2/auth",
  ),
  tokenUri: getEnvVar(
    "FIREBASE_TOKEN_URL",
    "https://oauth2.googleapis.com/token",
  ),
  authCertUrl: getEnvVar(
    "FIREBASE_AUTH_CERT_URL",
    "https://www.googleapis.com/oauth2/v1/certs",
  ),
  clientCertUrl: getEnvVar("FIREBASE_CLIENT_CERT_URL"),
};

// Other environment variables
export const isDevelopment =
  (typeof process !== "undefined" && process.env.NODE_ENV === "development") ||
  (typeof import.meta !== "undefined" && import.meta.env?.DEV);
export const isProduction =
  (typeof process !== "undefined" && process.env.NODE_ENV === "production") ||
  (typeof import.meta !== "undefined" && import.meta.env?.PROD);

/**
 * Validate Firebase configuration for client-side usage
 */
export function validateFirebaseClientConfig(): {
  isValid: boolean;
  missing: string[];
  errors: string[];
} {
  const missing: string[] = [];
  const errors: string[] = [];

  // Required for client-side Firebase
  const requiredClientFields = [
    {
      key: "apiKey",
      value: firebaseEnv.apiKey,
      name: "PUBLIC_FIREBASE_WEB_API_KEY",
    },
    {
      key: "projectId",
      value: firebaseEnv.projectId,
      name: "PUBLIC_FIREBASE_PROJECT_ID",
    },
  ];

  requiredClientFields.forEach((field) => {
    if (!field.value || field.value.trim() === "") {
      missing.push(field.name);
    }
  });

  // Validate API key format (should be a long string starting with AIza)
  if (firebaseEnv.apiKey && !firebaseEnv.apiKey.startsWith("AIza")) {
    errors.push(
      'PUBLIC_FIREBASE_WEB_API_KEY should start with "AIza" and be a valid API key',
    );
  }

  // Validate project ID format (should be lowercase with dashes)
  if (firebaseEnv.projectId && !/^[a-z0-9-]+$/.test(firebaseEnv.projectId)) {
    errors.push(
      "PUBLIC_FIREBASE_PROJECT_ID should contain only lowercase letters, numbers, and dashes",
    );
  }

  // Check for placeholder values
  const placeholderValues = [
    "your-api-key",
    "your-project-id",
    "placeholder",
    "example",
  ];
  [firebaseEnv.apiKey, firebaseEnv.projectId].forEach((value, index) => {
    if (
      value &&
      placeholderValues.some((placeholder) =>
        value.toLowerCase().includes(placeholder),
      )
    ) {
      const fieldName =
        index === 0
          ? "PUBLIC_FIREBASE_WEB_API_KEY"
          : "PUBLIC_FIREBASE_PROJECT_ID";
      errors.push(`${fieldName} appears to be a placeholder value`);
    }
  });

  return {
    isValid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

/**
 * Validate Firebase configuration for server-side usage
 */
export function validateFirebaseServerConfig(): {
  isValid: boolean;
  missing: string[];
  errors: string[];
} {
  const missing: string[] = [];
  const errors: string[] = [];

  // Required for server-side Firebase
  const requiredServerFields = [
    {
      key: "projectId",
      value: firebaseEnv.projectId,
      name: "PUBLIC_FIREBASE_PROJECT_ID",
    },
    {
      key: "privateKey",
      value: firebaseEnv.privateKey,
      name: "FIREBASE_PRIVATE_KEY",
    },
    {
      key: "clientEmail",
      value: firebaseEnv.clientEmail,
      name: "FIREBASE_CLIENT_EMAIL",
    },
  ];

  requiredServerFields.forEach((field) => {
    if (!field.value || field.value.trim() === "") {
      missing.push(field.name);
    }
  });

  // Validate client email format
  if (firebaseEnv.clientEmail && !firebaseEnv.clientEmail.includes("@")) {
    errors.push(
      "FIREBASE_CLIENT_EMAIL should be a valid service account email",
    );
  }

  // Validate private key format (dotenv should handle parsing)
  if (
    firebaseEnv.privateKey &&
    !firebaseEnv.privateKey.includes("BEGIN PRIVATE KEY")
  ) {
    errors.push("FIREBASE_PRIVATE_KEY should be a valid private key");
  }

  return {
    isValid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

/**
 * Legacy validation function for backward compatibility
 */
export function validateFirebaseConfig(): boolean {
  const clientValidation = validateFirebaseClientConfig();
  return clientValidation.isValid;
}

// Legacy export for backward compatibility
export const env = {
  firebase: firebaseEnv,
  isDev: isDevelopment,
  isProd: isProduction,
  validateFirebaseConfig,
  validateFirebaseClientConfig,
  validateFirebaseServerConfig,
};

// Export individual configs for convenience
export const firebaseConfig = firebaseEnv;
