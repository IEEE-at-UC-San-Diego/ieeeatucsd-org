import { z } from "zod";

const clientSchema = z.object({
  PUBLIC_DASHBOARD_URL: z.string().url().optional(),
  PUBLIC_GOOGLE_CALENDAR_ID: z.string().optional(),
});

function readClientEnv() {
  const source =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env
      : ({} as Record<string, string | undefined>);

  return clientSchema.parse({
    PUBLIC_DASHBOARD_URL: source.PUBLIC_DASHBOARD_URL,
    PUBLIC_GOOGLE_CALENDAR_ID: source.PUBLIC_GOOGLE_CALENDAR_ID,
  });
}

export const clientEnv = readClientEnv();
