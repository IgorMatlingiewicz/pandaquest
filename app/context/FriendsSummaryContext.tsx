import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { fetchFriendsSummary } from "@/lib/friends-api";

type FriendsSummaryContextType = {
  /** Requests waiting for the user's answer: the count on the nav link. */
  pendingIncoming: number;
  /** Reads the count again; the friends screens call it after each action. */
  refresh: () => Promise<void>;
};

const FriendsSummaryContext = createContext<
  FriendsSummaryContextType | undefined
>(undefined);

/*
 * The count of waiting requests for the navigation, which is always on
 * screen. No polling in the background: it is read whenever the page
 * changes, and after every action on the friends screens. A failed read
 * keeps the last count: it is a hint, and a missing connection already
 * shows on the page itself.
 */
export function FriendsSummaryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token } = useAuth();
  const pathname = usePathname();
  const [pendingIncoming, setPendingIncoming] = useState(0);
  // Only the answer to the latest request may change the count.
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const request = ++latestRequest.current;
    try {
      const summary = await fetchFriendsSummary(token);
      if (request === latestRequest.current) {
        setPendingIncoming(summary.pendingIncomingCount);
      }
    } catch {
      // The count stays as it was; the next page change asks again.
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  return (
    <FriendsSummaryContext.Provider value={{ pendingIncoming, refresh }}>
      {children}
    </FriendsSummaryContext.Provider>
  );
}

export function useFriendsSummary() {
  const ctx = useContext(FriendsSummaryContext);
  if (!ctx) {
    throw new Error(
      "useFriendsSummary musi być użyty wewnątrz FriendsSummaryProvider",
    );
  }
  return ctx;
}
