import { API_URL } from "@/constants/api";
import { HttpError } from "@/lib/http-error";
import type { Reminder, RemindersResponse } from "@/types/api";

async function send(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}/reminders${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await HttpError.from(response);
  return response;
}

/**
 * The reminders not confirmed yet. Reading changes nothing on the server:
 * the same answer comes back until they are confirmed.
 */
export async function fetchReminders(token: string): Promise<Reminder[]> {
  const body = (await (await send(token, "")).json()) as RemindersResponse;
  return body.reminders;
}

/**
 * Tells the server these were shown, so it stops sending them. Safe to
 * repeat: a key already confirmed is kept once. At most 10 keys, which is
 * also the most one GET returns.
 */
export async function ackReminders(
  token: string,
  keys: readonly string[],
): Promise<void> {
  await send(token, "/ack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });
}
