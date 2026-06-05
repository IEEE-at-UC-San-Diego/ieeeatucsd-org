/**
 * Client-side helper to fire email notifications via the /api/email/notify endpoint.
 * Fire-and-forget: logs errors but never throws (email failures should not block UI).
 */

export async function sendNotification(
  authHeaders: Record<string, string>,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const res = await fetch("/api/email/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        type,
        ...data,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      console.error(`[email-notify] ${type} failed:`, err);
    }
  } catch (error) {
    console.error(`[email-notify] ${type} network error:`, error);
  }
}
