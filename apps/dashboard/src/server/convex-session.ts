import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@/types/roles";
import { env } from "@/env";

export const CONVEX_SESSION_TTL_SECONDS = 5 * 60;
export const CONVEX_SESSION_REFRESH_WINDOW_SECONDS = 60;

export type ConvexSessionPayload = {
  sub: string;
  role?: UserRole;
  iat: number;
  exp: number;
  v: 1;
};

function getSessionSecret() {
  const secret = env.CONVEX_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing required env: CONVEX_SESSION_SECRET");
  }
  return secret;
}

function sign(input: string, secret: string) {
  return createHmac("sha256", secret).update(input).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function createConvexSessionToken(params: {
  sub: string;
  role?: UserRole;
  nowMs?: number;
}) {
  const nowMs = params.nowMs ?? Date.now();
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + CONVEX_SESSION_TTL_SECONDS;
  const payload: ConvexSessionPayload = {
    sub: params.sub,
    role: params.role,
    iat,
    exp,
    v: 1,
  };

  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  const signature = sign(encodedPayload, getSessionSecret());
  return {
    token: `${encodedPayload}.${signature}`,
    payload,
  };
}

export function verifyConvexSessionToken(token: string): ConvexSessionPayload {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Invalid session token format");
  }

  const [encodedPayload, signature] = parts;
  const expected = sign(encodedPayload, getSessionSecret());
  if (!safeEqualHex(signature, expected)) {
    throw new Error("Invalid session token signature");
  }

  let payload: ConvexSessionPayload;
  try {
    payload = JSON.parse(decodeURIComponent(encodedPayload)) as ConvexSessionPayload;
  } catch {
    throw new Error("Invalid session token payload");
  }

  if (!payload.sub || !payload.iat || !payload.exp || payload.v !== 1) {
    throw new Error("Invalid session token claims");
  }

  if (Date.now() >= payload.exp * 1000) {
    throw new Error("Session token expired");
  }

  return payload;
}

export function shouldRefreshConvexSessionToken(expUnixSeconds: number, nowMs = Date.now()) {
  const now = Math.floor(nowMs / 1000);
  return expUnixSeconds - now <= CONVEX_SESSION_REFRESH_WINDOW_SECONDS;
}
