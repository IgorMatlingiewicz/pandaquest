import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useAuth, type User } from "@/context/AuthContext";
import { RewardsProvider, useRewards } from "@/context/RewardsContext";
import type { BadgeAward, RewardOutcome, XpAward } from "@/types/api";

const mockShowXpToast = jest.fn();

jest.mock("@/hooks/use-xp-toast", () => ({
  useXpToast: () => mockShowXpToast,
}));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));

// The queue is what is under test, not the window's looks: this stand-in
// shows which reward is on top and closes it on press, so restyling the real
// window cannot break these tests.
jest.mock("@/components/rewards/reward-modal", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    RewardModal: ({ reward, onClose }: MockModalProps) =>
      reward ? (
        <Pressable role="button" onPress={onClose}>
          <Text>
            {reward.kind === "badge"
              ? reward.badge.key
              : `level ${reward.level}`}
          </Text>
        </Pressable>
      ) : null,
  };
});

type MockModalProps = {
  reward:
    | { kind: "badge"; badge: BadgeAward }
    | { kind: "levelUp"; level: number }
    | null;
  onClose: () => void;
};

const user = (level: number, id = "user-1") => ({ id, level }) as User;

const xpAward: XpAward = {
  amount: 10,
  baseXp: 10,
  multiplier: 1,
  leveledUp: false,
  level: 16,
};
const badge = (key: string): BadgeAward => ({ key, tier: "BRONZE", xp: 50 });

describe("RewardsProvider", () => {
  const refreshUser = jest.fn();
  let report: (outcome: RewardOutcome) => Promise<void>;

  function Capture() {
    report = useRewards().report;
    return null;
  }

  const loggedInAs = (current: User) =>
    jest
      .mocked(useAuth)
      .mockReturnValue({ user: current, refreshUser } as never);

  const app = () => (
    <RewardsProvider>
      <Capture />
    </RewardsProvider>
  );

  const send = (outcome: RewardOutcome) => act(() => report(outcome));
  const closeWindow = () => fireEvent.press(screen.getByRole("button"));
  const shownWindow = () => screen.queryByRole("button");

  beforeEach(() => {
    jest.clearAllMocks();
    loggedInAs(user(16));
    refreshUser.mockResolvedValue(user(16));
  });

  it("does nothing when a response earned nothing", async () => {
    render(app());

    await send({ xpAward: null, badgesEarned: [] });

    expect(mockShowXpToast).not.toHaveBeenCalled();
    expect(refreshUser).not.toHaveBeenCalled();
    expect(shownWindow()).toBeNull();
  });

  it("shows task XP as a toast, without a window", async () => {
    render(app());

    await send({ xpAward, badgesEarned: [] });

    expect(mockShowXpToast).toHaveBeenCalledWith(xpAward);
    expect(refreshUser).toHaveBeenCalledTimes(1);
    expect(shownWindow()).toBeNull();
  });

  it("shows badges one at a time, the next after the previous is closed", async () => {
    render(app());

    await send({ badgesEarned: [badge("first_day"), badge("first_week")] });

    expect(screen.getByText("first_day")).toBeOnTheScreen();
    expect(screen.queryByText("first_week")).toBeNull();

    closeWindow();
    expect(screen.getByText("first_week")).toBeOnTheScreen();

    closeWindow();
    expect(shownWindow()).toBeNull();
  });

  it("announces a level gained from badge XP alone, after the badge", async () => {
    refreshUser.mockResolvedValue(user(17));
    render(app());

    await send({ xpAward: null, badgesEarned: [badge("life_goal")] });

    expect(screen.getByText("life_goal")).toBeOnTheScreen();
    closeWindow();
    expect(screen.getByText("level 17")).toBeOnTheScreen();
  });

  it("queues rewards that arrive while a window is open", async () => {
    render(app());

    await send({ badgesEarned: [badge("first_day")] });
    await send({ badgesEarned: [badge("first_week")] });

    expect(screen.getByText("first_day")).toBeOnTheScreen();
    closeWindow();
    expect(screen.getByText("first_week")).toBeOnTheScreen();
  });

  describe("every level gets exactly one window", () => {
    beforeEach(() => {
      refreshUser.mockResolvedValue(user(17));
    });

    it("when two responses arrive at the same time", async () => {
      render(app());

      await act(async () => {
        await Promise.all([report({ xpAward }), report({ xpAward })]);
      });

      expect(screen.getByText("level 17")).toBeOnTheScreen();
      closeWindow();
      expect(shownWindow()).toBeNull();
    });

    it("when a later response reports the same level", async () => {
      render(app());

      await send({ xpAward });
      closeWindow();
      await send({ xpAward });

      expect(shownWindow()).toBeNull();
    });

    it("and the next level gets its own", async () => {
      render(app());

      await send({ xpAward });
      closeWindow();
      refreshUser.mockResolvedValue(user(18));
      await send({ xpAward });

      expect(screen.getByText("level 18")).toBeOnTheScreen();
    });
  });

  it("does not carry the announced level over to another account", async () => {
    refreshUser.mockResolvedValue(user(17));
    const { rerender } = render(app());
    await send({ xpAward });
    closeWindow();

    // Logged out and in as someone at a lower level.
    loggedInAs(user(3, "user-2"));
    rerender(app());
    refreshUser.mockResolvedValue(user(4, "user-2"));
    await send({ xpAward });

    expect(screen.getByText("level 4")).toBeOnTheScreen();
  });

  describe("when the profile cannot be read back", () => {
    beforeEach(() => {
      refreshUser.mockResolvedValue(null);
    });

    it("still shows the badges the server stored", async () => {
      render(app());

      await send({ xpAward, badgesEarned: [badge("first_day")] });

      expect(mockShowXpToast).toHaveBeenCalledWith(xpAward);
      expect(screen.getByText("first_day")).toBeOnTheScreen();
    });

    it("announces the level with the next successful read", async () => {
      render(app());

      await send({ xpAward });
      expect(shownWindow()).toBeNull();

      refreshUser.mockResolvedValue(user(17));
      await send({ xpAward });

      expect(screen.getByText("level 17")).toBeOnTheScreen();
    });
  });
});
