import { act, renderHook } from "@testing-library/react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { RemindersProvider, useReminders } from "@/context/RemindersContext";
import { useRewards } from "@/context/RewardsContext";
import { useTutorial, type TutorialState } from "@/context/TutorialContext";
import {
  getRemindersEnabled,
  setRemindersEnabled,
} from "@/lib/remindersStorage";
import type { Reminder } from "@/types/api";
import { fakeAppState } from "../hooks/fake-app-state";
import { fakeServer, type PendingRequest } from "../hooks/fake-server";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/context/RewardsContext", () => ({ useRewards: jest.fn() }));
jest.mock("@/context/TutorialContext", () => ({ useTutorial: jest.fn() }));
jest.mock("@/lib/remindersStorage", () => ({
  getRemindersEnabled: jest.fn(),
  setRemindersEnabled: jest.fn(),
}));

const DAILY: Reminder = {
  key: "daily:2026-11-17",
  type: "DAILY_EVENING",
  payload: { remaining: 2 },
};
const INVITE: Reminder = {
  key: "friend_invite:3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b:1794301200123",
  type: "FRIEND_INVITE",
  payload: { count: 1 },
};

const OFF: TutorialState = { phase: "off" };
const RUNNING: TutorialState = {
  phase: "running",
  step: 1,
  confirmingClose: false,
  saving: false,
  saveFailed: false,
};

describe("RemindersProvider", () => {
  let server: PendingRequest[];
  let app: ReturnType<typeof fakeAppState>;
  const release = jest.fn();
  const hold = jest.fn(() => release);
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

  const around = (tutorial: TutorialState, rewardsPending = false) => {
    jest.mocked(useTutorial).mockReturnValue({ state: tutorial } as never);
    jest
      .mocked(useRewards)
      .mockReturnValue({ report: jest.fn(), hold, pending: rewardsPending });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    server = fakeServer();
    app = fakeAppState("active");
    jest.mocked(useAuth).mockReturnValue({ token: "token" } as never);
    around(OFF);
    jest.mocked(getRemindersEnabled).mockResolvedValue(true);
    jest.mocked(setRemindersEnabled).mockResolvedValue();
  });

  afterAll(() => warn.mockRestore());

  /** Renders, and lets the switch be read from the device. */
  async function render() {
    const hook = renderHook(() => useReminders(), {
      wrapper: RemindersProvider,
    });
    await act(async () => {});
    return hook;
  }

  const reads = () =>
    server.filter((r) => r.url.endsWith("/reminders") && !r.init?.method);
  const acks = () => server.filter((r) => r.url.endsWith("/reminders/ack"));
  const ackedKeys = (request: PendingRequest) =>
    (JSON.parse(request.init!.body as string) as { keys: string[] }).keys;
  const answer = (request: PendingRequest, reminders: Reminder[]) =>
    request.succeed({ reminders });

  describe("reading", () => {
    it("asks once the logged-in area opens, with the token", async () => {
      await render();

      expect(reads()).toHaveLength(1);
      expect(reads()[0].init?.headers).toMatchObject({
        Authorization: "Bearer token",
      });
    });

    it("asks again on every return to the front, not on a timer", async () => {
      await render();
      await answer(reads()[0], []);

      await app.goTo("background");
      expect(reads()).toHaveLength(1);
      await app.goTo("active");
      expect(reads()).toHaveLength(2);
    });

    it("asks nothing and confirms nothing while the switch is off", async () => {
      jest.mocked(getRemindersEnabled).mockResolvedValue(false);
      const { result } = await render();

      await app.goTo("background");
      await app.goTo("active");

      expect(server).toHaveLength(0);
      expect(result.current.enabled).toBe(false);
    });

    it("fails quietly: no window, only a log", async () => {
      const { result } = await render();

      await reads()[0].drop();

      expect(result.current.view).toBeNull();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe("showing", () => {
    it("opens the window and confirms its keys the moment it shows", async () => {
      const { result } = await render();

      await answer(reads()[0], [DAILY, INVITE]);

      expect(result.current.view?.items.map((item) => item.kind)).toEqual([
        "daily",
        "friends",
      ]);
      expect(acks()).toHaveLength(1);
      expect(ackedKeys(acks()[0])).toEqual([DAILY.key, INVITE.key]);
    });

    it("opens nothing for an empty list, and confirms nothing", async () => {
      const { result } = await render();

      await answer(reads()[0], []);

      expect(result.current.view).toBeNull();
      expect(acks()).toHaveLength(0);
    });

    it("waits while the tutorial is on screen, then shows", async () => {
      around(RUNNING);
      const { result, rerender } = await render();
      await answer(reads()[0], [DAILY]);

      expect(result.current.view).toBeNull();
      expect(acks()).toHaveLength(0);

      around(OFF);
      rerender({});

      expect(result.current.view).not.toBeNull();
      expect(acks()).toHaveLength(1);
    });

    it("waits while a reward window is on screen or queued, then shows", async () => {
      around(OFF, true);
      const { result, rerender } = await render();
      await answer(reads()[0], [DAILY]);

      expect(result.current.view).toBeNull();

      around(OFF, false);
      rerender({});

      expect(result.current.view).not.toBeNull();
    });

    it("holds the reward windows back while it is open", async () => {
      const { result } = await render();
      await answer(reads()[0], [DAILY]);

      expect(hold).toHaveBeenCalledTimes(1);
      expect(release).not.toHaveBeenCalled();

      act(() => result.current.close());

      expect(release).toHaveBeenCalledTimes(1);
    });
  });

  describe("never twice in a session", () => {
    it("does not show the same keys again, though the server sends them", async () => {
      const { result } = await render();
      await answer(reads()[0], [DAILY]);
      // The confirmation did not get through: the server still sends it.
      await acks()[0].drop();
      act(() => result.current.close());

      await app.goTo("background");
      await app.goTo("active");
      await acks()[1].succeed(undefined, 204);
      await answer(reads()[1], [DAILY]);

      expect(result.current.view).toBeNull();
    });

    it("confirms a failed key again, quietly, before the next read", async () => {
      const { result } = await render();
      await answer(reads()[0], [DAILY]);
      await acks()[0].refuse(500);
      act(() => result.current.close());

      await app.goTo("background");
      await app.goTo("active");

      expect(acks()).toHaveLength(2);
      expect(ackedKeys(acks()[1])).toEqual([DAILY.key]);
      // The read waits for that confirmation.
      expect(reads()).toHaveLength(1);
      await acks()[1].succeed(undefined, 204);
      expect(reads()).toHaveLength(2);

      // Confirmed now: the next return sends no confirmation.
      await answer(reads()[1], []);
      await app.goTo("background");
      await app.goTo("active");
      expect(acks()).toHaveLength(2);
    });

    it("shows only what is new, in a new window", async () => {
      const { result } = await render();
      await answer(reads()[0], [DAILY]);
      await acks()[0].succeed(undefined, 204);
      act(() => result.current.close());

      await app.goTo("background");
      await app.goTo("active");
      await answer(reads()[1], [DAILY, INVITE]);

      expect(result.current.view).toEqual({
        items: [{ kind: "friends", count: 1 }],
        keys: [INVITE.key],
      });
      expect(ackedKeys(acks()[1])).toEqual([INVITE.key]);
    });
  });

  describe("the Go to buttons", () => {
    it.each([
      ["daily", { pathname: "/" }],
      ["weekly", { pathname: "/" }],
      ["friends", { pathname: "/friends", params: { tab: "requests" } }],
    ] as const)("%s: closes the window and opens %j", async (kind, href) => {
      const { result } = await render();
      await answer(reads()[0], [DAILY]);

      act(() => result.current.goTo(kind));

      expect(result.current.view).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(href);
    });
  });

  describe("the switch", () => {
    it("is on when the device has nothing stored", async () => {
      const { result } = await render();

      expect(result.current.enabled).toBe(true);
    });

    it("turned off: saves it, and asks nothing on the next return", async () => {
      const { result } = await render();
      await answer(reads()[0], []);

      act(() => result.current.setEnabled(false));
      await app.goTo("background");
      await app.goTo("active");

      expect(setRemindersEnabled).toHaveBeenCalledWith(false);
      expect(result.current.enabled).toBe(false);
      expect(reads()).toHaveLength(1);
    });

    it("turned on again: asks at once", async () => {
      jest.mocked(getRemindersEnabled).mockResolvedValue(false);
      const { result } = await render();

      await act(async () => result.current.setEnabled(true));

      expect(setRemindersEnabled).toHaveBeenCalledWith(true);
      expect(reads()).toHaveLength(1);
    });
  });
});
