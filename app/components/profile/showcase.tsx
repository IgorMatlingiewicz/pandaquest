import { ActivityIndicator, Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { badgeName, tierName } from "@/components/profile/badge-labels";
import { Text } from "@/components/ui/text";
import { TIER_COLORS } from "@/constants/badge-tiers";
import type { ShowcaseSlot } from "@/lib/profile";

const MUTED_ICON = "#999";

type SlotProps = {
  slot: ShowcaseSlot;
  saving: boolean;
  disabled: boolean;
  onPress: () => void;
};

function ShowcaseSlotView({ slot, saving, disabled, onPress }: SlotProps) {
  const { t } = useTranslation();
  const number = slot.slot + 1;
  const badge = slot.kind === "badge" ? slot : null;
  const name = badge && badgeName(t, badge.badgeKey);
  const tier = badge && tierName(t, badge.tier);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        badge
          ? t("profile.showcase.badgeSlot", { number, name, tier })
          : t("profile.showcase.emptySlot", { number })
      }
      aria-busy={saving}
      aria-disabled={disabled}
      className={`min-h-32 flex-1 items-center justify-center gap-1 rounded-xl p-2 ${
        badge
          ? "border border-border bg-card"
          : "border-2 border-dashed border-border"
      } ${disabled && !saving ? "opacity-60" : ""}`}
    >
      {saving ? (
        <ActivityIndicator accessibilityLabel={t("profile.showcase.saving")} />
      ) : badge ? (
        <>
          <MaterialCommunityIcons
            name="trophy"
            size={40}
            color={TIER_COLORS[badge.tier]}
          />
          <Text size="sm" bold className="text-center">
            {name}
          </Text>
          {/* The tier is always written out: its color is not all of it. */}
          <Text size="xs" className="text-center text-muted-foreground">
            {tier}
          </Text>
        </>
      ) : (
        <MaterialCommunityIcons name="plus" size={32} color={MUTED_ICON} />
      )}
    </Pressable>
  );
}

type Props = {
  slots: ShowcaseSlot[];
  // The slot being saved; while one is, no slot can be pressed.
  savingSlot: number | null;
  onPressSlot: (slot: ShowcaseSlot) => void;
};

/*
 * The three showcase slots side by side. Only shows what it is given and
 * says what was pressed: no data of its own, so the same component can show
 * a friend's showcase later.
 */
export function Showcase({ slots, savingSlot, onPressSlot }: Props) {
  return (
    <View className="flex-row gap-3">
      {slots.map((slot) => (
        <ShowcaseSlotView
          key={slot.slot}
          slot={slot}
          saving={slot.slot === savingSlot}
          disabled={savingSlot !== null}
          onPress={() => onPressSlot(slot)}
        />
      ))}
    </View>
  );
}
