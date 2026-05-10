import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import {
  generateGoogleCalendarEventId,
  isManagedGoogleCalendarEventId,
} from "./googleCalendarIds";
import { normalizeGoogleCalendarEventsForSync } from "./googleCalendarEventUtils";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

interface GoogleConfig {
  clientEmail: string;
  privateKey: string;
  privateCalendarId: string;
  publicCalendarId: string;
}

interface CalendarSyncStats {
  calendarId: string;
  existingCount: number;
  managedExistingCount: number;
  upsertCount: number;
  deletedCount: number;
  deferredDeleteCount: number;
  staleCandidateCount: number;
  sourceMaxStartMs?: number;
  previousSourceCount?: number;
  pruneSkippedReason?: string;
  nextSyncState: GoogleCalendarSyncState;
}

export interface GoogleCalendarStaleCandidate {
  eventId: string;
  firstSeenMissingAt: number;
  lastSeenMissingAt: number;
  missingSyncCount: number;
  startMs?: number;
}

export interface GoogleCalendarSyncState {
  calendarId: string;
  lastSuccessfulSourceCount?: number;
  staleCandidates: GoogleCalendarStaleCandidate[];
  updatedAt: number;
}

interface SyncCalendarOptions {
  allowEmptyPrune: boolean;
  syncState?: GoogleCalendarSyncState | null;
  nowMs?: number;
}

interface RunGoogleCalendarSyncOptions {
  entrypoint: "scheduledSync" | "syncToGoogleCalendar";
  allowEmptyPrune: boolean;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
const GOOGLE_API_MAX_RETRIES = 5;
const GOOGLE_CALENDAR_MAX_RESULTS = 2500;
const GOOGLE_CALENDAR_CONCURRENCY = 5;
const GOOGLE_CALENDAR_SYNC_VERSION = "gcal-sync-two-phase-prune-2026-05-10";
const GOOGLE_CALENDAR_SOURCE_DROP_RATIO = 0.5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelayMs(attempt: number): number {
  const base = 500 * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(base + jitter, 10_000);
}

function isRetryableGoogleError(status: number, reason?: string): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  if (status === 403) {
    return (
      reason === "rateLimitExceeded" ||
      reason === "userRateLimitExceeded" ||
      reason === "quotaExceeded" ||
      reason === "backendError"
    );
  }

  return false;
}

function redactCalendarId(calendarId: string): string {
  const suffix = calendarId.slice(-8);
  return `...${suffix}`;
}

function parseCalendarEventStartMs(event: CalendarEvent): number | null {
  const startMs = Date.parse(event.start.dateTime);
  return Number.isFinite(startMs) ? startMs : null;
}

function getLatestCalendarEventStartMs(events: CalendarEvent[]): number | undefined {
  const startTimes = events
    .map(parseCalendarEventStartMs)
    .filter((startMs): startMs is number => startMs !== null);

  if (startTimes.length === 0) {
    return undefined;
  }

  return Math.max(...startTimes);
}

function hasLargeSourceCountDrop(
  sourceCount: number,
  syncState?: GoogleCalendarSyncState | null,
): boolean {
  const previousSourceCount = syncState?.lastSuccessfulSourceCount;
  return (
    previousSourceCount !== undefined &&
    previousSourceCount > 0 &&
    sourceCount < previousSourceCount * GOOGLE_CALENDAR_SOURCE_DROP_RATIO
  );
}

function buildNextSyncState(
  calendarId: string,
  sourceCount: number,
  staleManagedEvents: CalendarEvent[],
  deletedEventIds: Set<string>,
  syncState: GoogleCalendarSyncState | null | undefined,
  nowMs: number,
  updateLastSuccessfulSourceCount: boolean,
): GoogleCalendarSyncState {
  const previousCandidates = new Map(
    (syncState?.staleCandidates ?? []).map((candidate) => [candidate.eventId, candidate]),
  );

  const staleCandidates = staleManagedEvents
    .filter((event) => event.id && !deletedEventIds.has(event.id))
    .map((event) => {
      const previous = previousCandidates.get(event.id);
      const startMs = parseCalendarEventStartMs(event) ?? undefined;
      return {
        eventId: event.id,
        firstSeenMissingAt: previous?.firstSeenMissingAt ?? nowMs,
        lastSeenMissingAt: nowMs,
        missingSyncCount: (previous?.missingSyncCount ?? 0) + 1,
        ...(startMs !== undefined ? { startMs } : {}),
      };
    });

  const lastSuccessfulSourceCount = updateLastSuccessfulSourceCount
    ? sourceCount
    : syncState?.lastSuccessfulSourceCount;

  return {
    calendarId,
    staleCandidates,
    updatedAt: nowMs,
    ...(lastSuccessfulSourceCount !== undefined ? { lastSuccessfulSourceCount } : {}),
  };
}

function getGoogleCalendarConfig(): GoogleConfig {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const privateCalendarId = process.env.PRIVATE_GOOGLE_CALENDAR_ID;
  const publicCalendarId = process.env.PUBLIC_GOOGLE_CALENDAR_ID;

  if (!clientEmail) {
    throw new ConvexError("GOOGLE_CLIENT_EMAIL not configured");
  }

  if (!privateKey) {
    throw new ConvexError("GOOGLE_PRIVATE_KEY not configured");
  }

  if (!privateCalendarId) {
    throw new ConvexError("PRIVATE_GOOGLE_CALENDAR_ID not configured");
  }

  if (!publicCalendarId) {
    throw new ConvexError("PUBLIC_GOOGLE_CALENDAR_ID not configured");
  }

  return { clientEmail, privateKey, privateCalendarId, publicCalendarId };
}

function parseGoogleApiError(errorText: string): { message: string; reason?: string } {
  try {
    const parsed = JSON.parse(errorText);
    const message = parsed?.error?.message || errorText;
    const reason = parsed?.error?.errors?.[0]?.reason;
    return { message, reason };
  } catch {
    return { message: errorText };
  }
}

async function fetchGoogleWithRetry(
  url: string,
  init: RequestInit,
  context: string,
  allowedStatuses: number[] = [],
): Promise<Response> {
  for (let attempt = 0; attempt <= GOOGLE_API_MAX_RETRIES; attempt++) {
    const response = await fetch(url, init);
    if (response.ok || allowedStatuses.includes(response.status)) {
      return response;
    }

    const errorText = await response.text();
    const googleError = parseGoogleApiError(errorText);
    if (isRetryableGoogleError(response.status, googleError.reason) && attempt < GOOGLE_API_MAX_RETRIES) {
      await sleep(backoffDelayMs(attempt));
      continue;
    }

    throw new Error(`${context} (${response.status}): ${errorText || googleError.message}`);
  }

  throw new Error(`${context}: exhausted retries`);
}

function base64UrlEncodeString(value: string): string {
  const base64 = btoa(value);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function parsePkcs8PrivateKey(privateKey: string): ArrayBuffer {
  const pemBody = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const binary = atob(pemBody);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getGoogleAccessToken(config: GoogleConfig): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: config.clientEmail,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
  };

  const encodedHeader = base64UrlEncodeString(JSON.stringify(header));
  const encodedPayload = base64UrlEncodeString(JSON.stringify(payload));
  const unsignedAssertion = `${encodedHeader}.${encodedPayload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    parsePkcs8PrivateKey(config.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedAssertion),
  );

  const signedAssertion = `${unsignedAssertion}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedAssertion,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new ConvexError(`Failed to obtain Google access token: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  const accessToken: string | undefined = tokenData.access_token;
  const expiresIn: number = tokenData.expires_in || 3600;
  if (!accessToken) {
    throw new ConvexError("Google OAuth response did not include access_token");
  }

  cachedAccessToken = {
    token: accessToken,
    expiresAt: now + expiresIn * 1000,
  };

  return accessToken;
}

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
): Promise<CalendarEvent[]> {
  const now = new Date();
  const threeMonthsLater = new Date();
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

  const timeMin = now.toISOString();
  const timeMax = threeMonthsLater.toISOString();
  const allEvents: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: GOOGLE_CALENDAR_MAX_RESULTS.toString(),
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

    const response = await fetchGoogleWithRetry(
      url,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      `Failed to fetch Google Calendar events for calendar ${calendarId}`,
      [401, 403, 404],
    );
    if (!response.ok) {
      const errorText = await response.text();
      const googleError = parseGoogleApiError(errorText);

      if (response.status === 404 || googleError.reason === "notFound") {
        throw new ConvexError(
          `Google Calendar not found. Verify calendar ID and sharing for service account: ${calendarId}`,
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new ConvexError(
          `Google Calendar authorization failed (${response.status}). Verify service account access to calendar: ${calendarId}`,
        );
      }

      throw new Error(
        `Failed to fetch Google Calendar events (${response.status}): ${googleError.message}`,
      );
    }

    const data = (await response.json()) as {
      items?: CalendarEvent[];
      nextPageToken?: string;
    };
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents;
}

async function createOrUpdateGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: CalendarEvent,
): Promise<void> {
  const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${event.id}`;
  const updateResponse = await fetchGoogleWithRetry(
    updateUrl,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
    `Failed to update Google Calendar event for calendar ${calendarId}`,
    [404],
  );

  if (updateResponse.ok) {
    return;
  }

  // Event doesn't exist yet in this calendar, create it with the same stable ID.
  if (updateResponse.status === 404) {
    const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const createResponse = await fetchGoogleWithRetry(
      createUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      },
      `Failed to create Google Calendar event for calendar ${calendarId}`,
      [409],
    );

    // Another writer may have created the same stable ID concurrently.
    if (createResponse.ok || createResponse.status === 409) {
      return;
    }

    const createError = await createResponse.text();
    throw new Error(
      `Failed to create Google Calendar event (${createResponse.status}) for calendar ${calendarId}: ${createError}`,
    );
  }

  const updateError = await updateResponse.text();
  throw new Error(
    `Failed to update Google Calendar event (${updateResponse.status}) for calendar ${calendarId}: ${updateError}`,
  );
}

async function deleteGoogleEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;

  const response = await fetchGoogleWithRetry(
    url,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    `Failed to delete Google Calendar event for calendar ${calendarId}`,
    [404],
  );

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Failed to delete event from Google Calendar: ${error}`);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<void>,
) {
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async (_, workerIndex) => {
    for (let index = workerIndex; index < items.length; index += limit) {
      await run(items[index]!);
    }
  });

  await Promise.all(workers);
}

function toPublishedCalendarEvent(event: {
  _id: string;
  eventName: string;
  eventDescription?: string;
  location?: string;
  startDate: number;
  endDate: number;
}): CalendarEvent {
  return {
    id: generateGoogleCalendarEventId("published", event._id),
    summary: event.eventName,
    description: event.eventDescription,
    location: event.location,
    start: {
      dateTime: new Date(event.startDate).toISOString(),
      timeZone: "America/Los_Angeles",
    },
    end: {
      dateTime: new Date(event.endDate).toISOString(),
      timeZone: "America/Los_Angeles",
    },
  };
}

function toInternalCalendarEvent(event: {
  _id: string;
  name: string;
  description?: string;
  location?: string;
  startDate: number;
  endDate: number;
}): CalendarEvent {
  return {
    id: generateGoogleCalendarEventId("internal", event._id),
    summary: `[Internal] ${event.name}`,
    description: event.description,
    location: event.location,
    start: {
      dateTime: new Date(event.startDate).toISOString(),
      timeZone: "America/Los_Angeles",
    },
    end: {
      dateTime: new Date(event.endDate).toISOString(),
      timeZone: "America/Los_Angeles",
    },
  };
}

export async function syncCalendar(
  accessToken: string,
  calendarId: string,
  eventsToUpsert: CalendarEvent[],
  options: SyncCalendarOptions = { allowEmptyPrune: false },
): Promise<CalendarSyncStats> {
  const nowMs = options.nowMs ?? Date.now();
  const existingEvents = await fetchGoogleCalendarEvents(accessToken, calendarId);
  const validEventsToUpsert = normalizeGoogleCalendarEventsForSync(calendarId, eventsToUpsert);
  const sourceCount = validEventsToUpsert.length;
  const validManagedEventIds = new Set(validEventsToUpsert.map((event) => event.id));
  const sourceMaxStartMs = getLatestCalendarEventStartMs(validEventsToUpsert);
  const managedExistingEvents = existingEvents.filter(
    (gEvent) => gEvent.id && isManagedGoogleCalendarEventId(gEvent.id),
  );
  const staleManagedEvents = existingEvents.filter(
    (gEvent) =>
      gEvent.id &&
      isManagedGoogleCalendarEventId(gEvent.id) &&
      !validManagedEventIds.has(gEvent.id),
  );

  await runWithConcurrency(validEventsToUpsert, GOOGLE_CALENDAR_CONCURRENCY, async (event) => {
    await createOrUpdateGoogleEvent(accessToken, calendarId, event);
  });

  if (options.allowEmptyPrune) {
    await runWithConcurrency(staleManagedEvents, GOOGLE_CALENDAR_CONCURRENCY, async (gEvent) => {
      await deleteGoogleEvent(accessToken, calendarId, gEvent.id);
    });

    const deletedEventIds = new Set(staleManagedEvents.map((event) => event.id));
    const nextSyncState = buildNextSyncState(
      calendarId,
      sourceCount,
      staleManagedEvents,
      deletedEventIds,
      options.syncState,
      nowMs,
      true,
    );

    return {
      calendarId,
      existingCount: existingEvents.length,
      managedExistingCount: managedExistingEvents.length,
      upsertCount: sourceCount,
      deletedCount: staleManagedEvents.length,
      deferredDeleteCount: 0,
      staleCandidateCount: nextSyncState.staleCandidates.length,
      sourceMaxStartMs,
      previousSourceCount: options.syncState?.lastSuccessfulSourceCount,
      nextSyncState,
    };
  }

  const pruneSkippedReason =
    sourceCount === 0 && managedExistingEvents.length > 0
      ? "empty_source_would_delete_existing_managed_events"
      : staleManagedEvents.length === managedExistingEvents.length &&
          managedExistingEvents.length > 0
        ? "refusing_to_delete_all_managed_events"
        : hasLargeSourceCountDrop(sourceCount, options.syncState)
          ? "source_count_drop_from_last_successful_sync"
        : undefined;

  if (pruneSkippedReason) {
    const nextSyncState = buildNextSyncState(
      calendarId,
      sourceCount,
      [],
      new Set(),
      options.syncState,
      nowMs,
      false,
    );

    return {
      calendarId,
      existingCount: existingEvents.length,
      managedExistingCount: managedExistingEvents.length,
      upsertCount: sourceCount,
      deletedCount: 0,
      deferredDeleteCount: staleManagedEvents.length,
      staleCandidateCount: nextSyncState.staleCandidates.length,
      sourceMaxStartMs,
      previousSourceCount: options.syncState?.lastSuccessfulSourceCount,
      pruneSkippedReason,
      nextSyncState,
    };
  }

  const previouslyMissingEventIds = new Set(
    (options.syncState?.staleCandidates ?? [])
      .filter((candidate) => candidate.missingSyncCount >= 1)
      .map((candidate) => candidate.eventId),
  );
  const staleEventsWithinSourceHorizon = staleManagedEvents.filter((event) => {
    const startMs = parseCalendarEventStartMs(event);
    return sourceMaxStartMs !== undefined && startMs !== null && startMs <= sourceMaxStartMs;
  });
  const staleEventsEligibleForDeletion = staleEventsWithinSourceHorizon.filter((event) =>
    previouslyMissingEventIds.has(event.id),
  );
  const staleEventsDeferred = staleManagedEvents.filter(
    (event) => !staleEventsEligibleForDeletion.includes(event),
  );
  const horizonPruneSkippedReason =
    staleManagedEvents.some((event) => !staleEventsWithinSourceHorizon.includes(event))
      ? "source_horizon_before_stale_events"
      : staleEventsDeferred.length > 0
        ? "two_phase_stale_delete_deferred"
        : undefined;

  await runWithConcurrency(staleEventsEligibleForDeletion, GOOGLE_CALENDAR_CONCURRENCY, async (gEvent) => {
    await deleteGoogleEvent(accessToken, calendarId, gEvent.id);
  });

  const deletedEventIds = new Set(staleEventsEligibleForDeletion.map((event) => event.id));
  const nextSyncState = buildNextSyncState(
    calendarId,
    sourceCount,
    staleManagedEvents,
    deletedEventIds,
    options.syncState,
    nowMs,
    true,
  );

  return {
    calendarId,
    existingCount: existingEvents.length,
    managedExistingCount: managedExistingEvents.length,
    upsertCount: sourceCount,
    deletedCount: staleEventsEligibleForDeletion.length,
    deferredDeleteCount: staleEventsDeferred.length,
    staleCandidateCount: nextSyncState.staleCandidates.length,
    sourceMaxStartMs,
    previousSourceCount: options.syncState?.lastSuccessfulSourceCount,
    pruneSkippedReason: horizonPruneSkippedReason,
    nextSyncState,
  };
}

async function runGoogleCalendarSync(ctx: ActionCtx, options: RunGoogleCalendarSyncOptions) {
  const config = getGoogleCalendarConfig();
  const accessToken = await getGoogleAccessToken(config);
  const syncStartedAt = Date.now();

  console.log(
    `Google Calendar sync start version=${GOOGLE_CALENDAR_SYNC_VERSION} entrypoint=${options.entrypoint} privateCalendar=${redactCalendarId(config.privateCalendarId)} publicCalendar=${redactCalendarId(config.publicCalendarId)} allowEmptyPrune=${options.allowEmptyPrune}`,
  );

  const publishedEvents = await ctx.runQuery(internal.googleCalendarQueries.getPublishedEventsForSync, {});
  const internalEvents = await ctx.runQuery(internal.googleCalendarQueries.getInternalEventsForSync, {});

  console.log(
    `Google Calendar sync source version=${GOOGLE_CALENDAR_SYNC_VERSION} entrypoint=${options.entrypoint} publishedCount=${publishedEvents.length} internalCount=${internalEvents.length}`,
  );

  const publishedCalendarEvents = publishedEvents.map(toPublishedCalendarEvent);
  const internalCalendarEvents = internalEvents.map(toInternalCalendarEvent);
  const privateSyncState = await ctx.runQuery(internal.googleCalendarQueries.getSyncState, {
    calendarId: config.privateCalendarId,
  });
  const publicSyncState = await ctx.runQuery(internal.googleCalendarQueries.getSyncState, {
    calendarId: config.publicCalendarId,
  });

  const privateSyncStats = await syncCalendar(accessToken, config.privateCalendarId, [
    ...publishedCalendarEvents,
    ...internalCalendarEvents,
  ], {
    allowEmptyPrune: options.allowEmptyPrune,
    syncState: privateSyncState,
    nowMs: syncStartedAt,
  });
  await ctx.runMutation(internal.googleCalendarQueries.saveSyncState, privateSyncStats.nextSyncState);

  const publicSyncStats = await syncCalendar(
    accessToken,
    config.publicCalendarId,
    publishedCalendarEvents,
    {
      allowEmptyPrune: options.allowEmptyPrune,
      syncState: publicSyncState,
      nowMs: syncStartedAt,
    },
  );
  await ctx.runMutation(internal.googleCalendarQueries.saveSyncState, publicSyncStats.nextSyncState);

  for (const stats of [privateSyncStats, publicSyncStats]) {
    console.log(
      `Google Calendar sync calendar version=${GOOGLE_CALENDAR_SYNC_VERSION} entrypoint=${options.entrypoint} calendar=${redactCalendarId(stats.calendarId)} existingCount=${stats.existingCount} managedExistingCount=${stats.managedExistingCount} upsertCount=${stats.upsertCount} deletedCount=${stats.deletedCount} deferredDeleteCount=${stats.deferredDeleteCount} staleCandidateCount=${stats.staleCandidateCount} previousSourceCount=${stats.previousSourceCount ?? "none"} sourceMaxStartMs=${stats.sourceMaxStartMs ?? "none"} pruneSkippedReason=${stats.pruneSkippedReason ?? "none"}`,
    );
  }

  console.log(
    `Google Calendar sync end version=${GOOGLE_CALENDAR_SYNC_VERSION} entrypoint=${options.entrypoint} publishedCount=${publishedEvents.length} internalCount=${internalEvents.length} privateDeleted=${privateSyncStats.deletedCount} publicDeleted=${publicSyncStats.deletedCount} privateDeferredDeletes=${privateSyncStats.deferredDeleteCount} publicDeferredDeletes=${publicSyncStats.deferredDeleteCount} privatePruneSkippedReason=${privateSyncStats.pruneSkippedReason ?? "none"} publicPruneSkippedReason=${publicSyncStats.pruneSkippedReason ?? "none"}`,
  );

  return {
    publishedCount: publishedEvents.length,
    internalCount: internalEvents.length,
    syncedAt: Date.now(),
  };
}

export const syncToGoogleCalendar = action({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    allowEmptyPrune: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ publishedCount: number; internalCount: number; syncedAt: number }> => {
    return await runGoogleCalendarSync(ctx, {
      entrypoint: "syncToGoogleCalendar",
      allowEmptyPrune: args.allowEmptyPrune ?? false,
    });
  },
});

export const getGoogleCalendarEvents = action({
  args: {},
  handler: async () => {
    const config = getGoogleCalendarConfig();
    const accessToken = await getGoogleAccessToken(config);
    return await fetchGoogleCalendarEvents(accessToken, config.privateCalendarId);
  },
});

export const scheduledSync = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    console.log(
      `Google Calendar sync invoked version=${GOOGLE_CALENDAR_SYNC_VERSION} entrypoint=scheduledSync`,
    );

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const privateCalendarId = process.env.PRIVATE_GOOGLE_CALENDAR_ID;
    const publicCalendarId = process.env.PUBLIC_GOOGLE_CALENDAR_ID;
    if (!clientEmail || !privateKey || !privateCalendarId || !publicCalendarId) {
      console.log(
        `GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, PRIVATE_GOOGLE_CALENDAR_ID, or PUBLIC_GOOGLE_CALENDAR_ID not configured, skipping sync version=${GOOGLE_CALENDAR_SYNC_VERSION} entrypoint=scheduledSync`,
      );
      return;
    }

    const result = await runGoogleCalendarSync(ctx, {
      entrypoint: "scheduledSync",
      allowEmptyPrune: false,
    });
    console.log(
      `Synced ${result.publishedCount} published events to private and public calendars, plus ${result.internalCount} internal events to private calendar`,
    );
  },
});
