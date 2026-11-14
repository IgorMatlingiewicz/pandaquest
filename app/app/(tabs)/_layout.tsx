import { useEffect } from "react";
import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { TopBar } from "@/components/top-bar";
import { FriendsSummaryProvider } from "@/context/FriendsSummaryContext";
import { useStreakGoalsSync } from "@/hooks/use-streak-goals";

// Headless tabs: the hidden TabList only declares the pages; the visible
// links live in the TopBar (inline on wide screens, a burger menu on narrow
// ones) and switch pages through TabTriggers with the same names.
export default function TabLayout() {
  const syncStreakGoals = useStreakGoalsSync();

  // After logging in or starting the app, whichever page it opens on: the
  // days passed in the meantime are paid without visiting the goals screen.
  useEffect(() => {
    syncStreakGoals();
  }, [syncStreakGoals]);

  return (
    // Around the tabs, as the count of waiting friend requests shows in the
    // top bar on every page.
    <FriendsSummaryProvider>
      <Tabs style={{ flex: 1 }}>
        <TopBar />
        {/* TabSlot's own container grows with its content and never shrinks,
            so on web a page would get the full height of its content and its
            ScrollView would have nothing to scroll. flex + minHeight: 0 keep
            the page within the space left under the top bar. */}
        <TabSlot style={{ flex: 1, minHeight: 0 }} />
        <TabList style={{ display: "none" }}>
          <TabTrigger name="index" href="/" />
          <TabTrigger name="streaks" href="/streaks" />
          <TabTrigger name="progress" href="/progress" />
          <TabTrigger name="profile" href="/profile" />
          {/* A folder with a stack of its own: the list, a friend's profile
              and their badges. */}
          <TabTrigger name="friends" href="/friends" />
        </TabList>
      </Tabs>
    </FriendsSummaryProvider>
  );
}
