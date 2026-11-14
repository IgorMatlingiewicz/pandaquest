import { API_URL } from "@/constants/api";
import { HttpError } from "@/lib/http-error";
import type {
  Friend,
  FriendBadge,
  FriendProfile,
  FriendRequestsResponse,
  FriendsSummary,
  SendFriendRequestResult,
} from "@/types/api";

/*
 * The friends endpoints. Built like the other API files, with one change: a
 * refusal keeps what its body says (code, availableAt), as the friends
 * module tells its refusals apart by code, not by status.
 */
async function send(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}/friends${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await HttpError.from(response);
  return response;
}

// Ids come from the server, but are escaped all the same: a path is no place
// for a string nobody checked.
const at = (id: string) => `/${encodeURIComponent(id)}`;

export async function fetchFriendCode(token: string): Promise<string> {
  return ((await (await send(token, "/code")).json()) as { code: string }).code;
}

/** A new code; the old one stops working at once, friends stay. */
export async function regenerateFriendCode(token: string): Promise<string> {
  const response = await send(token, "/code/regenerate", { method: "POST" });
  return ((await response.json()) as { code: string }).code;
}

/** `code` as typed: the server normalizes it and its answer is binding. */
export async function sendFriendRequest(
  token: string,
  code: string,
): Promise<SendFriendRequestResult> {
  const response = await send(token, "/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return response.json();
}

export async function fetchFriendRequests(
  token: string,
): Promise<FriendRequestsResponse> {
  return (await send(token, "/requests")).json();
}

export async function acceptFriendRequest(
  token: string,
  id: string,
): Promise<void> {
  await send(token, `/requests${at(id)}/accept`, { method: "POST" });
}

export async function declineFriendRequest(
  token: string,
  id: string,
): Promise<void> {
  await send(token, `/requests${at(id)}/decline`, { method: "POST" });
}

/** Takes back one's own request that still waits. 204: no body. */
export async function cancelFriendRequest(
  token: string,
  id: string,
): Promise<void> {
  await send(token, `/requests${at(id)}`, { method: "DELETE" });
}

export async function fetchFriendsSummary(
  token: string,
): Promise<FriendsSummary> {
  return (await send(token, "/summary")).json();
}

export async function fetchFriends(token: string): Promise<Friend[]> {
  return (await send(token, "")).json();
}

export async function fetchFriendProfile(
  token: string,
  friendshipId: string,
): Promise<FriendProfile> {
  return (await send(token, `${at(friendshipId)}/profile`)).json();
}

export async function fetchFriendBadges(
  token: string,
  friendshipId: string,
): Promise<FriendBadge[]> {
  return (await send(token, `${at(friendshipId)}/badges`)).json();
}

/** Ends a friendship, from either side. 204: no body. */
export async function removeFriend(
  token: string,
  friendshipId: string,
): Promise<void> {
  await send(token, at(friendshipId), { method: "DELETE" });
}
