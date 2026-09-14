import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

export function TopBar() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  return (
    <HStack
      className="items-center justify-between bg-background border-b border-border px-4 pb-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <Text size="lg" bold>
        PandaQuest
      </Text>

      <HStack space="md" className="items-center">
        <Text className="text-muted-foreground">{user?.username}</Text>
        <Pressable onPress={logout}>
          <Text className="text-blue-500">Wyloguj</Text>
        </Pressable>
      </HStack>
    </HStack>
  );
}
