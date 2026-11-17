import { fireEvent, render, screen } from "@testing-library/react-native";
import { RemindersModal } from "@/components/reminders/reminders-modal";
import { useReminders } from "@/context/RemindersContext";
import type { ReminderView } from "@/lib/reminders";

jest.mock("@/context/RemindersContext", () => ({ useReminders: jest.fn() }));
// Gluestack's core ships as ESM that this Jest setup does not transform, so
// no test renders components/ui. Plain React Native stand-ins keep what is
// under test here (texts, order, buttons) without touching the Jest config.
jest.mock("@/components/ui/button", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    Button: ({ onPress, children }: MockProps & { onPress: () => void }) => (
      <Pressable role="button" onPress={onPress}>
        {children}
      </Pressable>
    ),
    ButtonText: ({ children }: MockProps) => <Text>{children}</Text>,
  };
});
jest.mock("@/components/ui/card", () => ({
  Card: ({ children }: MockProps) => children,
}));
jest.mock("@/components/ui/vstack", () => ({
  VStack: ({ children }: MockProps) => children,
}));
jest.mock("@/components/ui/text", () => {
  const { Text } = jest.requireActual("react-native");
  return { Text: ({ children }: MockProps) => <Text>{children}</Text> };
});

type MockProps = { children?: React.ReactNode };
jest.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }));
// The key and the count, so the test sees which text and which form.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}|${options.count}`,
  }),
}));

describe("RemindersModal", () => {
  const close = jest.fn();
  const goTo = jest.fn();

  const showing = (view: ReminderView | null) =>
    jest.mocked(useReminders).mockReturnValue({
      view,
      close,
      goTo,
      enabled: true,
      setEnabled: jest.fn(),
    });

  beforeEach(() => jest.clearAllMocks());

  const ALL: ReminderView = {
    items: [
      { kind: "daily", remaining: 3, streak: 4 },
      { kind: "weekly", remaining: 1, streak: null },
      { kind: "friends", count: 2 },
    ],
    keys: ["daily:2026-11-17", "weekly:2026-W47", "friend_invite:x:1"],
  };

  it("shows nothing while there is no window", () => {
    showing(null);
    render(<RemindersModal />);

    expect(screen.queryByText("reminders.title")).toBeNull();
  });

  it("lists daily, weekly and friend requests with their counts, in order", () => {
    showing(ALL);
    render(<RemindersModal />);

    const texts = screen
      .getAllByText(/^reminders\.(daily|weekly|friends|streak)/)
      .map((node) => node.props.children as string);
    expect(texts).toEqual([
      "reminders.daily|3",
      "reminders.streakDays|4",
      "reminders.weekly",
      "reminders.friends|2",
    ]);
  });

  it("has no streak line where the server sent none", () => {
    showing({
      items: [{ kind: "weekly", remaining: 1, streak: null }],
      keys: ["weekly:2026-W47"],
    });
    render(<RemindersModal />);

    expect(screen.queryByText(/^reminders\.streak/)).toBeNull();
  });

  it("names the weekly streak in weeks", () => {
    showing({
      items: [{ kind: "weekly", remaining: 1, streak: 5 }],
      keys: ["weekly:2026-W47"],
    });
    render(<RemindersModal />);

    expect(screen.getByText("reminders.streakWeeks|5")).toBeOnTheScreen();
  });

  it("sends each Go to button to its own place", () => {
    showing(ALL);
    render(<RemindersModal />);

    const toTasks = screen.getAllByText("reminders.goToTasks");
    fireEvent.press(toTasks[0]);
    fireEvent.press(toTasks[1]);
    fireEvent.press(screen.getByText("reminders.goToFriends"));

    expect(goTo.mock.calls).toEqual([["daily"], ["weekly"], ["friends"]]);
  });

  it("closes with Close", () => {
    showing(ALL);
    render(<RemindersModal />);

    fireEvent.press(screen.getByText("reminders.close"));

    expect(close).toHaveBeenCalledTimes(1);
  });
});
