import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { useAuth, type User } from "@/context/AuthContext";
import { RewardModal } from "@/components/rewards/reward-modal";
import { useXpToast } from "@/hooks/use-xp-toast";
import { rewardsToAnnounce, type Reward } from "@/lib/rewards";
import type { RewardOutcome } from "@/types/api";

type QueuedReward = Reward & { id: number };

type RewardsContextType = {
  /**
   * Shows everything a server response earned: a toast for plain XP, then a
   * window for each badge and for a new level, one after another.
   */
  report: (outcome: RewardOutcome) => Promise<void>;
  /**
   * Keeps reward windows back, e.g. while the tutorial is on screen: they
   * wait in the queue, in order, and show once every hold is released.
   * Returns the release; holds are counted, so two holders cannot undo
   * each other. Toasts are not held.
   */
  hold: () => () => void;
};

const RewardsContext = createContext<RewardsContextType | undefined>(undefined);

export function RewardsProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const showXpToast = useXpToast();
  // First in, first out: the window on screen is always queue[0].
  const [queue, setQueue] = useState<QueuedReward[]>([]);
  const nextId = useRef(0);
  // How many holders keep the windows back right now.
  const [holds, setHolds] = useState(0);
  // The highest level already announced to this user, so that every level
  // gets exactly one window, also when two responses arrive close together.
  // A ref, not state: changing it must not re-render anything.
  const announced = useRef<{ userId: string; level: number } | null>(null);

  /**
   * Returns the level announced so far and moves it up to the fresh one.
   * Runs after the await in `report`: a response handled meanwhile has already
   * moved `announced`, so the same level is not announced twice.
   */
  function advanceAnnouncedLevel(fresh: User, levelAtStart?: number) {
    const level =
      announced.current?.userId === fresh.id
        ? announced.current.level
        : (levelAtStart ?? fresh.level);
    announced.current = {
      userId: fresh.id,
      level: Math.max(level, fresh.level),
    };
    return level;
  }

  async function report({ xpAward, badgesEarned = [] }: RewardOutcome) {
    if (xpAward) showXpToast(xpAward);
    if (!xpAward && badgesEarned.length === 0) return;

    // The level shown before this response, for a user nothing has been
    // announced to yet in this session.
    const levelAtStart = user?.level;
    // The level comes from the server, which counts task and badge XP alike.
    const fresh = await refreshUser();

    // Without a profile the level is unknown, but the badges are stored on
    // the server and still have to be shown. A new level then waits for the
    // next response.
    const rewards = rewardsToAnnounce(
      badgesEarned,
      fresh ? advanceAnnouncedLevel(fresh, levelAtStart) : 0,
      fresh?.level ?? 0,
    );
    if (rewards.length === 0) return;
    setQueue((current) => [
      ...current,
      ...rewards.map((reward) => ({ ...reward, id: nextId.current++ })),
    ]);
  }

  // Stable, so a holder can put it in an effect's dependencies. Releasing
  // twice counts once: the release is spent after the first call.
  const hold = useCallback(() => {
    setHolds((count) => count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setHolds((count) => count - 1);
    };
  }, []);

  return (
    <RewardsContext.Provider value={{ report, hold }}>
      {children}
      <RewardModal
        reward={holds > 0 ? null : (queue[0] ?? null)}
        onClose={() => setQueue((current) => current.slice(1))}
      />
    </RewardsContext.Provider>
  );
}

export function useRewards() {
  const ctx = useContext(RewardsContext);
  if (!ctx)
    throw new Error("useRewards musi być użyty wewnątrz RewardsProvider");
  return ctx;
}
