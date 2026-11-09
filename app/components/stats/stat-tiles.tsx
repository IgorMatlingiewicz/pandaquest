import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useIsWide } from "@/hooks/use-is-wide";
import { useStatsFormat } from "@/hooks/use-stats-format";
import type { StatsSummary } from "@/types/api";

type TileProps = { label: string; value: string; note?: string };

function Tile({ label, value, note }: TileProps) {
  return (
    <Card size="sm" className="flex-1">
      <Text size="sm" className="text-muted-foreground">
        {label}
      </Text>
      <View>
        <Text size="2xl" bold>
          {value}
        </Text>
        {note && (
          <Text size="xs" className="text-muted-foreground">
            {note}
          </Text>
        )}
      </View>
    </Card>
  );
}

// Two by two on a narrow screen, one row of four on a wide one.
export function StatTiles({ summary }: { summary: StatsSummary }) {
  const { t } = useTranslation();
  const isWide = useIsWide();
  const format = useStatsFormat();

  const tiles: (TileProps & { key: string })[] = [
    {
      key: "fullDays",
      label: t("stats.tiles.fullDays"),
      value: format.number(summary.fullDaysTotal),
    },
    {
      key: "streak",
      label: t("stats.tiles.streak"),
      value: t("stats.tiles.days", { count: summary.currentStreak }),
      note: t("stats.tiles.record", { count: summary.longestStreak }),
    },
    {
      key: "xpMonth",
      label: t("stats.tiles.xpMonth"),
      value: format.number(summary.xpThisMonth),
    },
    {
      key: "completionsMonth",
      label: t("stats.tiles.completionsMonth"),
      value: format.number(summary.completionsThisMonth),
    },
  ];

  return (
    <View className="flex-row flex-wrap -m-1.5">
      {tiles.map(({ key, ...tile }) => (
        <View
          key={key}
          className="p-1.5"
          style={{ width: isWide ? "25%" : "50%" }}
        >
          <Tile {...tile} />
        </View>
      ))}
    </View>
  );
}
