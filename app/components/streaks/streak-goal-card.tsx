import type { ReactNode } from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { TIER_COLORS } from "@/constants/badge-tiers";
import {
  elapsedParts,
  tierProgress,
  twoDigits,
  type ElapsedParts,
} from "@/lib/streak-goals";
import type { StreakGoal, StreakGoalRules, StreakGoalTier } from "@/types/api";

const MARK_SIZE = { full: 28, compact: 14 };
// The digits keep their width, so the ticking seconds do not shake the row.
const TICKING_DIGITS = { fontVariant: ["tabular-nums" as const] };

// One threshold of the current attempt: filled and checked once reached.
function TierMark({
  tier,
  reached,
  size,
}: {
  tier: StreakGoalTier;
  reached: boolean;
  size: number;
}) {
  const color = TIER_COLORS[tier.tier];

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: reached ? color : "transparent",
      }}
    >
      {reached && size === MARK_SIZE.full && (
        <MaterialCommunityIcons name="check" size={16} color="#ffffff" />
      )}
    </View>
  );
}

function TierRow({
  tiers,
  fullDays,
}: {
  tiers: StreakGoalTier[];
  fullDays: number;
}) {
  const { t } = useTranslation();

  return (
    <HStack className="justify-between">
      {tiers.map((tier) => {
        const reached = fullDays >= tier.threshold;
        const name = t(`badges.tiers.${tier.tier}`);
        const days = t("streaks.daysCount", { count: tier.threshold });
        return (
          <View
            key={tier.tier}
            className="flex-1 items-center gap-1"
            accessible
            role="img"
            accessibilityLabel={t(
              reached ? "streaks.tierReached" : "streaks.tierNotReached",
              { tier: name, days },
            )}
          >
            <TierMark tier={tier} reached={reached} size={MARK_SIZE.full} />
            <Text size="sm" bold={reached}>
              {days}
            </Text>
            <Text size="xs" className="text-muted-foreground">
              {name}
            </Text>
          </View>
        );
      })}
    </HStack>
  );
}

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <VStack className="flex-1 rounded-lg bg-muted px-3 py-2">
      <Text size="xl" bold style={TICKING_DIGITS}>
        {twoDigits(value)}
      </Text>
      <Text size="xs" className="text-muted-foreground">
        {label}
      </Text>
    </VStack>
  );
}

function DayCounter({
  parts,
  compact,
}: {
  parts: ElapsedParts;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const { days, hours, minutes, seconds } = parts;

  return (
    // One label with days and hours only: a screen reader should not chase
    // the seconds.
    <View
      className="gap-2"
      accessible
      role="img"
      accessibilityLabel={t("streaks.duration", {
        days: t("streaks.daysCount", { count: days }),
        hours: t("streaks.hoursCount", { count: hours }),
      })}
    >
      <HStack space="sm" className="items-baseline">
        <Text bold size={compact ? "5xl" : "6xl"} style={TICKING_DIGITS}>
          {days}
        </Text>
        <Text size="lg" className="text-muted-foreground">
          {t("streaks.daysUnit", { count: days })}
        </Text>
        {compact && (
          <Text
            className="ml-auto text-muted-foreground"
            style={TICKING_DIGITS}
          >
            {twoDigits(hours)}:{twoDigits(minutes)}:{twoDigits(seconds)}
          </Text>
        )}
      </HStack>
      {!compact && (
        <HStack space="sm">
          <TimeBox value={hours} label={t("streaks.hoursShort")} />
          <TimeBox value={minutes} label={t("streaks.minutesShort")} />
          <TimeBox value={seconds} label={t("streaks.secondsShort")} />
        </HStack>
      )}
    </View>
  );
}

function ProgressToNext({
  fullDays,
  tiers,
  compact,
}: {
  fullDays: number;
  tiers: StreakGoalTier[];
  compact: boolean;
}) {
  const { t } = useTranslation();
  const { next, ratio } = tierProgress(fullDays, tiers);
  const barColor = TIER_COLORS[(next ?? tiers[tiers.length - 1]).tier];
  const percent = Math.round(ratio * 100);

  let label = t("streaks.allTiers");
  let side: string | null = null;
  if (next) {
    const tier = t(`badges.tiers.${next.tier}`);
    label = compact
      ? t("streaks.nextTierDays", {
          tier,
          days: t("streaks.daysCount", { count: next.threshold }),
        })
      : t("streaks.nextTier", { tier });
    side = compact
      ? `${percent}%`
      : t("streaks.daysLeft", { count: next.threshold - fullDays });
  }

  return (
    <VStack space="xs">
      <HStack space="sm" className="items-center justify-between">
        <Text size="sm" className="shrink">
          {label}
        </Text>
        {side && (
          <Text size="sm" className="text-muted-foreground">
            {side}
          </Text>
        )}
      </HStack>
      <Progress value={percent}>
        <ProgressFilledTrack style={{ backgroundColor: barColor }} />
      </Progress>
    </VStack>
  );
}

function CompactTiers({
  tiers,
  fullDays,
}: {
  tiers: StreakGoalTier[];
  fullDays: number;
}) {
  const { t } = useTranslation();
  const { reached } = tierProgress(fullDays, tiers);

  return (
    <HStack space="xs" className="items-center">
      {tiers.map((tier) => (
        <TierMark
          key={tier.tier}
          tier={tier}
          reached={fullDays >= tier.threshold}
          size={MARK_SIZE.compact}
        />
      ))}
      <Text size="xs" className="ml-1 text-muted-foreground">
        {t("streaks.tiersReached", { count: reached, total: tiers.length })}
      </Text>
    </HStack>
  );
}

type ActionsProps = {
  onRelapse: () => void;
  onDelete: () => void;
  compact?: boolean;
};

export function StreakGoalActions({
  onRelapse,
  onDelete,
  compact = false,
}: ActionsProps) {
  const { t } = useTranslation();
  const Row = compact ? HStack : VStack;

  return (
    <Row space="sm" className={compact ? "items-center" : ""}>
      <Button
        variant="outline"
        className={compact ? "flex-1 min-h-11" : "min-h-11"}
        onPress={onRelapse}
      >
        <ButtonText>{t("streaks.relapse")}</ButtonText>
      </Button>
      <Button variant="ghost" className="min-h-11" onPress={onDelete}>
        <ButtonText className="text-destructive">
          {t(compact ? "streaks.delete" : "streaks.deleteGoal")}
        </ButtonText>
      </Button>
    </Row>
  );
}

type CardProps = {
  goal: StreakGoal;
  nowMs: number;
  rules: StreakGoalRules;
  // The denser form for the grid of a wide screen.
  compact?: boolean;
  children?: ReactNode;
};

export function StreakGoalCard({
  goal,
  nowMs,
  rules,
  compact = false,
  children,
}: CardProps) {
  const { t } = useTranslation();
  const parts = elapsedParts(goal.startedAt, nowMs);
  const { days } = parts;

  return (
    <Card className="flex-1">
      <VStack space="xs">
        {!compact && (
          <Text size="xs" className="uppercase text-muted-foreground">
            {t("streaks.timeWithout")}
          </Text>
        )}
        <Heading size={compact ? "lg" : "xl"}>{goal.name}</Heading>
      </VStack>

      <DayCounter parts={parts} compact={compact} />

      {compact ? (
        <>
          <ProgressToNext fullDays={days} tiers={rules.tiers} compact />
          <CompactTiers fullDays={days} tiers={rules.tiers} />
        </>
      ) : (
        <>
          <TierRow fullDays={days} tiers={rules.tiers} />
          <ProgressToNext fullDays={days} tiers={rules.tiers} compact={false} />
          <Text size="sm" className="text-muted-foreground">
            {t("streaks.dayXp", { xp: rules.dayXp })}
          </Text>
        </>
      )}

      {children}
    </Card>
  );
}
