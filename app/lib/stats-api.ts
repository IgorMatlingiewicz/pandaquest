import { API_URL } from "@/constants/api";
import { HttpError } from "@/lib/http-error";
import type { StatsResponse } from "@/types/api";

/** GET /stats: whose statistics comes from the token alone. */
export async function fetchStats(token: string): Promise<StatsResponse> {
  const response = await fetch(`${API_URL}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new HttpError(response.status);
  return response.json();
}
