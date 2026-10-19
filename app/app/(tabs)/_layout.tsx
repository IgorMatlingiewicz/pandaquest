import { Tabs, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import { TopBar } from "@/components/top-bar";

// Headless tabs: the hidden TabList only declares the pages; the visible
// links live in the TopBar (inline on wide screens, a burger menu on narrow
// ones) and switch pages through TabTriggers with the same names.
export default function TabLayout() {
  return (
    <Tabs style={{ flex: 1 }}>
      <TopBar />
      <TabSlot />
      <TabList style={{ display: "none" }}>
        <TabTrigger name="index" href="/" />
        <TabTrigger name="achievements" href="/achievements" />
      </TabList>
    </Tabs>
  );
}
