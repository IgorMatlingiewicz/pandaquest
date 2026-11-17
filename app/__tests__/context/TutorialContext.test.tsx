import { act, renderHook } from "@testing-library/react-native";
import { router } from "expo-router";
import { useAuth, type User } from "@/context/AuthContext";
import { useRewards } from "@/context/RewardsContext";
import { TutorialProvider, useTutorial } from "@/context/TutorialContext";
import type { TutorialStatus } from "@/types/api";
import { fakeServer, type PendingRequest } from "../hooks/fake-server";

jest.mock("expo-router", () => ({ router: { navigate: jest.fn() } }));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/context/RewardsContext", () => ({ useRewards: jest.fn() }));

const BRIGHT_START = { key: "bright_start", tier: "BRONZE", xp: 10 };

const user = (tutorialStatus: TutorialStatus, id = "user-1") =>
  ({ id, tutorialStatus }) as User;

describe("TutorialProvider", () => {
  let server: PendingRequest[];
  const refreshUser = jest.fn();
  const report = jest.fn();
  const release = jest.fn();
  const hold = jest.fn(() => release);

  const loggedInAs = (current: User | null) =>
    jest.mocked(useAuth).mockReturnValue({
      user: current,
      token: current ? "token" : null,
      refreshUser,
    } as never);

  beforeEach(() => {
    jest.clearAllMocks();
    server = fakeServer();
    loggedInAs(user("NOT_STARTED"));
    jest.mocked(useRewards).mockReturnValue({ report, hold, pending: false });
    refreshUser.mockResolvedValue(null);
    report.mockResolvedValue(undefined);
  });

  const render = () =>
    renderHook(() => useTutorial(), { wrapper: TutorialProvider });
  const posts = (path: string) =>
    server.filter((r) => r.url.endsWith(path) && r.init?.method === "POST");
  const navigatedTo = () =>
    jest.mocked(router.navigate).mock.calls.map(([href]) => href);

  /** Opens the tutorial and walks it to step `n`. */
  function walkTo(
    result: { current: ReturnType<typeof useTutorial> },
    n: number,
  ) {
    for (let step = 1; step < n; step++) act(() => result.current.next());
  }

  describe("starting on its own", () => {
    it("starts at step 1 on the Tasks page for an account that has not seen it", () => {
      const { result } = render();

      expect(result.current.state).toEqual({
        phase: "running",
        step: 1,
        confirmingClose: false,
        saving: false,
        saveFailed: false,
      });
      expect(navigatedTo()).toEqual([{ pathname: "/" }]);
    });

    it.each(["DISMISSED", "COMPLETED"] as const)(
      "stays off for an account that %s it",
      (status) => {
        loggedInAs(user(status));
        const { result } = render();

        expect(result.current.state).toEqual({ phase: "off" });
        expect(router.navigate).not.toHaveBeenCalled();
      },
    );

    it("starts once per session, though the user is read again", () => {
      const { result, rerender } = render();
      act(() => result.current.requestClose());
      act(() => result.current.confirmClose());
      act(() => result.current.closeFarewell());

      // The status could not be saved: the same account, still NOT_STARTED.
      loggedInAs(user("NOT_STARTED"));
      rerender({});

      expect(result.current.state).toEqual({ phase: "off" });
    });

    it("waits until somebody is logged in", () => {
      loggedInAs(null);
      const { result, rerender } = render();
      expect(result.current.state).toEqual({ phase: "off" });

      loggedInAs(user("NOT_STARTED"));
      rerender({});
      expect(result.current.state).toMatchObject({ phase: "running" });
    });
  });

  describe("moving through the steps", () => {
    it("opens each step's page, the Progress tab through its param", () => {
      const { result } = render();
      walkTo(result, 9);

      expect(result.current.state).toMatchObject({ step: 9 });
      expect(navigatedTo()).toEqual([
        { pathname: "/" },
        { pathname: "/" },
        { pathname: "/" },
        { pathname: "/streaks" },
        { pathname: "/progress", params: { tab: "stats" } },
        { pathname: "/progress", params: { tab: "achievements" } },
        { pathname: "/friends" },
        { pathname: "/profile" },
        { pathname: "/profile" },
      ]);
    });

    it("goes back, but not before step 1", () => {
      const { result } = render();
      walkTo(result, 3);

      act(() => result.current.back());
      act(() => result.current.back());
      act(() => result.current.back());

      expect(result.current.state).toMatchObject({ step: 1 });
    });

    it("stays at step 9 on Next: finishing is its own button", () => {
      const { result } = render();
      walkTo(result, 9);

      act(() => result.current.next());

      expect(result.current.state).toMatchObject({ step: 9 });
    });
  });

  describe("holding the reward windows back", () => {
    it("holds from the start until the farewell is closed", async () => {
      const { result } = render();
      expect(hold).toHaveBeenCalledTimes(1);

      act(() => result.current.requestClose());
      act(() => result.current.confirmClose());
      expect(release).not.toHaveBeenCalled();

      act(() => result.current.closeFarewell());
      expect(release).toHaveBeenCalledTimes(1);
    });

    it("holds nothing while off", () => {
      loggedInAs(user("COMPLETED"));
      render();

      expect(hold).not.toHaveBeenCalled();
    });
  });

  describe("finishing", () => {
    it("saves COMPLETED, queues Bright Start while held, then says goodbye on Tasks", async () => {
      const { result } = render();
      walkTo(result, 9);
      jest.mocked(router.navigate).mockClear();

      let finished: Promise<void> | undefined;
      act(() => {
        finished = result.current.finish();
      });
      expect(result.current.state).toMatchObject({ saving: true });
      expect(posts("/tutorial/complete")[0].init?.headers).toEqual({
        Authorization: "Bearer token",
      });

      await posts("/tutorial/complete")[0].succeed({
        tutorialStatus: "COMPLETED",
        badgesEarned: [BRIGHT_START],
      });
      await act(() => finished!);

      expect(report).toHaveBeenCalledWith({ badgesEarned: [BRIGHT_START] });
      expect(release).not.toHaveBeenCalled(); // the badge still waits
      expect(result.current.state).toEqual({ phase: "farewell" });
      expect(navigatedTo()).toEqual(["/"]);
    });

    it("reads the user again itself when nothing was earned (a replay)", async () => {
      loggedInAs(user("COMPLETED"));
      const { result } = render();
      act(() => result.current.start());
      walkTo(result, 9);

      act(() => {
        result.current.finish();
      });
      await posts("/tutorial/complete")[0].succeed({
        tutorialStatus: "COMPLETED",
        badgesEarned: [],
      });

      expect(report).not.toHaveBeenCalled();
      expect(refreshUser).toHaveBeenCalledTimes(1);
      expect(result.current.state).toEqual({ phase: "farewell" });
    });

    it.each([
      ["no connection", (r: PendingRequest) => r.drop()],
      ["a server error", (r: PendingRequest) => r.refuse(500)],
    ])("stays at step 9 with a retry after %s", async (_, fail) => {
      const { result } = render();
      walkTo(result, 9);

      act(() => {
        result.current.finish();
      });
      await fail(posts("/tutorial/complete")[0]);

      expect(result.current.state).toEqual({
        phase: "running",
        step: 9,
        confirmingClose: false,
        saving: false,
        saveFailed: true,
      });
      expect(report).not.toHaveBeenCalled();
    });

    it("earns the badge on the retry, and clears the failure", async () => {
      const { result } = render();
      walkTo(result, 9);
      act(() => {
        result.current.finish();
      });
      await posts("/tutorial/complete")[0].drop();

      act(() => {
        result.current.finish();
      });
      expect(result.current.state).toMatchObject({
        saving: true,
        saveFailed: false,
      });
      await posts("/tutorial/complete")[1].succeed({
        tutorialStatus: "COMPLETED",
        badgesEarned: [BRIGHT_START],
      });

      expect(report).toHaveBeenCalledWith({ badgesEarned: [BRIGHT_START] });
      expect(result.current.state).toEqual({ phase: "farewell" });
    });

    it("sends one request for a double press", async () => {
      const { result } = render();
      walkTo(result, 9);

      act(() => {
        result.current.finish();
        result.current.finish();
      });

      expect(posts("/tutorial/complete")).toHaveLength(1);
      await posts("/tutorial/complete")[0].succeed({
        tutorialStatus: "COMPLETED",
        badgesEarned: [],
      });
    });
  });

  describe("turning it off", () => {
    it("asks first, and going back to it keeps the step", () => {
      const { result } = render();
      walkTo(result, 4);

      act(() => result.current.requestClose());
      expect(result.current.state).toMatchObject({
        step: 4,
        confirmingClose: true,
      });

      act(() => result.current.cancelClose());
      expect(result.current.state).toMatchObject({
        step: 4,
        confirmingClose: false,
      });
      expect(posts("/tutorial/dismiss")).toHaveLength(0);
    });

    it("says goodbye on Tasks at once, saving DISMISSED meanwhile", async () => {
      const { result } = render();
      walkTo(result, 4);
      jest.mocked(router.navigate).mockClear();

      act(() => result.current.requestClose());
      act(() => result.current.confirmClose());

      expect(result.current.state).toEqual({ phase: "farewell" });
      expect(navigatedTo()).toEqual(["/"]);
      expect(posts("/tutorial/dismiss")).toHaveLength(1);

      await posts("/tutorial/dismiss")[0].succeed({
        tutorialStatus: "DISMISSED",
      });
      expect(refreshUser).toHaveBeenCalledTimes(1);
    });

    it("closes all the same when the save fails, and does not read the user", async () => {
      const { result } = render();

      act(() => result.current.requestClose());
      act(() => result.current.confirmClose());
      await posts("/tutorial/dismiss")[0].drop();

      expect(result.current.state).toEqual({ phase: "farewell" });
      expect(refreshUser).not.toHaveBeenCalled();
    });
  });

  describe("replaying from the settings", () => {
    it("starts from step 1 on Tasks for an account that already finished", () => {
      loggedInAs(user("COMPLETED"));
      const { result } = render();

      act(() => result.current.start());

      expect(result.current.state).toMatchObject({ phase: "running", step: 1 });
      expect(navigatedTo()).toEqual([{ pathname: "/" }]);
    });

    it("starts from step 1 even when opened in the middle of a run", () => {
      const { result } = render();
      walkTo(result, 6);

      act(() => result.current.start());

      expect(result.current.state).toMatchObject({ step: 1 });
    });
  });

  it("refuses to work outside its provider", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useTutorial())).toThrow("TutorialProvider");
  });
});
