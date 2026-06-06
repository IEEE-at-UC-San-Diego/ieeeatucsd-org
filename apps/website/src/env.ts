export { clientEnv } from "./env/client";

export { serverEnv, requireServerEnv } from "./env/server";

export const isDevelopment =
  (typeof process !== "undefined" && process.env.NODE_ENV === "development") ||
  (typeof import.meta !== "undefined" && import.meta.env?.DEV);

export const isProduction =
  (typeof process !== "undefined" && process.env.NODE_ENV === "production") ||
  (typeof import.meta !== "undefined" && import.meta.env?.PROD);

export const env = {
  isDev: isDevelopment,
  isProd: isProduction,
};

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
