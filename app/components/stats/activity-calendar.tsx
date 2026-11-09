import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { CELL_GAP, DAY_LABEL_WIDTH } from "@/constants/stats";
import { useStatsFormat } from "@/hooks/use-stats-format";
import {
  activityGrid,
  cellSize,
  monthLabelGap,
  monthLabels,
  type ActivityCell,
} from "@/lib/stats";
import type { ActivityDay } from "@/types/api";

// Whole class names, so Tailwind finds them in the source.
const LEVEL_CLASS = [
  "bg-activity-0",
  "bg-activity-1",
  "bg-activity-2",
  "bg-activity-3",
  "bg-activity-4",
] as const;

// Rows named on the left: Monday, Wednesday and Friday. The dates are any
// such days, used only to get the names in the current language.
const NAMED_ROWS: Record<number, string> = {
  0: "2026-11-09",
  2: "2026-11-11",
  4: "2026-11-13",
};

// No lineHeight: on web Text is a plain span, where a bare number is a
// multiple of the font size (12 would mean 120 px), not pixels.
const LABEL_TEXT = { fontSize: 10 };
const LEGEND_SQUARE = 12;

// The mark of a full day: a dot in the text colour with a thin outline in the
// background colour, so it shows on every shade of the scale, in both themes.
// The selection is a ring, so the two never look alike.
function FullDayDot({ squareSize }: { squareSize: number }) {
  const size = Math.max(4, Math.round(squareSize * 0.4));
  return (
    <View
      className="rounded-full bg-foreground border-background"
      style={{ width: size, height: size, borderWidth: 1 }}
    />
  );
}

type Props = {
  days: ActivityDay[];
  weeks: number;
  selected: string | null;
  onSelect: (date: string) => void;
};

// A GitHub-style calendar: one column per week, Monday on top. The square
// size follows the width, so it never needs to scroll sideways.
export function ActivityCalendar({ days, weeks, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const format = useStatsFormat();
  const [width, setWidth] = useState(0);

  const columns = activityGrid(days, weeks);
  const size = cellSize(width, weeks);
  const step = size + CELL_GAP;
  const labels = monthLabels(columns, monthLabelGap(size));
  const chosen = days.find((day) => day.date === selected) ?? null;

  const describe = (day: ActivityDay, keys: [string, string], date: string) =>
    t(day.fullDay ? keys[1] : keys[0], {
      date,
      completions: t("stats.activity.completions", { count: day.completions }),
    });

  // A plain function, not a component: a component declared in here would be
  // a new type on every render, and React would remount all the squares.
  function renderSquare(cell: ActivityCell) {
    const isSelected = cell.date === selected;
    return (
      <Pressable
        key={cell.date}
        onPress={() => onSelect(cell.date)}
        role="button"
        aria-selected={isSelected}
        accessibilityLabel={describe(
          cell,
          ["stats.activity.cell", "stats.activity.cellFullDay"],
          format.longDate(cell.date),
        )}
        className={`items-center justify-center rounded-sm ${
          LEVEL_CLASS[cell.level]
        } ${isSelected ? "border-foreground" : ""}`}
        style={{ width: size, height: size, borderWidth: isSelected ? 2 : 0 }}
      >
        {cell.fullDay && <FullDayDot squareSize={size} />}
      </Pressable>
    );
  }

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && (
        <>
          <View style={{ height: 16, marginLeft: DAY_LABEL_WIDTH }}>
            {labels.map(({ column, month }) => (
              <Text
                key={month}
                className="absolute text-muted-foreground"
                style={{ ...LABEL_TEXT, left: column * step }}
              >
                {format.month(month)}
              </Text>
            ))}
          </View>

          <View className="flex-row">
            <View style={{ width: DAY_LABEL_WIDTH, gap: CELL_GAP }}>
              {Array.from({ length: 7 }, (_, row) => (
                <View
                  key={row}
                  className="justify-center"
                  style={{ height: size }}
                >
                  {NAMED_ROWS[row] && (
                    <Text className="text-muted-foreground" style={LABEL_TEXT}>
                      {format.weekday(NAMED_ROWS[row])}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            <View className="flex-row" style={{ gap: CELL_GAP }}>
              {columns.map((column) => (
                <View key={column[0]!.date} style={{ gap: CELL_GAP }}>
                  {column.map((cell) => (cell ? renderSquare(cell) : null))}
                </View>
              ))}
            </View>
          </View>

          <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row items-center gap-1.5">
              <View
                className="items-center justify-center rounded-sm bg-activity-2"
                style={{ width: LEGEND_SQUARE, height: LEGEND_SQUARE }}
              >
                <FullDayDot squareSize={LEGEND_SQUARE} />
              </View>
              <Text size="xs" className="text-muted-foreground">
                {t("stats.activity.fullDay")}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text size="xs" className="text-muted-foreground">
                {t("stats.activity.less")}
              </Text>
              {LEVEL_CLASS.map((level) => (
                <View
                  key={level}
                  className={`rounded-sm ${level}`}
                  style={{ width: LEGEND_SQUARE, height: LEGEND_SQUARE }}
                />
              ))}
              <Text size="xs" className="text-muted-foreground">
                {t("stats.activity.more")}
              </Text>
            </View>
          </View>

          {/* Its height is kept even without a day, so nothing jumps. */}
          <View className="mt-2 justify-center" style={{ minHeight: 20 }}>
            {chosen && (
              <Text size="sm">
                {describe(
                  chosen,
                  ["stats.activity.details", "stats.activity.detailsFullDay"],
                  format.shortDate(chosen.date),
                )}
              </Text>
            )}
          </View>
        </>
      )}
    </View>
  );
}
