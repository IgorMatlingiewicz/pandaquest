import type { ComponentProps } from "react";
import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { TabTriggerSlotProps } from "expo-router/ui";
import { Text } from "@/components/ui/text";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type NavItemProps = TabTriggerSlotProps & {
  label: string;
  icon: IconName;
};

// One page link of the top navigation. Rendered through
// <TabTrigger asChild>, which passes onPress and isFocused.
export function NavItem({ label, icon, isFocused, ...props }: NavItemProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      className={`flex-row items-center gap-2 rounded-lg px-3 py-2 ${
        isFocused ? "bg-muted" : ""
      }`}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={isFocused ? "#3b82f6" : "#999"}
      />
      <Text
        bold={isFocused}
        className={isFocused ? "" : "text-muted-foreground"}
      >
        {label}
      </Text>
    </Pressable>
  );
}
