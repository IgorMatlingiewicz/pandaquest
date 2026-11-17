import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useRewards } from "@/context/RewardsContext";
import { useTutorial } from "@/context/TutorialContext";
import { onAppReturn } from "@/lib/app-return";
import {
  ACK_LIMIT,
  reminderView,
  shouldShowReminders,
  type ReminderItem,
  type ReminderView,
} from "@/lib/reminders";
import { ackReminders, fetchReminders } from "@/lib/reminders-api";
import {
  getRemindersEnabled,
  setRemindersEnabled,
} from "@/lib/remindersStorage";
import type { Reminder } from "@/types/api";

type RemindersContextType = {
  /** The "In-app reminders" switch; on until the device says otherwise. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** The window on screen, or null. */
  view: ReminderView | null;
  close: () => void;
  /** A "Go to" button: closes the window and opens the place. */
  goTo: (kind: ReminderItem["kind"]) => void;
};

const RemindersContext = createContext<RemindersContextType | undefined>(
  undefined,
);

/*
 * The in-app reminders. Mounted in the logged-in layout, so they never show
 * on the login and sign-up screens, and everything here (what this session
 * showed included) goes with the logout.
 *
 * - Asks the server when the logged-in area opens and on every return to
 *   the front; no timer, nothing in the background.
 * - Opens the window only when lib/reminders says so: the switch is on, and
 *   neither the tutorial nor a reward window is on screen or waiting.
 * - Confirms the keys the moment the window opens, not when it closes: a
 *   window seen and then left by closing the app counts as seen. A key
 *   shown once is never shown again in this session, even if the server
 *   did not get the confirmation; that one is sent again, quietly, before
 *   the next read.
 * - While the window is open it holds the reward windows back, so a badge
 *   paid meanwhile waits for "Close" instead of covering it.
 * - Failures are logged, never shown: reminders are a nicety.
 */
export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const { state: tutorial } = useTutorial();
  const { pending: rewardsPending, hold } = useRewards();
  // null until read from the device: nothing is asked for before that, so
  // a switch turned off never lets one request through at startup.
  const [stored, setStored] = useState<boolean | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [view, setView] = useState<ReminderView | null>(null);
  // Refs, not state: changing them must not re-render anything.
  const shownKeys = useRef(new Set<string>());
  const unconfirmed = useRef(new Set<string>());
  // Only the answer to the latest read may change the list.
  const latestRead = useRef(0);

  useEffect(() => {
    let current = true;
    getRemindersEnabled()
      .catch(() => true)
      .then((value) => {
        if (current) setStored(value);
      });
    return () => {
      current = false;
    };
  }, []);

  const confirm = useCallback(
    async (keys: readonly string[]) => {
      if (!token) return;
      // The server takes at most ACK_LIMIT keys at once; a backlog of
      // several failed windows goes in parts.
      for (let start = 0; start < keys.length; start += ACK_LIMIT) {
        const part = keys.slice(start, start + ACK_LIMIT);
        try {
          await ackReminders(token, part);
          part.forEach((key) => unconfirmed.current.delete(key));
        } catch (error) {
          part.forEach((key) => unconfirmed.current.add(key));
          console.warn("Reminders: not confirmed, will try again", error);
        }
      }
    },
    [token],
  );

  const refresh = useCallback(async () => {
    if (!token || stored !== true) return;
    if (unconfirmed.current.size > 0) {
      await confirm([...unconfirmed.current]);
    }
    const read = ++latestRead.current;
    try {
      const fresh = await fetchReminders(token);
      if (read === latestRead.current) setReminders(fresh);
    } catch (error) {
      console.warn("Reminders: could not be read", error);
    }
  }, [token, stored, confirm]);

  // On entering the logged-in area (once the switch is read), and again
  // whenever the switch is turned on.
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Back from another app or browser tab.
  useEffect(() => onAppReturn(refresh), [refresh]);

  const tutorialActive = tutorial.phase !== "off";

  useEffect(() => {
    if (view) return;
    const ready = shouldShowReminders({
      enabled: stored === true,
      authenticated: token !== null,
      tutorialActive,
      rewardsPending,
      reminders,
      shownKeys: shownKeys.current,
    });
    if (!ready) return;
    // Non-null: shouldShowReminders has just checked there is something.
    const next = reminderView(reminders, shownKeys.current)!;
    next.keys.forEach((key) => shownKeys.current.add(key));
    setView(next);
    confirm(next.keys);
  }, [view, stored, token, tutorialActive, rewardsPending, reminders, confirm]);

  useEffect(() => (view ? hold() : undefined), [view, hold]);

  const setEnabled = useCallback((value: boolean) => {
    setStored(value);
    // Off: what was read stays unshown; on: the effect above reads again.
    if (!value) setReminders([]);
    setRemindersEnabled(value).catch((error) => {
      console.warn("Reminders: the switch was not saved", error);
    });
  }, []);

  const close = useCallback(() => setView(null), []);

  const goTo = useCallback((kind: ReminderItem["kind"]) => {
    setView(null);
    router.navigate(
      kind === "friends"
        ? { pathname: "/friends", params: { tab: "requests" } }
        : { pathname: "/" },
    );
  }, []);

  return (
    <RemindersContext.Provider
      value={{ enabled: stored ?? true, setEnabled, view, close, goTo }}
    >
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders() {
  const ctx = useContext(RemindersContext);
  if (!ctx) {
    throw new Error("useReminders musi być użyty wewnątrz RemindersProvider");
  }
  return ctx;
}
