import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { TIER_COLORS } from "@/constants/badge-tiers";
import {
  achievementProgress,
  describedThreshold,
  highestEarnedTier,
  nextTier,
} from "@/lib/achievements";
import type { Achievement, AchievementTier } from "@/types/api";

const UNEARNED_COLOR = "#9ca3af";

// One chip per tier: colored once earned, muted until then.
function TierChip({ tier }: { tier: AchievementTier }) {
  const { t } = useTranslation();
  const earned = tier.earnedAt !== null;
  const color = TIER_COLORS[tier.tier];

  return (
    <HStack
      space="xs"
      className="items-center rounded-full border px-2 py-0.5"
      style={{
        borderColor: earned ? color : "transparent",
        // 20% of the medal color behind an earned tier.
        backgroundColor: earned ? `${color}33` : undefined,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: earned ? color : UNEARNED_COLOR,
          opacity: earned ? 1 : 0.5,
        }}
      />
      <Text
        size="xs"
        bold={earned}
        className={earned ? "" : "text-muted-foreground"}
      >
        {t(`badges.tiers.${tier.tier}`)} · {tier.threshold}
      </Text>
    </HStack>
  );
}

function ProgressRow({ achievement }: { achievement: Achievement }) {
  const { t } = useTranslation();
  const progress = achievementProgress(achievement);
  const next = nextTier(achievement);

  if (progress.kind === "maxed") {
    const top = highestEarnedTier(achievement);
    return (
      <Text
        bold
        style={{ color: top ? TIER_COLORS[top.tier] : UNEARNED_COLOR }}
      >
        {t("achievements.max")}
      </Text>
    );
  }

  const nextLabel = next
    ? t("achievements.next", {
        tier: t(`badges.tiers.${next.tier}`),
        xp: next.xp,
      })
    : null;

  if (progress.kind === "notYet") {
    return (
      <HStack className="items-center justify-between">
        <Text size="sm" className="text-muted-foreground">
          {t("achievements.notYet")}
        </Text>
        <Text size="sm" className="text-muted-foreground">
          {nextLabel}
        </Text>
      </HStack>
    );
  }

  return (
    <VStack space="xs">
      <HStack className="items-center justify-between">
        <Text size="sm" bold>
          {t("achievements.progress", {
            current: progress.current,
            target: progress.target,
          })}
        </Text>
        <Text size="sm" className="text-muted-foreground">
          {nextLabel}
        </Text>
      </HStack>
      <Progress value={progress.ratio * 100}>
        <ProgressFilledTrack />
      </Progress>
    </VStack>
  );
}

export function BadgeCard({ achievement }: { achievement: Achievement }) {
  const { t, i18n } = useTranslation();
  const { key } = achievement;
  const highest = highestEarnedTier(achievement);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
      new Date(iso),
    );

  return (
    <Card size="sm" className="flex-1">
      <HStack space="md" className="items-start">
        <MaterialCommunityIcons
          name={highest ? "trophy" : "trophy-outline"}
          size={40}
          color={highest ? TIER_COLORS[highest.tier] : UNEARNED_COLOR}
        />
        <VStack space="xs" className="flex-1">
          <Heading size="sm">
            {t(`badges.names.${key}`, { defaultValue: key })}
          </Heading>
          <Text size="sm" className="text-muted-foreground">
            {t(`badges.descriptions.${key}`, {
              count: describedThreshold(achievement),
              defaultValue: "",
            })}
          </Text>
        </VStack>
      </HStack>

      <HStack space="xs" className="flex-wrap">
        {achievement.tiers.map((tier) => (
          <TierChip key={tier.tier} tier={tier} />
        ))}
      </HStack>

      <ProgressRow achievement={achievement} />

      {highest?.earnedAt && (
        <Text size="xs" className="text-muted-foreground">
          {t("achievements.earnedOn", {
            tier: t(`badges.tiers.${highest.tier}`),
            date: formatDate(highest.earnedAt),
          })}
        </Text>
      )}
    </Card>
  );
}
