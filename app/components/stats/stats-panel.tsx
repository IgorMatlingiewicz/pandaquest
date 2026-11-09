import { useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import { ActivityCalendar } from "@/components/stats/activity-calendar";
import { StatTiles } from "@/components/stats/stat-tiles";
import { WeeklyXpChart } from "@/components/stats/weekly-xp-chart";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ACTIVITY_WEEKS } from "@/constants/stats";
import { useIsWide } from "@/hooks/use-is-wide";
import type { StatsState } from "@/hooks/use-stats";
import { isEmptyStats, todayOf } from "@/lib/stats";

type Props = {
  state: StatsState;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
};

// The Statistics tab. Its data comes from the screen, which keeps it while
// the tab is hidden.
export function StatsPanel({ state, refresh, retry }: Props) {
  const { t } = useTranslation();
  const isWide = useIsWide();
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  if (state.status !== "ready") {
    return (
      <VStack
        space="md"
        className="flex-1 items-center justify-center bg-background px-6"
      >
        <Text className="text-center">
          {state.status === "error" ? t(state.errorKey) : t("common.loading")}
        </Text>
        {state.status === "error" && (
          <Button variant="outline" onPress={retry}>
            <ButtonText>{t("stats.retry")}</ButtonText>
          </Button>
        )}
      </VStack>
    );
  }

  const { stats } = state;
  const days = stats.activity.days;
  // Today until the user picks a day, and again if a refresh drops it.
  const selectedDay =
    selected && days.some((day) => day.date === selected)
      ? selected
      : todayOf(days);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />
      }
    >
      <VStack space="lg" className="w-full max-w-4xl mx-auto">
        <StatTiles summary={stats.summary} />

        {isEmptyStats(stats) && (
          <Text className="text-muted-foreground">{t("stats.empty")}</Text>
        )}

        <Card>
          <Heading size="sm">{t("stats.activity.title")}</Heading>
          <ActivityCalendar
            days={days}
            weeks={isWide ? ACTIVITY_WEEKS.wide : ACTIVITY_WEEKS.narrow}
            selected={selectedDay}
            onSelect={setSelected}
          />
        </Card>

        <Card>
          <Heading size="sm">{t("stats.weeklyXp.title")}</Heading>
          <WeeklyXpChart weeks={stats.weeklyXp} />
        </Card>
      </VStack>
    </ScrollView>
  );
}
