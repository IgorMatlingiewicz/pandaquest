import { API_URL } from "@/constants/api";
import { HttpError } from "@/lib/http-error";
import type { Achievement } from "@/types/api";

/** GET /achievements: every badge with its tiers, earned or not. */
export async function fetchAchievements(token: string): Promise<Achievement[]> {
  const response = await fetch(`${API_URL}/achievements`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new HttpError(response.status);
  return response.json();
}
