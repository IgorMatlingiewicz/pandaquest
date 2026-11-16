import { API_URL } from "@/constants/api";
import { HttpError } from "@/lib/http-error";
import type { TutorialCompleteResponse, TutorialStatus } from "@/types/api";

async function send(token: string, path: string) {
  const response = await fetch(`${API_URL}/tutorial${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await HttpError.from(response);
  return response;
}

/**
 * The tutorial closed before its end. The server moves NOT_STARTED to
 * DISMISSED and leaves any other status as it is, so a replay closed early
 * changes nothing.
 */
export async function dismissTutorial(
  token: string,
): Promise<{ tutorialStatus: TutorialStatus }> {
  return (await send(token, "/dismiss")).json();
}

/**
 * The tutorial watched to the end. The first time it earns Bright Start,
 * listed in badgesEarned; a repeat answers an empty list.
 */
export async function completeTutorial(
  token: string,
): Promise<TutorialCompleteResponse> {
  return (await send(token, "/complete")).json();
}
