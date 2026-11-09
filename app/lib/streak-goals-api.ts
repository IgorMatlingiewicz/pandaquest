import { API_URL } from "@/constants/api";
import { HttpError } from "@/lib/http-error";
import type {
  RewardOutcome,
  StreakGoal,
  StreakGoalsResponse,
} from "@/types/api";

async function send(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}/streak-goals${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new HttpError(response.status);
  return response;
}

export async function fetchStreakGoals(
  token: string,
): Promise<StreakGoalsResponse> {
  return (await send(token, "")).json();
}

export async function createStreakGoal(
  token: string,
  name: string,
): Promise<StreakGoal> {
  const response = await send(token, "", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return response.json();
}

export async function syncStreakGoals(token: string): Promise<RewardOutcome> {
  return (await send(token, "/sync", { method: "POST" })).json();
}

export async function relapseStreakGoal(
  token: string,
  id: string,
): Promise<StreakGoal & RewardOutcome> {
  return (await send(token, `/${id}/relapse`, { method: "POST" })).json();
}

export async function deleteStreakGoal(
  token: string,
  id: string,
): Promise<void> {
  await send(token, `/${id}`, { method: "DELETE" });
}
