import { API_URL } from "@/constants/api";
import { HttpError } from "@/lib/http-error";
import type { EarnedBadge, FavoritePick, ProfileResponse } from "@/types/api";

async function send(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new HttpError(response.status);
  return response;
}

const json = (body: object): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function fetchProfile(token: string): Promise<ProfileResponse> {
  return (await send(token, "/profile")).json();
}

/** Replaces the whole showcase; answers with it as the server stored it. */
export async function saveFavoriteBadges(
  token: string,
  slots: (FavoritePick | null)[],
): Promise<(EarnedBadge | null)[]> {
  const response = await send(token, "/profile/favorite-badges", {
    method: "PUT",
    ...json({ slots }),
  });
  return response.json();
}

/** 204 on success: there is no body to read. */
export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await send(token, "/auth/password", {
    method: "PATCH",
    ...json({ currentPassword, newPassword }),
  });
}
