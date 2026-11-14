import { useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ConfirmDialog,
  type ConfirmRequest,
} from "@/components/confirm-dialog";
import { BackLink, backToFriendsList } from "@/components/friends/back-link";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { Showcase } from "@/components/profile/showcase";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useFriendProfile } from "@/hooks/use-friend-profile";
import { useMessageToast } from "@/hooks/use-message-toast";
import { showcaseView } from "@/lib/profile";

/*
 * A friend's profile, addressed by the friendship's id: what friends may
 * see (name, level, join date, badge count, showcase) and ending the
 * friendship. Built from the own profile's parts, read-only. When the
 * friendship turns out to be gone (404), back to the list with a message.
 */
export default function FriendProfileScreen() {
  const { t } = useTranslation();
  const { friendshipId } = useLocalSearchParams<{ friendshipId: string }>();
  const { state, refresh, retry, remove, removing } =
    useFriendProfile(friendshipId);
  const showMessage = useMessageToast();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Leaving happens once, whichever reason comes first.
  const left = useRef(false);

  useEffect(() => {
    if (state.status !== "gone" || left.current) return;
    left.current = true;
    showMessage(t("friends.errors.FRIEND_NOT_FOUND"), "error");
    backToFriendsList();
  }, [state.status, showMessage, t]);

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

  const profile = state.data;

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function removeFriend() {
    const failure = await remove();
    if (failure) {
      showMessage(t(failure.key, failure.values), "error");
      return;
    }
    left.current = true;
    showMessage(t("friends.profile.removed", { name: profile.username }));
    backToFriendsList();
  }

  function askToRemove() {
    setConfirm({
      title: t("friends.profile.removeTitle", { name: profile.username }),
      message: t("friends.profile.removeMessage"),
      confirmLabel: t("friends.profile.remove"),
      destructive: true,
      onConfirm: removeFriend,
    });
  }

  function showBadges() {
    router.push({
      pathname: "/friends/[friendshipId]/badges",
      params: { friendshipId },
    });
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />
        }
      >
        <VStack space="lg" className="w-full max-w-4xl mx-auto">
          <BackLink
            label={t("friends.profile.back")}
            onPress={backToFriendsList}
          />

          <ProfileSummary profile={profile} onShowAllBadges={showBadges} />

          <Card>
            <Heading size="md">{t("profile.showcase.title")}</Heading>
            <Showcase slots={showcaseView(profile.favorites)} />
          </Card>

          <Button
            variant="outline"
            className="min-h-11"
            onPress={askToRemove}
            isDisabled={removing}
          >
            <ButtonText>
              {removing
                ? t("friends.profile.removing")
                : t("friends.profile.remove")}
            </ButtonText>
          </Button>
        </VStack>
      </ScrollView>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
