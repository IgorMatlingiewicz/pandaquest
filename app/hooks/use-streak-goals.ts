import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useRewards } from "@/context/RewardsContext";
import { createStreakGoalErrorKey } from "@/lib/api-errors";
import { clockOffset, crossedFullDay } from "@/lib/streak-goals";
import {
  createStreakGoal,
  deleteStreakGoal,
  fetchStreakGoals,
  HttpError,
  relapseStreakGoal,
  syncStreakGoals,
} from "@/lib/streak-goals-api";
import type { StreakGoal, StreakGoalRules } from "@/types/api";

const TICK_MS = 1000;

/** What a failed request means, as a translation key. */
function failureKey(
  error: unknown,
  keyOf: (status: number) => string = () => "common.tryAgain",
): string {
  return error instanceof HttpError
    ? keyOf(error.status)
    : "common.noConnection";
}

/**
 * Asks the server to pay the full days not paid yet and shows what it earned.
 * Safe to call at any time: the server pays each day once.
 */
export function useStreakGoalsSync() {
  const { token } = useAuth();
  const { report } = useRewards();
  // `report` is new on every render; through a ref it does not make `sync`
  // new as well, which would re-run every effect that depends on it.
  const latestReport = useRef(report);
  useEffect(() => {
    latestReport.current = report;
  });

  return useCallback(async () => {
    if (!token) return;
    try {
      await latestReport.current(await syncStreakGoals(token));
    } catch {
      // Nothing is lost: the unpaid days wait on the server for the next sync.
    }
  }, [token]);
}

/**
 * The goals screen's data. `goals` and `rules` are null until the first read;
 * `nowMs` is the server's time, ticking while the screen is on top. The
 * actions resolve to a translation key when they fail and to null otherwise.
 * They are used under the logged-in layout only, so a token is always there.
 */
export function useStreakGoals() {
  const { token } = useAuth();
  const { report } = useRewards();
  const sync = useStreakGoalsSync();
  const [data, setData] = useState<{
    goals: StreakGoal[];
    rules: StreakGoalRules;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const offset = useRef(0);

  const goals = data?.goals ?? null;

  const load = useCallback(async () => {
    if (!token) return null;
    try {
      const { serverNow, rules, goals } = await fetchStreakGoals(token);
      const deviceNow = Date.now();
      offset.current = clockOffset(serverNow, deviceNow);
      setNowMs(deviceNow + offset.current);
      setData({ goals, rules });
      setFailed(false);
      return goals;
    } catch {
      setFailed(true);
      return null;
    }
  }, [token]);

  function updateGoals(change: (goals: StreakGoal[]) => StreakGoal[]) {
    setData(
      (current) => current && { ...current, goals: change(current.goals) },
    );
  }

  // Each visit reads afresh and pays what is due; the two do not depend on
  // each other, so a failed sync does not hide the goals.
  useFocusEffect(
    useCallback(() => {
      load();
      sync();
    }, [load, sync]),
  );

  // The countdown lives only while the screen is on top. On a full day the
  // client syncs on its own, but only asks: the server checks the time itself.
  useFocusEffect(
    useCallback(() => {
      if (!goals) return;

      let previous = Date.now() + offset.current;
      const timer = setInterval(() => {
        const now = Date.now() + offset.current;
        setNowMs(now);
        if (crossedFullDay(goals, previous, now)) sync();
        previous = now;
      }, TICK_MS);
      return () => clearInterval(timer);
    }, [goals, sync]),
  );

  async function createGoal(name: string): Promise<string | null> {
    try {
      const goal = await createStreakGoal(token!, name);
      updateGoals((current) => [...current, goal]);
      return null;
    } catch (error) {
      return failureKey(error, createStreakGoalErrorKey);
    }
  }

  async function closeAttempt(goal: StreakGoal) {
    const { xpAward, badgesEarned, ...restarted } = await relapseStreakGoal(
      token!,
      goal.id,
    );
    updateGoals((current) =>
      current.map((other) => (other.id === goal.id ? restarted : other)),
    );
    await report({ xpAward, badgesEarned });
  }

  /**
   * `goal` is the attempt the user saw. A 409 means something touched the goal
   * at the same moment: a sync, and then the slip still has to be recorded, or
   * another slip, and then it must not be recorded twice. Only the list can
   * tell the two apart.
   */
  async function relapseGoal(goal: StreakGoal): Promise<string | null> {
    try {
      await closeAttempt(goal);
      return null;
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 409)) {
        return failureKey(error);
      }
    }

    const fresh = await load();
    if (!fresh) return "common.tryAgain";
    const stillRunning = fresh.some(
      (other) => other.id === goal.id && other.startedAt === goal.startedAt,
    );
    if (!stillRunning) return null;

    try {
      await closeAttempt(goal);
      return null;
    } catch (error) {
      return failureKey(error);
    }
  }

  async function deleteGoal(id: string): Promise<string | null> {
    try {
      await deleteStreakGoal(token!, id);
      updateGoals((current) => current.filter((goal) => goal.id !== id));
      return null;
    } catch (error) {
      return failureKey(error);
    }
  }

  return {
    goals,
    rules: data?.rules ?? null,
    nowMs,
    failed,
    load,
    createGoal,
    relapseGoal,
    deleteGoal,
  };
}
