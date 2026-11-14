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
import { sentRequestKey } from "@/lib/friends";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriendCode,
  fetchFriendRequests,
  fetchFriends,
  regenerateFriendCode,
  sendFriendRequest,
} from "@/lib/friends-api";
import { failureKey, HttpError } from "@/lib/http-error";
import type { Friend, FriendRequestsResponse } from "@/types/api";

export type FriendsData = {
  code: string;
  friends: Friend[];
  requests: FriendRequestsResponse;
};

export type FriendsState =
  | { status: "loading" }
  | { status: "error"; errorKey: string }
  | { status: "ready"; data: FriendsData };

/** A sent request: the text for the sender, or why it was refused. */
export type SendOutcome =
  { ok: true; key: string } | { ok: false; failure: FriendFailure };

export type RequestAction = "accept" | "decline" | "cancel";

const REQUEST_ACTIONS = {
  accept: acceptFriendRequest,
  decline: declineFriendRequest,
  cancel: cancelFriendRequest,
};

/**
 * The friends screen's data: the user's code, friends and requests, read
 * together on every visit, like the profile. Both tabs of the screen use
 * one read, so a request accepted on one shows as a friend on the other.
 *
 * The actions change nothing on screen by themselves: after each one the
 * screen and the count on the nav link are read again, so what is shown is
 * what the server has. Each kind of action runs once at a time (a double
 * tap sends one request); the second call resolves to null and does
 * nothing.
 */
export function useFriends() {
  const { token } = useAuth();
  const { i18n } = useTranslation();
  const summary = useFriendsSummary();
  const [state, setState] = useState<FriendsState>({ status: "loading" });
  const [sending, setSending] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  // Only the answer to the latest read may change the state.
  const latestRead = useRef(0);
  // Refs, not state: set at once, so a second tap in the same moment
  // already sees them, before React has rendered the first one's change.
  const sendBusy = useRef(false);
  const codeBusy = useRef(false);
  const requestBusy = useRef(false);

  const failureOf = (error: unknown) =>
    friendFailure(error, Date.now(), i18n.language);

  const refresh = useCallback(async () => {
    if (!token) return;
    const read = ++latestRead.current;
    try {
      const [code, friends, requests] = await Promise.all([
        fetchFriendCode(token),
        fetchFriends(token),
        fetchFriendRequests(token),
      ]);
      if (read !== latestRead.current) return;
      setState({ status: "ready", data: { code, friends, requests } });
    } catch (error) {
      if (read !== latestRead.current) return;
      setState((current) =>
        current.status === "ready"
          ? current
          : {
              status: "error",
              errorKey: failureKey(error, friendsLoadErrorKey),
            },
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
   * After an action the server answered, success or refusal: both mean the
   * screen may be stale (a refusal like REQUEST_NOT_FOUND says so). The
   * new read also outdates one sent before the action, so that one cannot
   * bring the old state back. No answer at all changes nothing, so nothing
   * is read.
   */
  async function readAgainAfter(error?: unknown) {
    if (error !== undefined && !(error instanceof HttpError)) return;
    await Promise.all([refresh(), summary.refresh()]);
  }

  /** Sends a request to the owner of the code as typed. */
  async function sendRequest(typed: string): Promise<SendOutcome | null> {
    if (sendBusy.current || !token) return null;
    sendBusy.current = true;
    setSending(true);
    try {
      const result = await sendFriendRequest(token, typed);
      await readAgainAfter();
      return { ok: true, key: sentRequestKey(result) };
    } catch (error) {
      await readAgainAfter(error);
      return { ok: false, failure: failureOf(error) };
    } finally {
      sendBusy.current = false;
      setSending(false);
    }
  }

  /** A new code in place of the old one, taken from the server's answer. */
  async function regenerateCode(): Promise<FriendFailure | null> {
    if (codeBusy.current || !token) return null;
    codeBusy.current = true;
    setRegenerating(true);
    try {
      const code = await regenerateFriendCode(token);
      setState((current) =>
        current.status === "ready"
          ? { ...current, data: { ...current.data, code } }
          : current,
      );
      return null;
    } catch (error) {
      return failureOf(error);
    } finally {
      codeBusy.current = false;
      setRegenerating(false);
    }
  }

  /** Accepts or declines a request to the user, or takes back their own. */
  async function actOnRequest(
    id: string,
    action: RequestAction,
  ): Promise<FriendFailure | null> {
    if (requestBusy.current || !token) return null;
    requestBusy.current = true;
    setBusyRequestId(id);
    try {
      await REQUEST_ACTIONS[action](token, id);
      await readAgainAfter();
      return null;
    } catch (error) {
      await readAgainAfter(error);
      return failureOf(error);
    } finally {
      requestBusy.current = false;
      setBusyRequestId(null);
    }
  }

  return {
    state,
    refresh,
    retry,
    sendRequest,
    sending,
    regenerateCode,
    regenerating,
    actOnRequest,
    busyRequestId,
  };
}
