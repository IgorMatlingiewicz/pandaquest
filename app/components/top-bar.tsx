import { useEffect, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
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
import { useFriendsSummary } from "@/context/FriendsSummaryContext";
import { NAV_INLINE, TOP_BAR_NAME_MAX_WIDTH } from "@/constants/layout";
import { useLanguage } from "@/hooks/use-language";
import { LevelBar } from "@/components/level-bar";
import { NavItem } from "@/components/nav-item";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

const MENU_ANIMATION_MS = 180;

// The profile shows the level bar in its own card, so the top bar leaves it
// out there.
const PAGES_WITHOUT_LEVEL_BAR = ["/profile"];

function NavLinks() {
  const { t } = useTranslation();
  const { pendingIncoming } = useFriendsSummary();

  return (
    <>
      <TabTrigger name="index" asChild>
        <NavItem label={t("nav.tasks")} icon="home-outline" />
      </TabTrigger>
      <TabTrigger name="streaks" asChild>
        <NavItem label={t("nav.streaks")} icon="timer-outline" />
      </TabTrigger>
      <TabTrigger name="progress" asChild>
        <NavItem label={t("nav.progress")} icon="chart-box-outline" />
      </TabTrigger>
      <TabTrigger name="profile" asChild>
        <NavItem label={t("nav.profile")} icon="account-outline" />
      </TabTrigger>
      {/* reset: pressed from a friend's profile, it goes back to the list. */}
      <TabTrigger name="friends" reset="always" asChild>
        <NavItem
          label={t("nav.friends")}
          icon="account-multiple-outline"
          badge={pendingIncoming}
          badgeLabel={t("nav.friendsWithRequests", { count: pendingIncoming })}
        />
      </TabTrigger>
    </>
  );
}

function Settings() {
  const { logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useAppColorScheme();
  const { t } = useTranslation();
  const { language, changeLanguage } = useLanguage();

  return (
    <HStack space="md" className="items-center">
      <Pressable
        onPress={() => changeLanguage(language === "pl" ? "en" : "pl")}
        hitSlop={8}
      >
        <Text className="text-muted-foreground">
          {language === "pl" ? "PL" : "EN"}
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

export function TopBar() {
  const insets = useSafeAreaInsets();
  // Links in the bar only from NAV_INLINE: at the cards' "wide" width they
  // did not fit next to the user's name and the settings.
  const inline = useWindowDimensions().width >= NAV_INLINE;
  const { user } = useAuth();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { pendingIncoming } = useFriendsSummary();
  // With the menu closed, the count on the friends link cannot be seen, so
  // the menu button carries a dot for it.
  const menuDot = !menuOpen && pendingIncoming > 0;
  const levelProgress = PAGES_WITHOUT_LEVEL_BAR.includes(pathname)
    ? null
    : user?.levelProgress;

  // Picking a page closes the menu, and so does growing the window wide.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, inline]);

  return (
    // shrink-0: on web this is a flex item, and a long page below would
    // otherwise squeeze it until its rows overlap.
    <VStack
      className="shrink-0 bg-background border-b border-border px-4 pb-3"
      style={{ paddingTop: insets.top + 12 }}
    >
      <HStack className="items-center justify-between">
        <HStack space="md" className="items-center">
          {!inline && (
            <Pressable
              onPress={() => setMenuOpen((open) => !open)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={
                menuDot
                  ? t("nav.menuWithRequests", { count: pendingIncoming })
                  : t("nav.menu")
              }
              accessibilityState={{ expanded: menuOpen }}
            >
              <MaterialCommunityIcons
                name={menuOpen ? "close" : "menu"}
                size={24}
                color="#999"
              />
              {menuDot && (
                <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
              )}
            </Pressable>
          )}
          <Text size="lg" bold>
            PandaQuest
          </Text>
          {inline && (
            <HStack space="xs" className="items-center ml-4">
              <NavLinks />
            </HStack>
          )}
        </HStack>

        <HStack space="md" className="items-center">
          <Text
            className="text-muted-foreground"
            isTruncated
            style={{ maxWidth: TOP_BAR_NAME_MAX_WIDTH }}
          >
            {user?.username}
          </Text>
          {inline && <Settings />}
        </HStack>
      </HStack>

      {!inline && menuOpen && (
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

      {levelProgress && (
        <Animated.View layout={LinearTransition.duration(MENU_ANIMATION_MS)}>
          <LevelBar progress={levelProgress} className="mt-2" />
        </Animated.View>
      )}
    </VStack>
  );
}
