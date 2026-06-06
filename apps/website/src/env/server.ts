import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(currentDir, "../..");
const monorepoRoot = resolve(currentDir, "../../..");

function loadLocalEnvFiles() {
  if (typeof process === "undefined") {
    return;
  }

  // Astro dev runs SSR modules in Vite's module runner, which does not inherit
  // .env values into process.env. Load env files explicitly for local development.
  const shellEnv = { ...process.env };

  for (const envPath of [
    resolve(monorepoRoot, ".env"),
    resolve(monorepoRoot, ".env.local"),
    resolve(websiteRoot, ".env"),
    resolve(websiteRoot, ".env.local"),
  ]) {
    config({ path: envPath, override: true, quiet: true });
  }

  for (const [key, value] of Object.entries(shellEnv)) {
    process.env[key] = value;
  }
}

loadLocalEnvFiles();

function readEnv(key: string): string | undefined {
  const fromProcess =
    typeof process !== "undefined" ? process.env[key] : undefined;
  if (fromProcess !== undefined && fromProcess !== "") {
    return fromProcess;
  }

  const meta = import.meta.env as Record<string, string | undefined>;
  const fromMeta = meta[key];
  if (fromMeta !== undefined && fromMeta !== "") {
    return fromMeta;
  }

  return undefined;
}

const serverSchema = z.object({
  CONVEX_SELF_HOSTED_URL: z.string().url().optional(),
  PUBLIC_GOOGLE_CALENDAR_ID: z.string().optional(),
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
    CONVEX_SELF_HOSTED_URL: readEnv("CONVEX_SELF_HOSTED_URL"),
    PUBLIC_GOOGLE_CALENDAR_ID: readEnv("PUBLIC_GOOGLE_CALENDAR_ID"),
    API_BASE_URL: readEnv("API_BASE_URL"),
    OPENROUTER_API_KEY: readEnv("OPENROUTER_API_KEY"),
    RESEND_API_KEY: readEnv("RESEND_API_KEY"),
    FROM_EMAIL: readEnv("FROM_EMAIL"),
    REPLY_TO_EMAIL: readEnv("REPLY_TO_EMAIL"),
  });
}

export const serverEnv = readServerEnv();

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
