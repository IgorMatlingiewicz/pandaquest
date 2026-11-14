import { Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text } from "@/components/ui/text";

/**
 * Back to the friends list, whatever was on top of it: a friend's profile,
 * or their badges above that. With no stack to go back through (the page
 * opened from its address), the list replaces it.
 */
export function backToFriendsList() {
  if (router.canDismiss()) router.dismissAll();
  else router.replace("/friends");
}

type Props = {
  label: string;
  onPress: () => void;
};

// The way back at the top of a friend's screens: the app shows no headers.
export function BackLink({ label, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      // The label alone: on the web the icon is a font glyph, which would
      // otherwise become part of the link's name.
      aria-label={label}
      hitSlop={8}
      className="min-h-11 flex-row items-center gap-1 self-start"
    >
      <MaterialCommunityIcons name="chevron-left" size={24} color="#3b82f6" />
      <Text className="text-blue-500">{label}</Text>
    </Pressable>
  );
}
