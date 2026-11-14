import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useFriendsSummary } from "@/context/FriendsSummaryContext";
import {
  friendFailure,
  friendsLoadErrorKey,
  type FriendFailure,
} from "@/lib/api-errors";
import {
  fetchFriendBadges,
  fetchFriendProfile,
  removeFriend,
} from "@/lib/friends-api";
import { failureKey, HttpError } from "@/lib/http-error";
import type { FriendBadge, FriendProfile } from "@/types/api";

export type FriendReadState<T> =
  | { status: "loading" }
  | { status: "error"; errorKey: string }
  // 404: no longer a friend (removed in the meantime, by either side). The
  // screen goes back to the list instead of offering a retry that cannot
  // help.
  | { status: "gone" }
  | { status: "ready"; data: T };

/**
 * One thing about a friend, read on every visit. A refresh keeps what is on
 * screen, except a 404: the friendship is over, so the data must go too.
 */
function useFriendRead<T>(
  friendshipId: string,
  fetch: (token: string, friendshipId: string) => Promise<T>,
) {
  const { token } = useAuth();
  const [state, setState] = useState<FriendReadState<T>>({
    status: "loading",
  });
  const latestRead = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const read = ++latestRead.current;
    try {
      const data = await fetch(token, friendshipId);
      if (read === latestRead.current) setState({ status: "ready", data });
    } catch (error) {
      if (read !== latestRead.current) return;
      if (error instanceof HttpError && error.status === 404) {
        setState({ status: "gone" });
        return;
      }
      setState((current) =>
        current.status === "ready"
          ? current
          : {
              status: "error",
              errorKey: failureKey(error, friendsLoadErrorKey),
            },
      );
    }
  }, [token, friendshipId, fetch]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  function retry() {
    setState({ status: "loading" });
    return refresh();
  }

  return { state, refresh, retry };
}

/**
 * A friend's profile, and ending the friendship. `remove` resolves to null
 * once the friendship is gone, and to what to show otherwise.
 */
export function useFriendProfile(friendshipId: string) {
  const { token } = useAuth();
  const { i18n } = useTranslation();
  const summary = useFriendsSummary();
  const read = useFriendRead<FriendProfile>(friendshipId, fetchFriendProfile);
  const [removing, setRemoving] = useState(false);
  const removeBusy = useRef(false);

  async function remove(): Promise<FriendFailure | null> {
    if (removeBusy.current || !token) return null;
    removeBusy.current = true;
    setRemoving(true);
    try {
      await removeFriend(token, friendshipId);
      return null;
    } catch (error) {
      // 404: the other side ended it first. What the user wanted is done.
      if (error instanceof HttpError && error.status === 404) return null;
      return friendFailure(error, Date.now(), i18n.language);
    } finally {
      removeBusy.current = false;
      setRemoving(false);
      summary.refresh();
    }
  }

  return { ...read, remove, removing };
}

/** The badges a friend earned. */
export function useFriendBadges(friendshipId: string) {
  return useFriendRead<FriendBadge[]>(friendshipId, fetchFriendBadges);
}
