import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { fetchAchievements } from "@/lib/achievements-api";
import { profileErrorKey, saveShowcaseErrorKey } from "@/lib/api-errors";
import { failureKey } from "@/lib/http-error";
import { earnedBadges, withSlot } from "@/lib/profile";
import { fetchProfile, saveFavoriteBadges } from "@/lib/profile-api";
import type { EarnedBadge, FavoritePick, ProfileResponse } from "@/types/api";

export type ProfileState =
  | { status: "loading" }
  | { status: "error"; errorKey: string }
  // earned: every badge tier the user has, for the showcase's picker.
  | { status: "ready"; profile: ProfileResponse; earned: EarnedBadge[] };

/**
 * The profile screen's data, read again on every visit like the statistics:
 * a refresh keeps what is on screen, and only a screen with nothing to show
 * turns into an error. The picker's list comes in the same read, so the
 * picker opens at once. Earns nothing, so it never reports rewards.
 */
export function useProfile() {
  const { token } = useAuth();
  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  // Only the answer to the latest request may change the state.
  const latestRequest = useRef(0);
  // A ref, not state: it is set at once, so a second tap in the same moment
  // already sees it, before React has rendered the first one's change.
  const saving = useRef(false);

  const refresh = useCallback(async () => {
    // While the showcase is being saved, its answer is the freshest data.
    if (!token || saving.current) return;
    const request = ++latestRequest.current;
    try {
      const [profile, achievements] = await Promise.all([
        fetchProfile(token),
        fetchAchievements(token),
      ]);
      if (request !== latestRequest.current) return;
      setState({
        status: "ready",
        profile,
        earned: earnedBadges(achievements),
      });
    } catch (error) {
      if (request !== latestRequest.current) return;
      setState((current) =>
        current.status === "ready"
          ? current
          : { status: "error", errorKey: failureKey(error, profileErrorKey) },
      );
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  /** After an error: shows loading again, as nothing else is on screen. */
  function retry() {
    setState({ status: "loading" });
    return refresh();
  }

  /**
   * Puts a badge into a slot, or empties it with null. The showcase changes
   * only with the server's answer. Resolves to a translation key when it
   * failed, to null otherwise; a call while another save runs does nothing.
   */
  async function saveSlot(
    index: number,
    pick: FavoritePick | null,
  ): Promise<string | null> {
    if (saving.current || state.status !== "ready" || !token) return null;
    saving.current = true;
    setSavingSlot(index);
    // A read sent before this save would bring the old showcase back.
    latestRequest.current++;
    try {
      const favorites = await saveFavoriteBadges(
        token,
        withSlot(state.profile.favorites, index, pick),
      );
      setState((current) =>
        current.status === "ready"
          ? { ...current, profile: { ...current.profile, favorites } }
          : current,
      );
      return null;
    } catch (error) {
      return failureKey(error, saveShowcaseErrorKey);
    } finally {
      saving.current = false;
      setSavingSlot(null);
    }
  }

  return { state, savingSlot, refresh, retry, saveSlot };
}
