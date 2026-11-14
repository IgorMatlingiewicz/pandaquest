import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { TabTriggerSlotProps } from "expo-router/ui";
import { Text } from "@/components/ui/text";
import { badgeText } from "@/lib/friends";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type NavItemProps = TabTriggerSlotProps & {
  label: string;
  icon: IconName;
  // A count to show next to the label, e.g. requests waiting; hidden at 0.
  badge?: number;
  // What a screen reader says instead of the label while there is a count.
  badgeLabel?: string;
};

// One page link of the top navigation. Rendered through
// <TabTrigger asChild>, which passes onPress and isFocused.
export function NavItem({
  label,
  icon,
  badge = 0,
  badgeLabel,
  isFocused,
  ...props
}: NavItemProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      aria-label={badge > 0 ? badgeLabel : undefined}
      className={`flex-row items-center gap-2 rounded-lg px-3 py-2 ${
        isFocused ? "bg-muted" : ""
      }`}
    >
      {/* The count sits on the icon's corner, so the label keeps its place:
          in the burger menu the labels stay in line with each other. Some
          room to its right, so a wide count ("99+") stays off the label. */}
      <View style={{ marginRight: badge > 0 ? 8 : 0 }}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={isFocused ? "#3b82f6" : "#999"}
        />
        {badge > 0 && (
          // blue-600, not the app's blue-500: white text on it passes WCAG AA
          // (5.2:1) at this small size, where blue-500 (3.7:1) does not.
          <View
            className="absolute items-center justify-center rounded-full bg-blue-600 px-1"
            style={{ top: -7, left: 12, minWidth: 18, height: 18 }}
          >
            <Text size="2xs" bold className="text-white">
              {badgeText(badge)}
            </Text>
          </View>
        )}
      </View>
      <Text
        bold={isFocused}
        className={isFocused ? "" : "text-muted-foreground"}
      >
        {label}
      </Text>
    </Pressable>
  );
}
