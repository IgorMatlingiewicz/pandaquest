import { act, renderHook } from "@testing-library/react-native";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/use-profile";
import type { Achievement, EarnedBadge, ProfileResponse } from "@/types/api";
import { fakeServer, type PendingRequest } from "./fake-server";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

// Focus stands for the screen being on top; here it is simply being mounted.
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));

const EARNED_AT = "2026-10-01T08:00:00.000Z";
const FIRST_DAY: EarnedBadge = {
  badgeKey: "first_day",
  tier: "BRONZE",
  earnedAt: EARNED_AT,
};
const LIFE_GOAL: EarnedBadge = {
  badgeKey: "life_goal",
  tier: "DIAMOND",
  earnedAt: "2026-10-20T08:00:00.000Z",
};

const profile = (
  favorites: (EarnedBadge | null)[] = [null, null, null],
  username = "panda",
): ProfileResponse => ({
  username,
  joinedAt: "2026-09-01T10:00:00.000Z",
  level: 2,
  levelProgress: {
    level: 2,
    xpIntoLevel: 10,
    xpForNextLevel: 110,
    isMax: false,
  },
  badges: { earned: 2, total: 26 },
  favorites,
});

const ACHIEVEMENTS: Achievement[] = [
  {
    key: "first_day",
    current: 1,
    tiers: [{ tier: "BRONZE", threshold: 1, xp: 10, earnedAt: EARNED_AT }],
  },
  {
    key: "life_goal",
    current: 1,
    tiers: [
      {
        tier: "DIAMOND",
        threshold: 1,
        xp: 100,
        earnedAt: "2026-10-20T08:00:00.000Z",
      },
    ],
  },
  {
    key: "first_week",
    current: 0,
    tiers: [{ tier: "BRONZE", threshold: 1, xp: 10, earnedAt: null }],
  },
];

const to = (path: string) => (request: PendingRequest) =>
  request.url.endsWith(path);

describe("useProfile", () => {
  let server: PendingRequest[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ token: "token" } as never);
    server = fakeServer();
  });

  /** The nth read: its two requests, profile and achievements. */
  const read = (n: number) => {
    const profiles = server.filter(to("/profile"));
    const achievements = server.filter(to("/achievements"));
    return { profile: profiles[n], achievements: achievements[n] };
  };
  const answerRead = async (n: number, body: ProfileResponse) => {
    await read(n).profile.succeed(body);
    await read(n).achievements.succeed(ACHIEVEMENTS);
  };
  const saves = () => server.filter(to("/profile/favorite-badges"));

  const open = async (body = profile()) => {
    const hook = renderHook(() => useProfile());
    await answerRead(0, body);
    return hook;
  };

  describe("reading", () => {
    it("is loading until both answers come, then has the profile and the earned badges", async () => {
      const { result } = renderHook(() => useProfile());

      expect(result.current.state).toEqual({ status: "loading" });
      await read(0).profile.succeed(profile());
      expect(result.current.state).toEqual({ status: "loading" });

      await read(0).achievements.succeed(ACHIEVEMENTS);
      expect(result.current.state).toEqual({
        status: "ready",
        profile: profile(),
        earned: [FIRST_DAY, LIFE_GOAL],
      });
    });

    it("sends the token of the logged-in user with both requests", async () => {
      renderHook(() => useProfile());

      for (const request of [read(0).profile, read(0).achievements]) {
        expect(request.init).toEqual({
          headers: { Authorization: "Bearer token" },
        });
      }
      await answerRead(0, profile());
    });

    it("sends nothing when nobody is logged in", () => {
      jest.mocked(useAuth).mockReturnValue({ token: null } as never);
      renderHook(() => useProfile());

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it.each([
      [500, "profile.loadError"],
      [401, "common.sessionExpired"],
    ])("turns a %i into %s", async (status, errorKey) => {
      const { result } = renderHook(() => useProfile());

      await read(0).profile.refuse(status);

      expect(result.current.state).toEqual({ status: "error", errorKey });
    });

    it("fails as a whole when only the achievements fail", async () => {
      const { result } = renderHook(() => useProfile());

      await read(0).profile.succeed(profile());
      await read(0).achievements.refuse(500);

      expect(result.current.state).toEqual({
        status: "error",
        errorKey: "profile.loadError",
      });
    });

    it("tells a missing connection apart", async () => {
      const { result } = renderHook(() => useProfile());

      await read(0).profile.drop();

      expect(result.current.state).toEqual({
        status: "error",
        errorKey: "common.noConnection",
      });
    });

    it("goes from an error through loading to the data on retry", async () => {
      const { result } = renderHook(() => useProfile());
      await read(0).profile.refuse(500);

      act(() => {
        result.current.retry();
      });
      expect(result.current.state).toEqual({ status: "loading" });

      await answerRead(1, profile());
      expect(result.current.state).toMatchObject({ status: "ready" });
    });

    it("keeps the data on screen while it refreshes, then replaces it", async () => {
      const { result } = await open(profile([], "old"));

      act(() => {
        result.current.refresh();
      });
      expect(result.current.state).toMatchObject({
        profile: { username: "old" },
      });

      await answerRead(1, profile([], "new"));
      expect(result.current.state).toMatchObject({
        profile: { username: "new" },
      });
    });

    it("keeps the data when a refresh fails", async () => {
      const { result } = await open(profile([], "old"));

      act(() => {
        result.current.refresh();
      });
      await read(1).profile.refuse(500);

      expect(result.current.state).toMatchObject({
        status: "ready",
        profile: { username: "old" },
      });
    });

    it("ignores an older answer that comes back after a newer one", async () => {
      const { result } = renderHook(() => useProfile());
      act(() => {
        result.current.refresh();
      });

      await answerRead(1, profile([], "new"));
      await answerRead(0, profile([], "old"));

      expect(result.current.state).toMatchObject({
        profile: { username: "new" },
      });
    });

    it("ignores an older failure while the newer read still waits", async () => {
      const { result } = renderHook(() => useProfile());
      act(() => {
        result.current.refresh();
      });

      await read(0).profile.refuse(500);
      expect(result.current.state).toEqual({ status: "loading" });

      await answerRead(1, profile());
      expect(result.current.state).toMatchObject({ status: "ready" });
    });
  });

  describe("saving the showcase", () => {
    it("sends the whole showcase and takes it from the answer", async () => {
      const { result } = await open(profile([FIRST_DAY, null, null]));

      let outcome: Promise<string | null> | undefined;
      act(() => {
        outcome = result.current.saveSlot(2, {
          badgeKey: "life_goal",
          tier: "DIAMOND",
        });
      });

      const [save] = saves();
      expect(save.init).toMatchObject({
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      });
      expect(JSON.parse(save.init!.body as string)).toEqual({
        slots: [
          { badgeKey: "first_day", tier: "BRONZE" },
          null,
          { badgeKey: "life_goal", tier: "DIAMOND" },
        ],
      });

      // What the server stored wins, even where it differs from the request.
      const stored = [LIFE_GOAL, null, FIRST_DAY];
      await save.succeed(stored);

      await expect(outcome).resolves.toBeNull();
      expect(result.current.state).toMatchObject({
        profile: { favorites: stored },
      });
    });

    it("leaves the showcase alone until the answer comes", async () => {
      const { result } = await open(profile([FIRST_DAY, null, null]));

      act(() => {
        result.current.saveSlot(0, null);
      });

      expect(result.current.state).toMatchObject({
        profile: { favorites: [FIRST_DAY, null, null] },
      });
      await saves()[0].succeed([null, null, null]);
      expect(result.current.state).toMatchObject({
        profile: { favorites: [null, null, null] },
      });
    });

    it("tells which slot is being saved, and nothing once it is done", async () => {
      const { result } = await open();

      expect(result.current.savingSlot).toBeNull();
      act(() => {
        result.current.saveSlot(1, FIRST_DAY);
      });
      expect(result.current.savingSlot).toBe(1);

      await saves()[0].succeed([null, FIRST_DAY, null]);
      expect(result.current.savingSlot).toBeNull();
    });

    it.each([
      [404, "profile.showcase.notEarned"],
      [400, "profile.showcase.invalid"],
    ])(
      "keeps the showcase as it was on a %i and gives %s",
      async (status, key) => {
        const { result } = await open(profile([FIRST_DAY, null, null]));

        let outcome: Promise<string | null> | undefined;
        act(() => {
          outcome = result.current.saveSlot(1, LIFE_GOAL);
        });
        await saves()[0].refuse(status);

        await expect(outcome).resolves.toBe(key);
        expect(result.current.state).toMatchObject({
          profile: { favorites: [FIRST_DAY, null, null] },
        });
        expect(result.current.savingSlot).toBeNull();
      },
    );

    it("tells a missing connection apart", async () => {
      const { result } = await open();

      let outcome: Promise<string | null> | undefined;
      act(() => {
        outcome = result.current.saveSlot(0, FIRST_DAY);
      });
      await saves()[0].drop();

      await expect(outcome).resolves.toBe("common.noConnection");
    });

    it("sends nothing for a second save while the first one waits", async () => {
      const { result } = await open();

      let second: Promise<string | null> | undefined;
      act(() => {
        result.current.saveSlot(0, FIRST_DAY);
        second = result.current.saveSlot(1, LIFE_GOAL);
      });

      expect(saves()).toHaveLength(1);
      await expect(second).resolves.toBeNull();

      await saves()[0].succeed([FIRST_DAY, null, null]);
      expect(result.current.state).toMatchObject({
        profile: { favorites: [FIRST_DAY, null, null] },
      });
    });

    it("saves again once the first save is answered", async () => {
      const { result } = await open();
      act(() => {
        result.current.saveSlot(0, FIRST_DAY);
      });
      await saves()[0].succeed([FIRST_DAY, null, null]);

      act(() => {
        result.current.saveSlot(1, LIFE_GOAL);
      });

      expect(saves()).toHaveLength(2);
      expect(JSON.parse(saves()[1].init!.body as string).slots).toEqual([
        { badgeKey: "first_day", tier: "BRONZE" },
        { badgeKey: "life_goal", tier: "DIAMOND" },
        null,
      ]);
    });

    it("does not let a read sent before the save bring the old showcase back", async () => {
      const { result } = await open();
      act(() => {
        result.current.refresh();
      });
      act(() => {
        result.current.saveSlot(0, FIRST_DAY);
      });

      await saves()[0].succeed([FIRST_DAY, null, null]);
      await answerRead(1, profile([null, null, null]));

      expect(result.current.state).toMatchObject({
        profile: { favorites: [FIRST_DAY, null, null] },
      });
    });

    it("reads nothing while a save waits: its answer is the freshest", async () => {
      const { result } = await open();
      act(() => {
        result.current.saveSlot(0, FIRST_DAY);
      });

      act(() => {
        result.current.refresh();
      });

      expect(server.filter(to("/profile"))).toHaveLength(1);
      await saves()[0].succeed([FIRST_DAY, null, null]);
    });
  });
});
