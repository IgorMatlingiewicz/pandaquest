import { createContext, useContext, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { RewardModal } from "@/components/rewards/reward-modal";
import { useXpToast } from "@/hooks/use-xp-toast";
import { rewardsToAnnounce, type Reward } from "@/lib/rewards";
import type { RewardOutcome } from "@/types/api";

type QueuedReward = Reward & { id: number };

type RewardsContextType = {
  /**
   * Shows everything a server response earned: a toast for task XP, then a
   * window for each badge and for a new level, one after another.
   */
  report: (outcome: RewardOutcome) => Promise<void>;
};

const RewardsContext = createContext<RewardsContextType | undefined>(undefined);

export function RewardsProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const showXpToast = useXpToast();
  // First in, first out: the window on screen is always queue[0].
  const [queue, setQueue] = useState<QueuedReward[]>([]);
  const nextId = useRef(0);
  // The highest level already announced to this user, so that every level
  // gets exactly one window, also when two responses arrive close together.
  // A ref, not state: changing it must not re-render anything.
  const announced = useRef<{ userId: string; level: number } | null>(null);

  async function report({ xpAward, badgesEarned = [] }: RewardOutcome) {
    if (xpAward) showXpToast(xpAward);
    if (!xpAward && badgesEarned.length === 0) return;

    // The level shown before this response, for a user nothing has been
    // announced to yet in this session.
    const levelAtStart = user?.level;
    // The level comes from the server, which counts task and badge XP alike.
    const fresh = await refreshUser();
    if (!fresh) return;

    // Read after the await: another response handled meanwhile has already
    // moved `announced`, so the same level is not announced twice.
    const announcedLevel =
      announced.current?.userId === fresh.id
        ? announced.current.level
        : (levelAtStart ?? fresh.level);
    announced.current = {
      userId: fresh.id,
      level: Math.max(announcedLevel, fresh.level),
    };

    const rewards = rewardsToAnnounce(
      badgesEarned,
      announcedLevel,
      fresh.level,
    );
    if (rewards.length === 0) return;
    setQueue((current) => [
      ...current,
      ...rewards.map((reward) => ({ ...reward, id: nextId.current++ })),
    ]);
  }

  return (
    <RewardsContext.Provider value={{ report }}>
      {children}
      <RewardModal
        reward={queue[0] ?? null}
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
