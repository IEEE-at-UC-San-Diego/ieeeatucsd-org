import { z } from "zod";

/**
 * Define a schema for environment variables with Zod
 * This provides type safety and validation for environment variables
 */
const envSchema = z.object({
  // LogTo Configuration
  LOGTO_APP_ID: z.string().min(1, "LOGTO_APP_ID is required"),
  LOGTO_APP_SECRET: z.string().min(1, "LOGTO_APP_SECRET is required"),
  LOGTO_ENDPOINT: z.string().url("LOGTO_ENDPOINT must be a valid URL"),
  LOGTO_TOKEN_ENDPOINT: z
    .string()
    .url("LOGTO_TOKEN_ENDPOINT must be a valid URL"),
  LOGTO_API_ENDPOINT: z.string().url("LOGTO_API_ENDPOINT must be a valid URL"),
  LOGTO_USERINFO_ENDPOINT: z
    .string()
    .url("LOGTO_USERINFO_ENDPOINT must be a valid URL"),
  // API Base URL (optional)
  API_BASE_URL: z.string().url("API_BASE_URL must be a valid URL").optional(),
});

/**
 * Parse and validate environment variables
 * This will throw an error if any required variables are missing or invalid
 */
function getEnvVariables() {
  // In development, use import.meta.env (Vite/Astro)
  if (import.meta.env) {
    const envVars = {
      LOGTO_APP_ID: import.meta.env.LOGTO_APP_ID,
      LOGTO_APP_SECRET: import.meta.env.LOGTO_APP_SECRET,
      LOGTO_ENDPOINT: import.meta.env.LOGTO_ENDPOINT,
      LOGTO_TOKEN_ENDPOINT: import.meta.env.LOGTO_TOKEN_ENDPOINT,
      LOGTO_API_ENDPOINT: import.meta.env.LOGTO_API_ENDPOINT,
      LOGTO_USERINFO_ENDPOINT: import.meta.env.LOGTO_USERINFO_ENDPOINT,
      API_BASE_URL: import.meta.env.API_BASE_URL,
    };

    try {
      return envSchema.parse(envVars);
    } catch (error) {
      console.error("Environment variable validation failed:", error);

      // Log which variables are missing or invalid
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          console.error(`- ${err.path.join(".")}: ${err.message}`);
        });
      }

      // Return default values for development with warnings
      console.warn(
        "Using fallback values for development. DO NOT USE IN PRODUCTION!",
      );
      return {
        LOGTO_APP_ID: import.meta.env.LOGTO_APP_ID || "development_app_id",
        LOGTO_APP_SECRET:
          import.meta.env.LOGTO_APP_SECRET || "development_app_secret",
        LOGTO_ENDPOINT:
          import.meta.env.LOGTO_ENDPOINT || "https://auth.ieeeucsd.org",
        LOGTO_TOKEN_ENDPOINT:
          import.meta.env.LOGTO_TOKEN_ENDPOINT ||
          "https://auth.ieeeucsd.org/oidc/token",
        LOGTO_API_ENDPOINT:
          import.meta.env.LOGTO_API_ENDPOINT || "https://auth.ieeeucsd.org",
        LOGTO_USERINFO_ENDPOINT:
          import.meta.env.LOGTO_USERINFO_ENDPOINT ||
          "https://auth.ieeeucsd.org/oidc/me",
        API_BASE_URL: import.meta.env.API_BASE_URL || "http://localhost:4321",
      };
    }
  }

  // In Node.js environment (server-side)
  if (typeof process !== "undefined" && process.env) {
    const envVars = {
      LOGTO_APP_ID: process.env.LOGTO_APP_ID || "",
      LOGTO_APP_SECRET: process.env.LOGTO_APP_SECRET || "",
      LOGTO_ENDPOINT: process.env.LOGTO_ENDPOINT || "",
      LOGTO_TOKEN_ENDPOINT: process.env.LOGTO_TOKEN_ENDPOINT || "",
      LOGTO_API_ENDPOINT: process.env.LOGTO_API_ENDPOINT || "",
      LOGTO_USERINFO_ENDPOINT: process.env.LOGTO_USERINFO_ENDPOINT || "",
      API_BASE_URL: process.env.API_BASE_URL,
    };

    try {
      return envSchema.parse(envVars);
    } catch (error) {
      console.error("Environment variable validation failed:", error);
      throw new Error("Missing or invalid environment variables");
    }
  }

  // Fallback for other environments
  throw new Error("Unable to load environment variables");
}

// Export the validated environment variables
export const env = getEnvVariables();

// Type definition for the environment variables
export type Env = z.infer<typeof envSchema>;
