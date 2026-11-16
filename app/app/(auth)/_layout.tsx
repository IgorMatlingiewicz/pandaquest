import { View } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LanguageToggle } from "@/components/language-toggle";

export default function AuthLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>
      {/* Over both screens, in the top right corner as in the top bar: the
          language can be picked before an account exists, and the choice
          is saved, so the tutorial after signing up starts in it. */}
      <View className="absolute right-4" style={{ top: insets.top + 8 }}>
        <LanguageToggle />
      </View>
    </View>
  );
}
