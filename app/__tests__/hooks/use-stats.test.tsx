import { act, renderHook } from "@testing-library/react-native";
import { useAuth } from "@/context/AuthContext";
import { useStats } from "@/hooks/use-stats";
import type { StatsResponse } from "@/types/api";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

// Focus stands for the screen being on top; here it is simply being mounted.
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));

const stats = (xpThisMonth: number): StatsResponse => ({
  serverNow: "2026-11-11T11:00:00.000Z",
  timezone: "Europe/Warsaw",
  activity: { days: [] },
  weeklyXp: [],
  summary: {
    fullDaysTotal: 0,
    currentStreak: 0,
    longestStreak: 0,
    xpThisMonth,
    completionsThisMonth: 0,
  },
});

type Pending = {
  succeed: (body: StatsResponse) => Promise<void>;
  refuse: (status: number) => Promise<void>;
  drop: () => Promise<void>;
};

/*
 * Stands in for the server. Every request waits until the test answers it,
 * so the test decides the order in which answers come back.
 */
function fakeServer() {
  const pending: Pending[] = [];
  global.fetch = jest.fn(
    () =>
      new Promise((resolve, reject) => {
        const settle = (fn: () => void) =>
          act(async () => {
            fn();
          });
        pending.push({
          succeed: (body) =>
            settle(() =>
              resolve({ ok: true, status: 200, json: async () => body }),
            ),
          refuse: (status) =>
            settle(() =>
              resolve({ ok: false, status, json: async () => ({}) }),
            ),
          drop: () =>
            settle(() => reject(new TypeError("Network request failed"))),
        });
      }),
  ) as unknown as typeof fetch;
  return pending;
}

describe("useStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ token: "token" } as never);
  });

  const open = () => renderHook(() => useStats());

  it("is loading until the first answer, then shows the data", async () => {
    const server = fakeServer();
    const { result } = open();

    expect(result.current.state).toEqual({ status: "loading" });

    await server[0].succeed(stats(10));

    expect(result.current.state).toEqual({
      status: "ready",
      stats: stats(10),
    });
  });

  it("sends the token of the logged-in user", async () => {
    const server = fakeServer();
    open();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/stats$/),
      { headers: { Authorization: "Bearer token" } },
    );
    await server[0].succeed(stats(0));
  });

  it("sends nothing when nobody is logged in", () => {
    jest.mocked(useAuth).mockReturnValue({ token: null } as never);
    fakeServer();
    open();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each([
    [500, "stats.loadError"],
    [401, "common.sessionExpired"],
  ])("turns a %i into %s", async (status, errorKey) => {
    const server = fakeServer();
    const { result } = open();

    await server[0].refuse(status);

    expect(result.current.state).toEqual({ status: "error", errorKey });
  });

  it("tells a missing connection apart", async () => {
    const server = fakeServer();
    const { result } = open();

    await server[0].drop();

    expect(result.current.state).toEqual({
      status: "error",
      errorKey: "common.noConnection",
    });
  });

  it("goes from an error through loading to the data on retry", async () => {
    const server = fakeServer();
    const { result } = open();
    await server[0].refuse(500);

    act(() => {
      result.current.retry();
    });
    expect(result.current.state).toEqual({ status: "loading" });

    await server[1].succeed(stats(20));
    expect(result.current.state).toEqual({
      status: "ready",
      stats: stats(20),
    });
  });

  it("keeps the data on screen while it refreshes, then replaces it", async () => {
    const server = fakeServer();
    const { result } = open();
    await server[0].succeed(stats(10));

    act(() => {
      result.current.refresh();
    });
    expect(result.current.state).toEqual({
      status: "ready",
      stats: stats(10),
    });

    await server[1].succeed(stats(30));
    expect(result.current.state).toEqual({
      status: "ready",
      stats: stats(30),
    });
  });

  it("keeps the data when a refresh fails", async () => {
    const server = fakeServer();
    const { result } = open();
    await server[0].succeed(stats(10));

    act(() => {
      result.current.refresh();
    });
    await server[1].refuse(500);

    expect(result.current.state).toEqual({
      status: "ready",
      stats: stats(10),
    });
  });

  describe("when an older answer comes back after a newer one", () => {
    it("ignores older data", async () => {
      const server = fakeServer();
      const { result } = open();
      act(() => {
        result.current.refresh();
      });

      await server[1].succeed(stats(30));
      await server[0].succeed(stats(10));

      expect(result.current.state).toEqual({
        status: "ready",
        stats: stats(30),
      });
    });

    it("ignores an older failure while the newer request still waits", async () => {
      const server = fakeServer();
      const { result } = open();
      act(() => {
        result.current.refresh();
      });

      await server[0].refuse(500);
      expect(result.current.state).toEqual({ status: "loading" });

      await server[1].succeed(stats(30));
      expect(result.current.state).toEqual({
        status: "ready",
        stats: stats(30),
      });
    });

    it("ignores an older failure", async () => {
      const server = fakeServer();
      const { result } = open();
      act(() => {
        result.current.refresh();
      });

      await server[1].succeed(stats(30));
      await server[0].refuse(500);

      expect(result.current.state).toEqual({
        status: "ready",
        stats: stats(30),
      });
    });
  });
});
