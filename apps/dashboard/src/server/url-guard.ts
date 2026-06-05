import { isIP } from "node:net";
import { env } from "@/env";

function isPrivateIp(hostname: string) {
  const ipType = isIP(hostname);
  if (!ipType) return false;

  if (ipType === 4) {
    const [a, b] = hostname.split(".").map((n) => Number.parseInt(n, 10));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  const normalized = hostname.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd");
}

function getAllowlistedHosts() {
  const hosts = new Set<string>();
  const candidates = [
    env.VITE_CONVEX_URL,
    process.env.CONVEX_URL,
    process.env.VITE_CONVEX_URL,
    env.SERVER_URL,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      hosts.add(new URL(candidate).hostname.toLowerCase());
    } catch {
      // Ignore malformed values.
    }
  }

  if (env.ALLOWED_FILE_FETCH_HOSTS) {
    for (const host of env.ALLOWED_FILE_FETCH_HOSTS.split(",")) {
      const trimmed = host.trim().toLowerCase();
      if (trimmed) hosts.add(trimmed);
    }
  }

  return hosts;
}

export function validateExternalFileUrl(value: string) {
  if (value.startsWith("data:")) {
    return { ok: true as const };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false as const, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false as const, reason: "Unsupported URL protocol" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false as const, reason: "URL credentials are not allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return { ok: false as const, reason: "Localhost URLs are not allowed" };
  }
  if (isPrivateIp(hostname)) {
    return { ok: false as const, reason: "Private-network URLs are not allowed" };
  }

  const allowlisted = getAllowlistedHosts();
  if (allowlisted.size === 0) {
    return { ok: false as const, reason: "No allowlisted file hosts configured" };
  }

  const isAllowed = [...allowlisted].some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
  if (!isAllowed) {
    return { ok: false as const, reason: "Host is not allowlisted" };
  }

  return { ok: true as const };
}
