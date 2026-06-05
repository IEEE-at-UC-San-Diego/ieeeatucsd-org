import { getAuthBridgeMode } from "./mode";

type AuthLogFields = Record<string, unknown>;

function safeFields(fields: AuthLogFields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

export function createAuthRequestId(prefix = "auth") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}`;
}

export function logAuthEvent(event: string, fields: AuthLogFields = {}) {
  const payload = {
    type: "auth_event",
    event,
    authBridgeMode: getAuthBridgeMode(),
    timestamp: new Date().toISOString(),
    ...safeFields(fields),
  };

  console.info(JSON.stringify(payload));
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
