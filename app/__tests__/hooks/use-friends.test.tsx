import { act, renderHook } from "@testing-library/react-native";
import { useAuth } from "@/context/AuthContext";
import { useFriendsSummary } from "@/context/FriendsSummaryContext";
import { useFriends, type SendOutcome } from "@/hooks/use-friends";
import type { FriendFailure } from "@/lib/api-errors";
import type { Friend, FriendRequestsResponse } from "@/types/api";
import { fakeServer, type PendingRequest } from "./fake-server";

jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/context/FriendsSummaryContext", () => ({
  useFriendsSummary: jest.fn(),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "pl" } }),
}));
// Focus stands for the screen being on top; here it is simply being mounted.
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) =>
    jest.requireActual("react").useEffect(effect, [effect]),
}));

const ALA: Friend = { friendshipId: "f-1", username: "Ala", level: 3 };
const REQUESTS: FriendRequestsResponse = {
  incoming: [
    {
      id: "r-1",
      user: { username: "Bartek", level: 2 },
      status: "PENDING",
      createdAt: "2026-11-13T10:00:00.000Z",
    },
  ],
  outgoing: [],
};
const NO_REQUESTS: FriendRequestsResponse = { incoming: [], outgoing: [] };

// A GET has no method of its own; POST /friends/requests shares the path of
// GET /friends/requests, so the method tells them apart.
const reads = (path: string) => (request: PendingRequest) =>
  request.url.endsWith(path) && request.init?.method === undefined;
const sent = (method: string, path: string) => (request: PendingRequest) =>
  request.url.endsWith(path) && request.init?.method === method;

describe("useFriends", () => {
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

  /** The nth read: its three requests. */
  const read = (n: number) => ({
    code: server.filter(reads("/friends/code"))[n],
    friends: server.filter(reads("/friends"))[n],
    requests: server.filter(reads("/friends/requests"))[n],
  });
  const answerRead = async (
    n: number,
    { code = "ABCDEFGH", friends = [ALA], requests = REQUESTS } = {},
  ) => {
    await read(n).code.succeed({ code });
    await read(n).friends.succeed(friends);
    await read(n).requests.succeed(requests);
  };
  const readCount = () => server.filter(reads("/friends")).length;

  const open = async () => {
    const hook = renderHook(() => useFriends());
    await answerRead(0);
    return hook;
  };

  describe("reading", () => {
    it("is loading until all three answers come, then has them together", async () => {
      const { result } = renderHook(() => useFriends());

      expect(result.current.state).toEqual({ status: "loading" });
      await read(0).code.succeed({ code: "ABCDEFGH" });
      await read(0).friends.succeed([ALA]);
      expect(result.current.state).toEqual({ status: "loading" });

      await read(0).requests.succeed(REQUESTS);
      expect(result.current.state).toEqual({
        status: "ready",
        data: { code: "ABCDEFGH", friends: [ALA], requests: REQUESTS },
      });
    });

    it("sends the token of the logged-in user with every request", async () => {
      renderHook(() => useFriends());

      for (const request of Object.values(read(0))) {
        expect(request.init).toEqual({
          headers: { Authorization: "Bearer token" },
        });
      }
      await answerRead(0);
    });

    it("sends nothing when nobody is logged in", () => {
      jest.mocked(useAuth).mockReturnValue({ token: null } as never);
      renderHook(() => useFriends());

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it.each([
      [500, "friends.loadError"],
      [401, "common.sessionExpired"],
    ])("turns a %i into %s", async (status, errorKey) => {
      const { result } = renderHook(() => useFriends());

      await read(0).friends.refuse(status);

      expect(result.current.state).toEqual({ status: "error", errorKey });
    });

    it("fails as a whole when only one of the three fails", async () => {
      const { result } = renderHook(() => useFriends());

      await read(0).code.succeed({ code: "ABCDEFGH" });
      await read(0).friends.succeed([ALA]);
      await read(0).requests.refuse(500);

      expect(result.current.state).toMatchObject({ status: "error" });
    });

    it("tells a missing connection apart", async () => {
      const { result } = renderHook(() => useFriends());

      await read(0).code.drop();

      expect(result.current.state).toEqual({
        status: "error",
        errorKey: "common.noConnection",
      });
    });

    it("goes from an error through loading to the data on retry", async () => {
      const { result } = renderHook(() => useFriends());
      await read(0).code.refuse(500);

      act(() => {
        result.current.retry();
      });
      expect(result.current.state).toEqual({ status: "loading" });

      await answerRead(1);
      expect(result.current.state).toMatchObject({ status: "ready" });
    });

    it("keeps the data when a refresh fails", async () => {
      const { result } = await open();

      act(() => {
        result.current.refresh();
      });
      await read(1).friends.refuse(500);

      expect(result.current.state).toMatchObject({
        status: "ready",
        data: { friends: [ALA] },
      });
    });

    it("ignores an older answer that comes back after a newer one", async () => {
      const { result } = renderHook(() => useFriends());
      act(() => {
        result.current.refresh();
      });

      await answerRead(1, { friends: [] });
      await answerRead(0, { friends: [ALA] });

      expect(result.current.state).toMatchObject({ data: { friends: [] } });
    });
  });

  describe("sending a request", () => {
    const posts = () => server.filter(sent("POST", "/friends/requests"));

    it("sends the code as typed and tells the sender it went", async () => {
      const { result } = await open();

      let outcome: Promise<SendOutcome | null> | undefined;
      act(() => {
        outcome = result.current.sendRequest("abcd-efgh");
      });

      const [post] = posts();
      expect(post.init).toMatchObject({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
      });
      expect(JSON.parse(post.init!.body as string)).toEqual({
        code: "abcd-efgh",
      });

      await post.succeed(
        { id: "r-9", status: "PENDING", autoAccepted: false },
        201,
      );
      await answerRead(1);

      await expect(outcome).resolves.toEqual({
        ok: true,
        key: "friends.add.sent",
      });
    });

    it("says they are friends now when the other side had asked too", async () => {
      const { result } = await open();

      let outcome: Promise<SendOutcome | null> | undefined;
      act(() => {
        outcome = result.current.sendRequest("ABCD-EFGH");
      });
      await posts()[0].succeed(
        { id: "r-1", status: "ACCEPTED", autoAccepted: true },
        201,
      );
      await answerRead(1);

      await expect(outcome).resolves.toEqual({
        ok: true,
        key: "friends.add.nowFriends",
      });
    });

    it("reads the screen and the nav count again, and is busy until the screen is fresh", async () => {
      const { result } = await open();

      act(() => {
        result.current.sendRequest("ABCD-EFGH");
      });
      expect(result.current.sending).toBe(true);
      await posts()[0].succeed(
        { id: "r-9", status: "PENDING", autoAccepted: false },
        201,
      );

      expect(readCount()).toBe(2);
      expect(summaryRefresh).toHaveBeenCalledTimes(1);
      expect(result.current.sending).toBe(true);

      await answerRead(1, { friends: [] });
      expect(result.current.sending).toBe(false);
      expect(result.current.state).toMatchObject({ data: { friends: [] } });
    });

    it.each([
      [404, "INVALID_FRIEND_CODE"],
      [400, "CANNOT_ADD_SELF"],
      [409, "ALREADY_FRIENDS"],
    ])("gives the text for a %i %s", async (status, code) => {
      const { result } = await open();

      let outcome: Promise<SendOutcome | null> | undefined;
      act(() => {
        outcome = result.current.sendRequest("ABCD-EFGH");
      });
      await posts()[0].refuse(status, { code });
      await answerRead(1);

      await expect(outcome).resolves.toEqual({
        ok: false,
        failure: { key: `friends.errors.${code}` },
      });
    });

    it("tells a declined sender when they may ask again", async () => {
      const { result } = await open();

      let outcome: Promise<SendOutcome | null> | undefined;
      act(() => {
        outcome = result.current.sendRequest("ABCD-EFGH");
      });
      await posts()[0].refuse(409, {
        code: "FRIEND_REQUEST_COOLDOWN",
        availableAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      });
      await answerRead(1);

      await expect(outcome).resolves.toEqual({
        ok: false,
        failure: {
          key: "friends.errors.FRIEND_REQUEST_COOLDOWN",
          values: { count: 3, date: expect.any(String) },
        },
      });
    });

    it("tells the rate limit apart", async () => {
      const { result } = await open();

      let outcome: Promise<SendOutcome | null> | undefined;
      act(() => {
        outcome = result.current.sendRequest("ABCD-EFGH");
      });
      await posts()[0].refuse(429, { statusCode: 429 });
      await answerRead(1);

      await expect(outcome).resolves.toEqual({
        ok: false,
        failure: { key: "friends.errors.tooManyAttempts" },
      });
    });

    it("reads nothing again when no answer came at all", async () => {
      const { result } = await open();

      let outcome: Promise<SendOutcome | null> | undefined;
      act(() => {
        outcome = result.current.sendRequest("ABCD-EFGH");
      });
      await posts()[0].drop();

      await expect(outcome).resolves.toEqual({
        ok: false,
        failure: { key: "common.noConnection" },
      });
      expect(readCount()).toBe(1);
      expect(summaryRefresh).not.toHaveBeenCalled();
      expect(result.current.sending).toBe(false);
    });

    it("sends one request for a double tap", async () => {
      const { result } = await open();

      let second: Promise<SendOutcome | null> | undefined;
      act(() => {
        result.current.sendRequest("ABCD-EFGH");
        second = result.current.sendRequest("ABCD-EFGH");
      });

      expect(posts()).toHaveLength(1);
      await expect(second).resolves.toBeNull();
      await posts()[0].succeed(
        { id: "r-9", status: "PENDING", autoAccepted: false },
        201,
      );
      await answerRead(1);
    });

    it("does not let a read sent before the request bring the old list back", async () => {
      const { result } = await open();
      act(() => {
        result.current.refresh();
      });
      act(() => {
        result.current.sendRequest("ABCD-EFGH");
      });

      await posts()[0].succeed(
        { id: "r-1", status: "ACCEPTED", autoAccepted: true },
        201,
      );
      const withBartek = [ALA, { ...ALA, friendshipId: "f-2", username: "B" }];
      await answerRead(2, { friends: withBartek });
      await answerRead(1, { friends: [ALA] });

      expect(result.current.state).toMatchObject({
        data: { friends: withBartek },
      });
    });
  });

  describe("a new code", () => {
    const regenerations = () =>
      server.filter(sent("POST", "/friends/code/regenerate"));

    it("takes the new code from the answer", async () => {
      const { result } = await open();

      let outcome: Promise<FriendFailure | null> | undefined;
      act(() => {
        outcome = result.current.regenerateCode();
      });
      expect(result.current.regenerating).toBe(true);
      await regenerations()[0].succeed({ code: "ZZZZ2222" });

      await expect(outcome).resolves.toBeNull();
      expect(result.current.regenerating).toBe(false);
      expect(result.current.state).toMatchObject({
        data: { code: "ZZZZ2222", friends: [ALA] },
      });
    });

    it("keeps the old code on screen when it fails", async () => {
      const { result } = await open();

      let outcome: Promise<FriendFailure | null> | undefined;
      act(() => {
        outcome = result.current.regenerateCode();
      });
      await regenerations()[0].refuse(500);

      await expect(outcome).resolves.toEqual({ key: "common.genericError" });
      expect(result.current.state).toMatchObject({
        data: { code: "ABCDEFGH" },
      });
    });

    it("draws once for a double tap", async () => {
      const { result } = await open();

      act(() => {
        result.current.regenerateCode();
        result.current.regenerateCode();
      });

      expect(regenerations()).toHaveLength(1);
      await regenerations()[0].succeed({ code: "ZZZZ2222" });
    });
  });

  describe("acting on a request", () => {
    it.each([
      ["accept", "POST", "/friends/requests/r-1/accept"],
      ["decline", "POST", "/friends/requests/r-1/decline"],
      ["cancel", "DELETE", "/friends/requests/r-1"],
    ] as const)(
      "%s sends %s %s, then reads everything again",
      async (action, method, path) => {
        const { result } = await open();

        let outcome: Promise<FriendFailure | null> | undefined;
        act(() => {
          outcome = result.current.actOnRequest("r-1", action);
        });
        expect(result.current.busyRequestId).toBe("r-1");
        const [request] = server.filter(sent(method, path));
        expect(request.init?.headers).toEqual({
          Authorization: "Bearer token",
        });

        await request.succeed(undefined, method === "DELETE" ? 204 : 200);
        expect(summaryRefresh).toHaveBeenCalledTimes(1);
        await answerRead(1, { friends: [], requests: NO_REQUESTS });

        await expect(outcome).resolves.toBeNull();
        expect(result.current.busyRequestId).toBeNull();
        expect(result.current.state).toMatchObject({
          data: { requests: NO_REQUESTS },
        });
      },
    );

    it("says a request is no longer valid, and shows the list as it is now", async () => {
      const { result } = await open();

      let outcome: Promise<FriendFailure | null> | undefined;
      act(() => {
        outcome = result.current.actOnRequest("r-1", "accept");
      });
      await server
        .filter(sent("POST", "/friends/requests/r-1/accept"))[0]
        .refuse(404, { code: "REQUEST_NOT_FOUND" });
      await answerRead(1, { requests: NO_REQUESTS });

      await expect(outcome).resolves.toEqual({
        key: "friends.errors.REQUEST_NOT_FOUND",
      });
      expect(result.current.state).toMatchObject({
        data: { requests: NO_REQUESTS },
      });
    });

    it("acts on one request at a time", async () => {
      const { result } = await open();

      let second: Promise<FriendFailure | null> | undefined;
      act(() => {
        result.current.actOnRequest("r-1", "accept");
        second = result.current.actOnRequest("r-2", "decline");
      });

      await expect(second).resolves.toBeNull();
      expect(server.filter((r) => r.init?.method === "POST")).toHaveLength(1);
      await server
        .filter(sent("POST", "/friends/requests/r-1/accept"))[0]
        .succeed(undefined);
      await answerRead(1);
    });

    it("escapes the id in the path", async () => {
      const { result } = await open();

      act(() => {
        result.current.actOnRequest("a/b?c", "cancel");
      });

      expect(
        server.filter(sent("DELETE", "/friends/requests/a%2Fb%3Fc")),
      ).toHaveLength(1);
    });
  });
});
