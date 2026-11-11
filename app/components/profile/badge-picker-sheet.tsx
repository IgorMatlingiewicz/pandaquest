import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { badgeName, tierName } from "@/components/profile/badge-labels";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { TIER_COLORS } from "@/constants/badge-tiers";
import type { EarnedBadge } from "@/types/api";

const LIST_MAX_HEIGHT = 400;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  // Already filtered and sorted (pickerOptions).
  options: EarnedBadge[];
  // Whether the user earned anything: an empty list then means everything
  // earned is in the showcase already, not that nothing was earned.
  hasEarned: boolean;
  onPick: (badge: EarnedBadge) => void;
};

export function BadgePickerSheet({
  isOpen,
  onClose,
  options,
  hasEarned,
  onPick,
}: Props) {
  const { t, i18n } = useTranslation();
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
      new Date(iso),
    );

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-4">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="mt-2 w-full">
          <Heading size="md">{t("profile.picker.title")}</Heading>

          {options.length === 0 ? (
            <Text className="text-muted-foreground">
              {hasEarned
                ? t("profile.picker.allShown")
                : t("profile.picker.empty")}
            </Text>
          ) : (
            <ActionsheetScrollView style={{ maxHeight: LIST_MAX_HEIGHT }}>
              {options.map((badge) => {
                const name = badgeName(t, badge.badgeKey);
                const earnedOn = t("achievements.earnedOn", {
                  tier: tierName(t, badge.tier),
                  date: formatDate(badge.earnedAt),
                });
                return (
                  <ActionsheetItem
                    key={`${badge.badgeKey}|${badge.tier}`}
                    onPress={() => onPick(badge)}
                    accessibilityRole="button"
                    accessibilityLabel={`${name}, ${earnedOn}`}
                    className="min-h-11 items-center gap-3"
                  >
                    <MaterialCommunityIcons
                      name="trophy"
                      size={28}
                      color={TIER_COLORS[badge.tier]}
                    />
                    <VStack className="flex-1">
                      <Text bold>{name}</Text>
                      <Text size="xs" className="text-muted-foreground">
                        {earnedOn}
                      </Text>
                    </VStack>
                  </ActionsheetItem>
                );
              })}
            </ActionsheetScrollView>
          )}

          <Button variant="outline" className="min-h-11" onPress={onClose}>
            <ButtonText>{t("common.cancel")}</ButtonText>
          </Button>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
