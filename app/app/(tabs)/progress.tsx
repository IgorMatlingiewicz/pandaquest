import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AchievementsPanel } from "@/components/badges/achievements-panel";
import { StatsPanel } from "@/components/stats/stats-panel";
import { Text } from "@/components/ui/text";
import { useStats } from "@/hooks/use-stats";

type Tab = "stats" | "achievements";

const TABS: Tab[] = ["stats", "achievements"];

// Same look as the goal name buttons on the streaks screen.
const TAB_CLASS =
  "min-h-11 items-center justify-center rounded-full border px-4";

/*
 * Statistics and Achievements. The tab is local state, not a route: both
 * panels stay mounted and the hidden one is not shown, so switching back
 * keeps what was on screen instead of loading from scratch. The cost: the
 * address is always /progress, and the back button does not switch tabs.
 */
export default function ProgressScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("stats");
  // Here and not in the panel, so the data outlives the panel being hidden.
  const { state, refresh, retry } = useStats();

  function select(next: Tab) {
    // Back on Statistics: refreshed quietly, the data on screen stays.
    if (next === "stats" && tab !== "stats") refresh();
    setTab(next);
  }

  // minHeight 0: on web a flex child would otherwise grow with its content,
  // leaving the panel's own ScrollView nothing to scroll.
  const panel = (shown: boolean) => ({
    flex: 1,
    minHeight: 0,
    display: shown ? ("flex" as const) : ("none" as const),
  });

  return (
    <View className="flex-1 bg-background">
      <View
        role="tablist"
        className="w-full max-w-4xl mx-auto flex-row gap-2 px-4 pt-4"
      >
        {TABS.map((name) => {
          const selected = name === tab;
          return (
            <Pressable
              key={name}
              onPress={() => select(name)}
              role="tab"
              aria-selected={selected}
              className={`${TAB_CLASS} ${
                selected ? "border-blue-500 bg-muted" : "border-border"
              }`}
            >
              <Text
                bold={selected}
                className={selected ? "" : "text-muted-foreground"}
              >
                {t(`progress.tabs.${name}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={panel(tab === "stats")}>
        <StatsPanel state={state} refresh={refresh} retry={retry} />
      </View>
      <View style={panel(tab === "achievements")}>
        <AchievementsPanel />
      </View>
    </View>
  );
}
