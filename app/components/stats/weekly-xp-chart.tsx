import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { BAR_MAX_HEIGHT, BAR_MAX_WIDTH } from "@/constants/stats";
import { useStatsFormat } from "@/hooks/use-stats-format";
import { weeklyBars } from "@/lib/stats";
import type { WeekXp } from "@/types/api";

// Room above the highest bar for its value.
const VALUE_ROOM = 20;

// Bars drawn with plain views, the current week on the right and highlighted.
// A week without XP is the baseline alone. Labels sit in their own row below,
// so a long one cannot push its bar up.
export function WeeklyXpChart({ weeks }: { weeks: WeekXp[] }) {
  const { t } = useTranslation();
  const format = useStatsFormat();
  const bars = weeklyBars(weeks, BAR_MAX_HEIGHT, format.dayMonth);
  const empty = bars.every((bar) => bar.value === 0);

  // Nothing to compare: the baseline and a sentence instead of a tall, blank
  // chart.
  if (empty) {
    return (
      <View className="border-t border-border pt-2">
        <Text size="sm" className="text-muted-foreground">
          {t("stats.weeklyXp.empty")}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View
        className="flex-row items-end border-b border-border"
        style={{ height: BAR_MAX_HEIGHT + VALUE_ROOM }}
      >
        {bars.map((bar) => (
          <View
            key={bar.key}
            className="flex-1 items-center"
            accessible
            role="img"
            accessibilityLabel={t("stats.weeklyXp.bar", {
              date: bar.label,
              xp: format.number(bar.value),
            })}
          >
            {bar.value > 0 && (
              <Text
                size="xs"
                bold={bar.isCurrent}
                className={bar.isCurrent ? "" : "text-muted-foreground"}
              >
                {format.number(bar.value)}
              </Text>
            )}
            <View
              className={`w-3/5 rounded-t-md ${
                bar.isCurrent ? "bg-highlight" : "bg-muted-foreground/40"
              }`}
              style={{ height: bar.height, maxWidth: BAR_MAX_WIDTH }}
            />
          </View>
        ))}
      </View>

      <View className="mt-1 flex-row">
        {bars.map((bar) => (
          <Text
            key={bar.key}
            size="xs"
            bold={bar.isCurrent}
            className={`flex-1 text-center ${
              bar.isCurrent ? "" : "text-muted-foreground"
            }`}
          >
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
