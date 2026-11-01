import { act, renderHook } from "@testing-library/react-native";
import { useAuth } from "@/context/AuthContext";
import { useRewards } from "@/context/RewardsContext";
import { useStreakGoals, useStreakGoalsSync } from "@/hooks/use-streak-goals";
import type { RewardOutcome, StreakGoal, StreakGoalRules } from "@/types/api";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/context/RewardsContext", () => ({ useRewards: jest.fn() }));

// Focus stands for the screen being on top; here it is simply being mounted.
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));

const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * HOUR;
const SERVER_NOW = new Date("2026-11-01T10:00:00.000Z");
// The device clock runs an hour ahead of the server in every test.
const DEVICE_NOW = new Date(SERVER_NOW.getTime() + HOUR);

const RULES: StreakGoalRules = {
  maxGoals: 5,
  nameMaxLength: 40,
  dayXp: 5,
  tiers: [{ tier: "BRONZE", threshold: 7 }],
};

const goal = (overrides: Partial<StreakGoal> = {}): StreakGoal => ({
  id: "goal-1",
  name: "Papierosy",
  startedAt: new Date(SERVER_NOW.getTime() - 2 * HOUR).toISOString(),
  fullDays: 0,
  recordSec: 7200,
  relapseCount: 0,
  ...overrides,
});

const xpAward = {
  amount: 5,
  baseXp: 5,
  multiplier: 1,
  leveledUp: false,
  level: 1,
};
const NOTHING: RewardOutcome = { xpAward: null, badgesEarned: [] };

type Reply = { status: number; body?: unknown };
const reply = (body: unknown, status = 200): Reply => ({ status, body });
const refusal = (status: number): Reply => ({ status });

/*
 * Stands in for the server: answers each "METHOD /path" from a list of replies
 * given by the test, the last one repeating, and records what was asked.
 */
function fakeServer(routes: Record<string, Reply[]>) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const path = url.slice(url.indexOf("/streak-goals"));
    const route = `${init?.method ?? "GET"} ${path}`;
    calls.push(route);
    const replies = routes[route];
    if (!replies) throw new TypeError("Network request failed");
    const { status, body } = replies.length > 1 ? replies.shift()! : replies[0];
    return {
      ok: status < 400,
      status,
      json: async () => body,
    };
  }) as unknown as typeof fetch;
  return {
    calls,
    count: (route: string) => calls.filter((c) => c === route).length,
  };
}

const listOf = (...goals: StreakGoal[]) =>
  reply({ serverNow: SERVER_NOW.toISOString(), rules: RULES, goals });

const GET = "GET /streak-goals";
const SYNC = "POST /streak-goals/sync";
const RELAPSE = "POST /streak-goals/goal-1/relapse";

describe("streak goal hooks", () => {
  const report = jest.fn();

  // Lets the responses of a render land.
  const settle = () => act(async () => {});
  const tick = (ms: number) =>
    act(async () => {
      await jest.advanceTimersByTimeAsync(ms);
    });

  const openScreen = async () => {
    const view = renderHook(() => useStreakGoals());
    await settle();
    return view;
  };

  beforeEach(() => {
    jest.useFakeTimers({ now: DEVICE_NOW });
    jest.clearAllMocks();
    report.mockResolvedValue(undefined);
    jest.mocked(useAuth).mockReturnValue({ token: "token" } as never);
    jest.mocked(useRewards).mockReturnValue({ report });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe("useStreakGoalsSync", () => {
    it("hands what the server paid to the reward queue", async () => {
      const outcome = { xpAward, badgesEarned: [] };
      fakeServer({ [SYNC]: [reply(outcome)] });
      const { result } = renderHook(() => useStreakGoalsSync());

      await act(() => result.current());

      expect(report).toHaveBeenCalledWith(outcome);
    });

    it("stays silent on failure: the next sync pays the same days", async () => {
      fakeServer({ [SYNC]: [refusal(500)] });
      const { result } = renderHook(() => useStreakGoalsSync());

      await act(() => result.current());

      expect(report).not.toHaveBeenCalled();
    });

    it("stays silent without a connection", async () => {
      fakeServer({});
      const { result } = renderHook(() => useStreakGoalsSync());

      await act(() => result.current());

      expect(report).not.toHaveBeenCalled();
    });

    it("sends nothing when nobody is logged in", async () => {
      jest.mocked(useAuth).mockReturnValue({ token: null } as never);
      const server = fakeServer({});
      const { result } = renderHook(() => useStreakGoalsSync());

      await act(() => result.current());

      expect(server.calls).toEqual([]);
    });
  });

  describe("opening the screen", () => {
    it("reads the goals and the rules, and syncs", async () => {
      const outcome = { xpAward, badgesEarned: [] };
      const server = fakeServer({
        [GET]: [listOf(goal())],
        [SYNC]: [reply(outcome)],
      });

      const { result } = await openScreen();

      expect(result.current.goals).toEqual([goal()]);
      expect(result.current.rules).toEqual(RULES);
      expect(result.current.failed).toBe(false);
      expect(server.count(SYNC)).toBe(1);
      expect(report).toHaveBeenCalledWith(outcome);
    });

    it("runs the time by the server's clock, not the device's", async () => {
      fakeServer({ [GET]: [listOf()], [SYNC]: [reply(NOTHING)] });

      const { result } = await openScreen();

      expect(result.current.nowMs).toBe(SERVER_NOW.getTime());
    });

    it("reports a failed read and recovers on retry", async () => {
      fakeServer({
        [GET]: [refusal(500), listOf(goal())],
        [SYNC]: [reply(NOTHING)],
      });

      const { result } = await openScreen();
      expect(result.current.failed).toBe(true);
      expect(result.current.goals).toBeNull();

      await act(() => result.current.load());

      expect(result.current.failed).toBe(false);
      expect(result.current.goals).toEqual([goal()]);
    });

    it("shows the goals even when the sync fails", async () => {
      fakeServer({ [GET]: [listOf(goal())], [SYNC]: [refusal(500)] });

      const { result } = await openScreen();

      expect(result.current.goals).toEqual([goal()]);
      expect(result.current.failed).toBe(false);
    });
  });

  describe("the ticking clock", () => {
    it("moves one second per tick", async () => {
      fakeServer({ [GET]: [listOf()], [SYNC]: [reply(NOTHING)] });
      const { result } = await openScreen();

      await tick(3 * SECOND);

      expect(result.current.nowMs).toBe(SERVER_NOW.getTime() + 3 * SECOND);
    });

    it("stops when the screen goes away", async () => {
      const started = jest.spyOn(global, "setInterval");
      const stopped = jest.spyOn(global, "clearInterval");
      fakeServer({ [GET]: [listOf()], [SYNC]: [reply(NOTHING)] });
      const { unmount } = await openScreen();
      const timer = started.mock.results[0].value;
      expect(stopped).not.toHaveBeenCalledWith(timer);

      unmount();

      expect(stopped).toHaveBeenCalledWith(timer);
    });

    it("syncs once when a full day ends, and not again", async () => {
      // 2 seconds before the first full day ends.
      const startedAt = new Date(
        SERVER_NOW.getTime() - DAY + 2 * SECOND,
      ).toISOString();
      const server = fakeServer({
        [GET]: [listOf(goal({ startedAt }))],
        [SYNC]: [reply(NOTHING)],
      });
      await openScreen();
      expect(server.count(SYNC)).toBe(1);

      await tick(SECOND);
      expect(server.count(SYNC)).toBe(1);

      await tick(5 * SECOND);
      expect(server.count(SYNC)).toBe(2);
    });
  });

  describe("createGoal", () => {
    it("adds the goal the server made and reports no error", async () => {
      const made = goal({ id: "goal-2", name: "Alkohol" });
      fakeServer({
        [GET]: [listOf(goal())],
        [SYNC]: [reply(NOTHING)],
        "POST /streak-goals": [reply(made, 201)],
      });
      const { result } = await openScreen();

      let error: string | null = "unset";
      await act(async () => {
        error = await result.current.createGoal("Alkohol");
      });

      expect(error).toBeNull();
      expect(result.current.goals).toEqual([goal(), made]);
    });

    it.each([
      [409, "streaks.limitReached"],
      [400, "streaks.invalidName"],
      [500, "common.tryAgain"],
    ])("turns a %i into %s", async (status, key) => {
      fakeServer({
        [GET]: [listOf()],
        [SYNC]: [reply(NOTHING)],
        "POST /streak-goals": [refusal(status)],
      });
      const { result } = await openScreen();

      let error: string | null = null;
      await act(async () => {
        error = await result.current.createGoal("Alkohol");
      });

      expect(error).toBe(key);
      expect(result.current.goals).toEqual([]);
    });

    it("tells a missing connection apart", async () => {
      fakeServer({ [GET]: [listOf()], [SYNC]: [reply(NOTHING)] });
      const { result } = await openScreen();

      let error: string | null = null;
      await act(async () => {
        error = await result.current.createGoal("Alkohol");
      });

      expect(error).toBe("common.noConnection");
    });
  });

  describe("relapseGoal", () => {
    const restarted = goal({
      startedAt: SERVER_NOW.toISOString(),
      recordSec: 90000,
      relapseCount: 1,
    });
    const outcome = { xpAward, badgesEarned: [] };

    const relapse = async (result: {
      current: ReturnType<typeof useStreakGoals>;
    }) => {
      let error: string | null = "unset";
      await act(async () => {
        error = await result.current.relapseGoal(goal());
      });
      return error;
    };

    it("shows the restarted goal and hands over what it paid", async () => {
      fakeServer({
        [GET]: [listOf(goal())],
        [SYNC]: [reply(NOTHING)],
        [RELAPSE]: [reply({ ...restarted, ...outcome })],
      });
      const { result } = await openScreen();

      const error = await relapse(result);

      expect(error).toBeNull();
      expect(result.current.goals).toEqual([restarted]);
      expect(report).toHaveBeenCalledWith(outcome);
    });

    it("tries once more when a sync collided and the attempt is still running", async () => {
      const server = fakeServer({
        [GET]: [listOf(goal())],
        [SYNC]: [reply(NOTHING)],
        [RELAPSE]: [refusal(409), reply({ ...restarted, ...outcome })],
      });
      const { result } = await openScreen();

      const error = await relapse(result);

      expect(error).toBeNull();
      expect(server.count(RELAPSE)).toBe(2);
      expect(result.current.goals).toEqual([restarted]);
      expect(report).toHaveBeenCalledWith(outcome);
    });

    it("does not count a slip twice when the attempt was already closed", async () => {
      const server = fakeServer({
        [GET]: [listOf(goal()), listOf(restarted)],
        [SYNC]: [reply(NOTHING)],
        [RELAPSE]: [refusal(409)],
      });
      const { result } = await openScreen();

      const error = await relapse(result);

      expect(error).toBeNull();
      expect(server.count(RELAPSE)).toBe(1);
      expect(result.current.goals).toEqual([restarted]);
    });

    it("does not claim success when the list cannot be read back", async () => {
      const server = fakeServer({
        [GET]: [listOf(goal()), refusal(500)],
        [SYNC]: [reply(NOTHING)],
        [RELAPSE]: [refusal(409)],
      });
      const { result } = await openScreen();

      const error = await relapse(result);

      expect(error).toBe("common.tryAgain");
      expect(server.count(RELAPSE)).toBe(1);
    });

    it("gives up after the second refusal", async () => {
      const server = fakeServer({
        [GET]: [listOf(goal())],
        [SYNC]: [reply(NOTHING)],
        [RELAPSE]: [refusal(409)],
      });
      const { result } = await openScreen();

      const error = await relapse(result);

      expect(error).toBe("common.tryAgain");
      expect(server.count(RELAPSE)).toBe(2);
    });

    it("reports other refusals without trying again", async () => {
      const server = fakeServer({
        [GET]: [listOf(goal())],
        [SYNC]: [reply(NOTHING)],
        [RELAPSE]: [refusal(500)],
      });
      const { result } = await openScreen();

      const error = await relapse(result);

      expect(error).toBe("common.tryAgain");
      expect(server.count(RELAPSE)).toBe(1);
      expect(result.current.goals).toEqual([goal()]);
    });
  });

  describe("deleteGoal", () => {
    const DELETE = "DELETE /streak-goals/goal-1";

    it("takes the goal off the list", async () => {
      fakeServer({
        [GET]: [listOf(goal())],
        [SYNC]: [reply(NOTHING)],
        [DELETE]: [reply(undefined)],
      });
      const { result } = await openScreen();

      let error: string | null = "unset";
      await act(async () => {
        error = await result.current.deleteGoal("goal-1");
      });

      expect(error).toBeNull();
      expect(result.current.goals).toEqual([]);
    });

    it("keeps the goal when the server refuses", async () => {
      fakeServer({
        [GET]: [listOf(goal())],
        [SYNC]: [reply(NOTHING)],
        [DELETE]: [refusal(500)],
      });
      const { result } = await openScreen();

      let error: string | null = null;
      await act(async () => {
        error = await result.current.deleteGoal("goal-1");
      });

      expect(error).toBe("common.tryAgain");
      expect(result.current.goals).toEqual([goal()]);
    });
  });
});
