import { useEffect, useState } from "react";
import { Pressable, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInUp,
  FadeOutUp,
  LinearTransition,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { TabTrigger } from "expo-router/ui";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { useAppColorScheme } from "@/context/ColorSchemeContext";
import { setLanguage } from "@/lib/languageStorage";
import { type SupportedLanguage } from "@/i18n";
import { NavItem } from "@/components/nav-item";
import { HStack } from "@/components/ui/hstack";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

// From this width up the links fit next to the title; below it they go
// into the burger menu (Tailwind's `md` breakpoint).
const WIDE_SCREEN = 768;
const MENU_ANIMATION_MS = 180;

function NavLinks() {
  const { t } = useTranslation();

  return (
    <>
      <TabTrigger name="index" asChild>
        <NavItem label={t("nav.home")} icon="home-outline" />
      </TabTrigger>
      <TabTrigger name="achievements" asChild>
        <NavItem label={t("nav.achievements")} icon="trophy-outline" />
      </TabTrigger>
    </>
  );
}

function Settings() {
  const { logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useAppColorScheme();
  const { t, i18n } = useTranslation();

  function toggleLanguage() {
    const next: SupportedLanguage = i18n.language === "pl" ? "en" : "pl";
    i18n.changeLanguage(next);
    setLanguage(next);
  }

  return (
    <HStack space="md" className="items-center">
      <Pressable onPress={toggleLanguage} hitSlop={8}>
        <Text className="text-muted-foreground">
          {i18n.language === "pl" ? "PL" : "EN"}
        </Text>
      </Pressable>
      <Pressable onPress={toggleColorScheme} hitSlop={8}>
        <MaterialCommunityIcons
          name={colorScheme === "dark" ? "weather-sunny" : "weather-night"}
          size={20}
          color="#999"
        />
      </Pressable>
      <Pressable onPress={logout}>
        <Text className="text-blue-500">{t("common.logout")}</Text>
      </Pressable>
    </HStack>
  );
}

function LevelBar() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const progress = user?.levelProgress;
  if (!progress) return null;

  // Derived on every render from the server's numbers; no state of its own.
  const percent =
    progress.xpForNextLevel === null
      ? 100
      : (progress.xpIntoLevel / progress.xpForNextLevel) * 100;

  return (
    <VStack space="xs" className="mt-2">
      <HStack className="items-center justify-between">
        <Text size="sm" bold>
          {t("xp.level", { level: progress.level })}
        </Text>
        <Text size="sm" className="text-muted-foreground">
          {progress.xpForNextLevel === null
            ? t("xp.maxLevel")
            : t("xp.progress", {
                current: progress.xpIntoLevel,
                total: progress.xpForNextLevel,
              })}
        </Text>
      </HStack>
      <Progress value={percent}>
        <ProgressFilledTrack />
      </Progress>
    </VStack>
  );
}

export function TopBar() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const isWide = width >= WIDE_SCREEN;

  // Picking a page closes the menu, and so does growing the window wide.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, isWide]);

  return (
    // shrink-0: on web this is a flex item, and a long page below would
    // otherwise squeeze it until its rows overlap.
    <VStack
      className="shrink-0 bg-background border-b border-border px-4 pb-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <HStack className="items-center justify-between">
        <HStack space="md" className="items-center">
          {!isWide && (
            <Pressable
              onPress={() => setMenuOpen((open) => !open)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("nav.menu")}
              accessibilityState={{ expanded: menuOpen }}
            >
              <MaterialCommunityIcons
                name={menuOpen ? "close" : "menu"}
                size={24}
                color="#999"
              />
            </Pressable>
          )}
          <Text size="lg" bold>
            PandaQuest
          </Text>
          {isWide && (
            <HStack space="xs" className="items-center ml-4">
              <NavLinks />
            </HStack>
          )}
        </HStack>

        <HStack space="md" className="items-center">
          <Text className="text-muted-foreground">{user?.username}</Text>
          {isWide && <Settings />}
        </HStack>
      </HStack>

      {!isWide && menuOpen && (
        // Slides down a little while fading in; the level bar below moves
        // with it instead of jumping. Both follow the system "reduce motion"
        // setting.
        <Animated.View
          entering={FadeInUp.duration(MENU_ANIMATION_MS)}
          exiting={FadeOutUp.duration(MENU_ANIMATION_MS)}
        >
          <VStack space="sm" className="mt-3 border-t border-border pt-3">
            <NavLinks />
            <HStack className="mt-1 px-3">
              <Settings />
            </HStack>
          </VStack>
        </Animated.View>
      )}

      <Animated.View layout={LinearTransition.duration(MENU_ANIMATION_MS)}>
        <LevelBar />
      </Animated.View>
    </VStack>
  );
}
