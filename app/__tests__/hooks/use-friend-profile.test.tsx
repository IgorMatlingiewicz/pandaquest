import { act, renderHook } from "@testing-library/react-native";
import { useAuth } from "@/context/AuthContext";
import { useFriendsSummary } from "@/context/FriendsSummaryContext";
import { useFriendBadges, useFriendProfile } from "@/hooks/use-friend-profile";
import type { FriendFailure } from "@/lib/api-errors";
import type { FriendBadge, FriendProfile } from "@/types/api";
import { fakeServer, type PendingRequest } from "./fake-server";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/context/FriendsSummaryContext", () => ({
  useFriendsSummary: jest.fn(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "pl" } }),
}));
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));

const profile = (username = "Ala"): FriendProfile => ({
  username,
  joinedAt: "2026-09-01T10:00:00.000Z",
  level: 4,
  badges: { earned: 2, total: 26 },
  favorites: [null, null, null],
});

const BADGES: FriendBadge[] = [
  {
    key: "first_day",
    tiers: [
      { tier: "BRONZE", threshold: 1, earnedAt: "2026-10-01T08:00:00.000Z" },
    ],
  },
];

const to = (path: string) => (request: PendingRequest) =>
  request.url.endsWith(path);

describe("useFriendProfile", () => {
  let server: PendingRequest[];
  const summaryRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ token: "token" } as never);
    jest
      .mocked(useFriendsSummary)
      .mockReturnValue({ pendingIncoming: 0, refresh: summaryRefresh });
    server = fakeServer();
  });

  const reads = () => server.filter(to("/friends/f-1/profile"));
  const removals = () =>
    server.filter(
      (r) => r.url.endsWith("/friends/f-1") && r.init?.method === "DELETE",
    );

  const open = async () => {
    const hook = renderHook(() => useFriendProfile("f-1"));
    await reads()[0].succeed(profile());
    return hook;
  };

  describe("reading", () => {
    it("reads the profile of the friendship in the path, with the token", async () => {
      const { result } = renderHook(() => useFriendProfile("f-1"));

      expect(result.current.state).toEqual({ status: "loading" });
      expect(reads()[0].init).toEqual({
        headers: { Authorization: "Bearer token" },
      });
      await reads()[0].succeed(profile());

      expect(result.current.state).toEqual({
        status: "ready",
        data: profile(),
      });
    });

    it("says the friendship is gone on a 404, instead of offering a retry", async () => {
      const { result } = renderHook(() => useFriendProfile("f-1"));

      await reads()[0].refuse(404, { code: "FRIEND_NOT_FOUND" });

      expect(result.current.state).toEqual({ status: "gone" });
    });

    it.each([
      [500, "friends.loadError"],
      [401, "common.sessionExpired"],
    ])("turns a %i into %s", async (status, errorKey) => {
      const { result } = renderHook(() => useFriendProfile("f-1"));

      await reads()[0].refuse(status);

      expect(result.current.state).toEqual({ status: "error", errorKey });
    });

    it("drops the data when a refresh finds the friendship gone", async () => {
      const { result } = await open();

      act(() => {
        result.current.refresh();
      });
      await reads()[1].refuse(404, { code: "FRIEND_NOT_FOUND" });

      expect(result.current.state).toEqual({ status: "gone" });
    });

    it("keeps the data when a refresh fails otherwise", async () => {
      const { result } = await open();

      act(() => {
        result.current.refresh();
      });
      await reads()[1].drop();

      expect(result.current.state).toMatchObject({ status: "ready" });
    });

    it("reads the new friend when the path changes", async () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: string }) => useFriendProfile(id),
        { initialProps: { id: "f-1" } },
      );
      await reads()[0].succeed(profile("Ala"));

      rerender({ id: "f-2" });
      await server
        .filter(to("/friends/f-2/profile"))[0]
        .succeed(profile("Ola"));

      expect(result.current.state).toMatchObject({
        data: { username: "Ola" },
      });
    });
  });

  describe("removing the friend", () => {
    it("sends DELETE for the friendship and updates the nav count", async () => {
      const { result } = await open();

      let outcome: Promise<FriendFailure | null> | undefined;
      act(() => {
        outcome = result.current.remove();
      });
      expect(result.current.removing).toBe(true);
      expect(removals()[0].init?.headers).toEqual({
        Authorization: "Bearer token",
      });
      await removals()[0].succeed(undefined, 204);

      await expect(outcome).resolves.toBeNull();
      expect(result.current.removing).toBe(false);
      expect(summaryRefresh).toHaveBeenCalledTimes(1);
    });

    it("counts it done when the other side ended it first", async () => {
      const { result } = await open();

      let outcome: Promise<FriendFailure | null> | undefined;
      act(() => {
        outcome = result.current.remove();
      });
      await removals()[0].refuse(404, { code: "FRIEND_NOT_FOUND" });

      await expect(outcome).resolves.toBeNull();
    });

    it.each([
      [
        "a server failure",
        (r: PendingRequest) => r.refuse(500),
        "common.genericError",
      ],
      ["no answer", (r: PendingRequest) => r.drop(), "common.noConnection"],
    ])("gives the text for %s", async (_, answer, key) => {
      const { result } = await open();

      let outcome: Promise<FriendFailure | null> | undefined;
      act(() => {
        outcome = result.current.remove();
      });
      await answer(removals()[0]);

      await expect(outcome).resolves.toEqual({ key });
    });

    it("sends one DELETE for a double tap", async () => {
      const { result } = await open();

      let second: Promise<FriendFailure | null> | undefined;
      act(() => {
        result.current.remove();
        second = result.current.remove();
      });

      expect(removals()).toHaveLength(1);
      await expect(second).resolves.toBeNull();
      await removals()[0].succeed(undefined, 204);
    });
  });
});

describe("useFriendBadges", () => {
  let server: PendingRequest[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({ token: "token" } as never);
    server = fakeServer();
  });

  it("reads the badges of the friendship in the path", async () => {
    const { result } = renderHook(() => useFriendBadges("f-1"));

    await server.filter(to("/friends/f-1/badges"))[0].succeed(BADGES);

    expect(result.current.state).toEqual({ status: "ready", data: BADGES });
  });

  it("says the friendship is gone on a 404", async () => {
    const { result } = renderHook(() => useFriendBadges("f-1"));

    await server.filter(to("/friends/f-1/badges"))[0].refuse(404);

    expect(result.current.state).toEqual({ status: "gone" });
  });
});
