import { useCallback, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ConfirmDialog,
  type ConfirmRequest,
} from "@/components/confirm-dialog";
import { GoalSheet } from "@/components/streaks/goal-sheet";
import { StreakGoalGrid } from "@/components/streaks/streak-goal-grid";
import { StreakGoalPager } from "@/components/streaks/streak-goal-pager";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useIsWide } from "@/hooks/use-is-wide";
import { useStreakGoals } from "@/hooks/use-streak-goals";
import { alertMessage } from "@/lib/confirm";
import { elapsedParts, randomIndex, recordDays } from "@/lib/streak-goals";
import type { StreakGoal } from "@/types/api";

type PendingAction = { kind: "relapse" | "delete"; goal: StreakGoal };

export default function StreaksScreen() {
  const {
    goals,
    rules,
    nowMs,
    failed,
    load,
    createGoal,
    relapseGoal,
    deleteGoal,
  } = useStreakGoals();
  const { t } = useTranslation();
  const isWide = useIsWide();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // A number instead of the text itself, so that changing the language
  // translates the encouragement instead of leaving the old one on screen.
  const [encouragementSeed, setEncouragementSeed] = useState(Math.random);

  // A new one per visit: the pages stay mounted between visits.
  useFocusEffect(
    useCallback(() => {
      setEncouragementSeed(Math.random());
    }, []),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!goals || !rules) {
    return (
      <VStack
        space="md"
        className="flex-1 items-center justify-center bg-background"
      >
        <Text>{failed ? t("streaks.loadError") : t("common.loading")}</Text>
        {failed && (
          <Button variant="outline" onPress={load}>
            <ButtonText>{t("streaks.retry")}</ButtonText>
          </Button>
        )}
      </VStack>
    );
  }

  const goalsLeft = rules.maxGoals - goals.length;
  const canAdd = goalsLeft > 0;
  const encouragements = t("streaks.encouragements", {
    returnObjects: true,
  }) as string[];
  const encouragement =
    encouragements[randomIndex(encouragements.length, () => encouragementSeed)];

  function reportFailure(key: string) {
    alertMessage(t("streaks.actionError"), t(key));
  }

  async function handleRelapse(goal: StreakGoal) {
    const failure = await relapseGoal(goal);
    if (failure) reportFailure(failure);
    else setEncouragementSeed(Math.random());
  }

  async function handleDelete(goal: StreakGoal) {
    const failure = await deleteGoal(goal.id);
    if (failure) reportFailure(failure);
  }

  function confirmRequest({ kind, goal }: PendingAction): ConfirmRequest {
    if (kind === "relapse") {
      const { days, hours } = elapsedParts(goal.startedAt, nowMs);
      return {
        title: t("streaks.relapseConfirm.title"),
        message: t("streaks.relapseConfirm.message", {
          name: goal.name,
          duration: t("streaks.duration", {
            days: t("streaks.daysCount", { count: days }),
            hours: t("streaks.hoursCount", { count: hours }),
          }),
        }),
        note: t("streaks.relapseConfirm.note"),
        confirmLabel: t("streaks.relapseConfirm.confirm"),
        onConfirm: () => handleRelapse(goal),
      };
    }
    return {
      title: t("streaks.deleteConfirm.title", { name: goal.name }),
      message: t("streaks.deleteConfirm.message", {
        record: t("streaks.daysCount", { count: recordDays(goal, nowMs) }),
      }),
      note: t("streaks.deleteConfirm.note"),
      confirmLabel: t("streaks.deleteGoal"),
      destructive: true,
      onConfirm: () => handleDelete(goal),
    };
  }

  const openSheet = () => setSheetOpen(true);
  const askRelapse = (goal: StreakGoal) =>
    setPending({ kind: "relapse", goal });
  const askDelete = (goal: StreakGoal) => setPending({ kind: "delete", goal });

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingVertical: 16, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} />
        }
      >
        {goals.length === 0 ? (
          <VStack
            space="md"
            className="flex-1 items-center justify-center px-6"
          >
            <MaterialCommunityIcons
              name="timer-outline"
              size={56}
              color="#999"
            />
            <Heading size="md" className="text-center">
              {t("streaks.empty.title")}
            </Heading>
            <Text className="text-center text-muted-foreground">
              {t("streaks.empty.message")}
            </Text>
            <Button className="min-h-11" onPress={openSheet}>
              <ButtonText>{t("streaks.empty.action")}</ButtonText>
            </Button>
          </VStack>
        ) : isWide ? (
          <VStack space="md" className="w-full max-w-5xl mx-auto px-4">
            <HStack className="items-center justify-between">
              <VStack>
                <Heading size="xl">{t("streaks.title")}</Heading>
                <Text className="text-muted-foreground">
                  {t("streaks.activeGoals", {
                    count: goals.length,
                    max: rules.maxGoals,
                  })}
                </Text>
              </VStack>
              <Button
                className="min-h-11"
                onPress={openSheet}
                isDisabled={!canAdd}
              >
                <ButtonText>{t("streaks.addGoal")}</ButtonText>
              </Button>
            </HStack>
            <Text>{encouragement}</Text>
            <StreakGoalGrid
              goals={goals}
              nowMs={nowMs}
              rules={rules}
              goalsLeft={goalsLeft}
              onAdd={openSheet}
              onRelapse={askRelapse}
              onDelete={askDelete}
            />
            {!canAdd && (
              <Text size="sm" className="text-muted-foreground">
                {t("streaks.limitHint", { max: rules.maxGoals })}
              </Text>
            )}
            <Text size="sm" className="text-muted-foreground">
              {t("streaks.dayXpEveryGoal", { xp: rules.dayXp })}
            </Text>
          </VStack>
        ) : (
          <StreakGoalPager
            goals={goals}
            nowMs={nowMs}
            rules={rules}
            encouragement={encouragement}
            canAdd={canAdd}
            onAdd={openSheet}
            onRelapse={askRelapse}
            onDelete={askDelete}
          />
        )}
      </ScrollView>

      <GoalSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        maxLength={rules.nameMaxLength}
        onCreate={createGoal}
      />
      <ConfirmDialog
        request={pending && confirmRequest(pending)}
        onClose={() => setPending(null)}
      />
    </>
  );
}
