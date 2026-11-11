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
} from "@/components/ui/actionsheet";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { EarnedBadge } from "@/types/api";

const MUTED_ICON = "#999";

type Props = {
  // The badge in the pressed slot; null while the menu is closed.
  badge: EarnedBadge | null;
  onClose: () => void;
  onChange: () => void;
  onRemove: () => void;
};

// What can be done with a taken slot: pick another badge or empty it.
export function SlotMenuSheet({ badge, onClose, onChange, onRemove }: Props) {
  const { t } = useTranslation();
  const change = t("profile.slotMenu.change");
  const remove = t("profile.slotMenu.remove");

  return (
    <Actionsheet isOpen={badge !== null} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="p-4">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="sm" className="mt-2 w-full">
          {badge && (
            <Heading size="md">
              {badgeName(t, badge.badgeKey)} · {tierName(t, badge.tier)}
            </Heading>
          )}
          <ActionsheetItem
            onPress={onChange}
            accessibilityRole="button"
            accessibilityLabel={change}
            className="min-h-11 items-center gap-3"
          >
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={22}
              color={MUTED_ICON}
            />
            <Text>{change}</Text>
          </ActionsheetItem>
          <ActionsheetItem
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={remove}
            className="min-h-11 items-center gap-3"
          >
            <MaterialCommunityIcons
              name="close-circle-outline"
              size={22}
              color={MUTED_ICON}
            />
            <Text className="text-destructive">{remove}</Text>
          </ActionsheetItem>
          <Button variant="outline" className="mt-2 min-h-11" onPress={onClose}>
            <ButtonText>{t("common.cancel")}</ButtonText>
          </Button>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
