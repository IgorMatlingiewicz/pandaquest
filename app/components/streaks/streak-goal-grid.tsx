import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  StreakGoalActions,
  StreakGoalCard,
} from "@/components/streaks/streak-goal-card";
import { Text } from "@/components/ui/text";
import type { StreakGoal, StreakGoalRules } from "@/types/api";

const COLUMN = { width: "33.333%" as const };

type Props = {
  goals: StreakGoal[];
  nowMs: number;
  rules: StreakGoalRules;
  goalsLeft: number;
  onAdd: () => void;
  onRelapse: (goal: StreakGoal) => void;
  onDelete: (goal: StreakGoal) => void;
};

// The wide layout: every goal at once, in three columns.
export function StreakGoalGrid({
  goals,
  nowMs,
  rules,
  goalsLeft,
  onAdd,
  onRelapse,
  onDelete,
}: Props) {
  const { t } = useTranslation();

  return (
    <View className="flex-row flex-wrap -mx-2">
      {goals.map((goal) => (
        <View key={goal.id} className="p-2" style={COLUMN}>
          <StreakGoalCard goal={goal} nowMs={nowMs} rules={rules} compact>
            <StreakGoalActions
              compact
              onRelapse={() => onRelapse(goal)}
              onDelete={() => onDelete(goal)}
            />
          </StreakGoalCard>
        </View>
      ))}

      {goalsLeft > 0 && (
        <View className="p-2" style={COLUMN}>
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            className="flex-1 min-h-40 items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4"
          >
            <MaterialCommunityIcons name="plus" size={28} color="#999" />
            <Text className="text-center text-muted-foreground">
              {t("streaks.addGoalLeft", { count: goalsLeft })}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
