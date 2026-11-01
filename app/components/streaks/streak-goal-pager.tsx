import { useEffect, useRef, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  StreakGoalActions,
  StreakGoalCard,
} from "@/components/streaks/streak-goal-card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { pageAt } from "@/lib/streak-goals";
import type { StreakGoal, StreakGoalRules } from "@/types/api";

const CHIP_CLASS =
  "min-h-11 min-w-11 items-center justify-center rounded-full border px-4";
const ROW_PADDING = 16;
// isTruncated works on web only, where Text is a plain span that must not get
// numberOfLines at all, not even undefined.
const ONE_LINE = Platform.OS === "web" ? {} : { numberOfLines: 1 };

type NameRowProps = {
  goals: StreakGoal[];
  active: number;
  canAdd: boolean;
  onSelect: (index: number) => void;
  onAdd: () => void;
};

// One button per goal; the row follows the pager when the names do not fit.
function GoalNameRow({ goals, active, canAdd, onSelect, onAdd }: NameRowProps) {
  const { t } = useTranslation();
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<number[]>([]);

  useEffect(() => {
    const x = (positions.current[active] ?? 0) - ROW_PADDING;
    scroll.current?.scrollTo({ x });
  }, [active]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: ROW_PADDING, gap: 8 }}
      className="grow-0"
    >
      {goals.map((goal, index) => {
        const selected = index === active;
        return (
          <Pressable
            key={goal.id}
            onPress={() => onSelect(index)}
            onLayout={(event) => {
              positions.current[index] = event.nativeEvent.layout.x;
            }}
            role="tab"
            aria-selected={selected}
            className={`${CHIP_CLASS} ${
              selected ? "border-blue-500 bg-muted" : "border-border"
            }`}
          >
            <Text
              bold={selected}
              isTruncated
              {...ONE_LINE}
              className={selected ? "" : "text-muted-foreground"}
              style={{ maxWidth: 160 }}
            >
              {goal.name}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onAdd}
        disabled={!canAdd}
        accessibilityRole="button"
        accessibilityLabel={t("streaks.addGoal")}
        className={`${CHIP_CLASS} border-border ${canAdd ? "" : "opacity-40"}`}
      >
        <MaterialCommunityIcons name="plus" size={20} color="#999" />
      </Pressable>
    </ScrollView>
  );
}

// Decorative: the name buttons say the same to a screen reader.
function PageDots({ count, active }: { count: number; active: number }) {
  return (
    <View aria-hidden className="flex-row items-center justify-center gap-1">
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          className={`h-2 rounded-full ${
            index === active
              ? "w-5 bg-foreground"
              : "w-2 bg-muted-foreground/40"
          }`}
        />
      ))}
    </View>
  );
}

type Props = {
  goals: StreakGoal[];
  nowMs: number;
  rules: StreakGoalRules;
  encouragement: string;
  canAdd: boolean;
  onAdd: () => void;
  onRelapse: (goal: StreakGoal) => void;
  onDelete: (goal: StreakGoal) => void;
};

// The narrow layout: one goal per page, changed by swiping or by its name.
export function StreakGoalPager({
  goals,
  nowMs,
  rules,
  encouragement,
  canAdd,
  onAdd,
  onRelapse,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const list = useRef<FlatList<StreakGoal>>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);
  const knownCount = useRef(goals.length);

  // A deleted last goal leaves the page number past the end.
  const active = Math.min(page, goals.length - 1);

  function goTo(index: number) {
    setPage(index);
    list.current?.scrollToIndex({ index });
  }

  // A new goal is the last page; show it at once.
  useEffect(() => {
    if (goals.length > knownCount.current) goTo(goals.length - 1);
    knownCount.current = goals.length;
  }, [goals.length]);

  return (
    <VStack space="md">
      <GoalNameRow
        goals={goals}
        active={active}
        canAdd={canAdd}
        onSelect={goTo}
        onAdd={onAdd}
      />
      {!canAdd && (
        <Text size="sm" className="px-4 text-muted-foreground">
          {t("streaks.limitHint", { max: rules.maxGoals })}
        </Text>
      )}

      <View onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}>
        {pageWidth > 0 && (
          <FlatList
            ref={list}
            data={goals}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(goal) => goal.id}
            extraData={nowMs}
            getItemLayout={(_, index) => ({
              length: pageWidth,
              offset: pageWidth * index,
              index,
            })}
            onScroll={(event) =>
              setPage(
                pageAt(
                  event.nativeEvent.contentOffset.x,
                  pageWidth,
                  goals.length,
                ),
              )
            }
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <View className="px-4" style={{ width: pageWidth }}>
                <StreakGoalCard goal={item} nowMs={nowMs} rules={rules} />
              </View>
            )}
          />
        )}
      </View>

      <VStack space="sm" className="px-4">
        <Text className="text-center">{encouragement}</Text>
        {goals.length > 1 && (
          <>
            <PageDots count={goals.length} active={active} />
            <Text size="sm" className="text-center text-muted-foreground">
              {t("streaks.swipeHint")}
            </Text>
          </>
        )}
        <StreakGoalActions
          onRelapse={() => onRelapse(goals[active])}
          onDelete={() => onDelete(goals[active])}
        />
      </VStack>
    </VStack>
  );
}
