import "@/i18n";

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DraxProvider } from "react-native-drax";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import {
  ColorSchemeProvider,
  useAppColorScheme,
} from "@/context/ColorSchemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { TopBar } from "@/components/top-bar";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Protected guard={!!token}>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: true, header: () => <TopBar /> }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!token}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

function AppShell() {
  const { colorScheme } = useAppColorScheme();

  return (
    <GluestackUIProvider mode={colorScheme}>
      <NavigationThemeProvider
        value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
      >
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
        <StatusBar style="auto" />
      </NavigationThemeProvider>
    </GluestackUIProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DraxProvider>
        <SafeAreaProvider>
          <ColorSchemeProvider>
            <AppShell />
          </ColorSchemeProvider>
        </SafeAreaProvider>
      </DraxProvider>
    </GestureHandlerRootView>
  );
}
