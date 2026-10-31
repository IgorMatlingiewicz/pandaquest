import { rewardsToAnnounce } from "@/lib/rewards";
import type { BadgeAward } from "@/types/api";

const bronze: BadgeAward = { key: "first_day", tier: "BRONZE", xp: 25 };
const silver: BadgeAward = {
  key: "own_category_all_done",
  tier: "SILVER",
  xp: 150,
};

describe("rewardsToAnnounce", () => {
  it("is empty when nothing new happened", () => {
    expect(rewardsToAnnounce([], 5, 5)).toEqual([]);
  });

  it("keeps the badges in the order the server sent them", () => {
    expect(rewardsToAnnounce([bronze, silver], 5, 5)).toEqual([
      { kind: "badge", badge: bronze },
      { kind: "badge", badge: silver },
    ]);
  });

  it("announces a new level", () => {
    expect(rewardsToAnnounce([], 5, 6)).toEqual([
      { kind: "levelUp", level: 6 },
    ]);
  });

  it("puts the level-up after the badges, whose XP may have caused it", () => {
    const rewards = rewardsToAnnounce([bronze, silver], 5, 6);

    expect(rewards.map((reward) => reward.kind)).toEqual([
      "badge",
      "badge",
      "levelUp",
    ]);
  });

  it("announces a jump of several levels once, with the new level", () => {
    expect(rewardsToAnnounce([], 5, 8)).toEqual([
      { kind: "levelUp", level: 8 },
    ]);
  });

  it("does not announce a level that was already announced", () => {
    expect(rewardsToAnnounce([], 6, 5)).toEqual([]);
  });
});
