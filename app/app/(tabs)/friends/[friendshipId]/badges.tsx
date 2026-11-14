import { useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { FriendBadgeCard } from "@/components/badges/friend-badge-card";
import { BackLink, backToFriendsList } from "@/components/friends/back-link";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useFriendBadges } from "@/hooks/use-friend-profile";
import { useIsWide } from "@/hooks/use-is-wide";
import { useMessageToast } from "@/hooks/use-message-toast";
import { earnedTierCount } from "@/lib/friends";

/*
 * Every badge a friend earned, laid out like the own Achievements tab (two
 * columns on a wide screen), earned tiers only. A friendship found gone
 * leads straight to the list, not through the profile, which would only
 * find the same and say so a second time.
 */
export default function FriendBadgesScreen() {
  const { t } = useTranslation();
  const isWide = useIsWide();
  const { friendshipId } = useLocalSearchParams<{ friendshipId: string }>();
  const { state, refresh, retry } = useFriendBadges(friendshipId);
  const showMessage = useMessageToast();
  const [refreshing, setRefreshing] = useState(false);
  const left = useRef(false);

  useEffect(() => {
    if (state.status !== "gone" || left.current) return;
    left.current = true;
    showMessage(t("friends.errors.FRIEND_NOT_FOUND"), "error");
    backToFriendsList();
  }, [state.status, showMessage, t]);

  function backToProfile() {
    if (router.canGoBack()) router.back();
    else {
      router.replace({
        pathname: "/friends/[friendshipId]",
        params: { friendshipId },
      });
    }
  }

  if (state.status !== "ready") {
    return (
      <VStack
        space="md"
        className="flex-1 items-center justify-center bg-background px-6"
      >
        <Text className="text-center">
          {state.status === "error" ? t(state.errorKey) : t("common.loading")}
        </Text>
        {state.status === "error" && (
          <Button variant="outline" onPress={retry}>
            <ButtonText>{t("friends.retry")}</ButtonText>
          </Button>
        )}
      </VStack>
    );
  }

  const badges = state.data;

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />
      }
    >
      <VStack className="w-full max-w-4xl mx-auto">
        <BackLink label={t("friends.badges.back")} onPress={backToProfile} />
        <Text size="lg" className="mb-2 mt-2">
          {t("friends.badges.title", { count: earnedTierCount(badges) })}
        </Text>

        {badges.length === 0 ? (
          <Text className="text-muted-foreground">
            {t("friends.badges.empty")}
          </Text>
        ) : (
          <View className="flex-row flex-wrap -mx-2">
            {badges.map((badge) => (
              <View
                key={badge.key}
                className="p-2"
                style={{ width: isWide ? "50%" : "100%" }}
              >
                <FriendBadgeCard badge={badge} />
              </View>
            ))}
          </View>
        )}
      </VStack>
    </ScrollView>
  );
}
