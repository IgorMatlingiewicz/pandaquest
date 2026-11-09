import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { statsErrorKey } from "@/lib/api-errors";
import { failureKey } from "@/lib/http-error";
import { fetchStats } from "@/lib/stats-api";
import type { StatsResponse } from "@/types/api";

export type StatsState =
  | { status: "loading" }
  | { status: "error"; errorKey: string }
  | { status: "ready"; stats: StatsResponse };

/**
 * The statistics screen's data, read again on every visit. A refresh keeps
 * what is on screen until the answer comes, and a failed one keeps it too:
 * only a screen with nothing to show turns into an error. Read-only, so it
 * earns nothing and never reports rewards.
 */
export function useStats() {
  const { token } = useAuth();
  const [state, setState] = useState<StatsState>({ status: "loading" });
  // Only the answer to the latest request may change the state: an older one
  // that arrives later would put stale data back on screen.
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    const request = ++latestRequest.current;
    try {
      const stats = await fetchStats(token);
      if (request !== latestRequest.current) return;
      setState({ status: "ready", stats });
    } catch (error) {
      if (request !== latestRequest.current) return;
      setState((current) =>
        current.status === "ready"
          ? current
          : { status: "error", errorKey: failureKey(error, statsErrorKey) },
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

  return { state, refresh, retry };
}
