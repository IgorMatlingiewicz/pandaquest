import { useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ChoiceChip } from "@/components/choice-chip";
import { FriendsPanel } from "@/components/friends/friends-panel";
import { RequestsPanel } from "@/components/friends/requests-panel";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useFriends } from "@/hooks/use-friends";

type Tab = "friends" | "requests";

const TABS: Tab[] = ["friends", "requests"];

/*
 * Friends and requests, as tabs like those of the Progress screen: local
 * state, both panels mounted, the hidden one only not shown. One read feeds
 * both (useFriends), read again on every visit and after every action.
 */
export default function FriendsScreen() {
  const { t } = useTranslation();
  const friends = useFriends();
  const { state } = friends;
  const [tab, setTab] = useState<Tab>("friends");
  const [refreshing, setRefreshing] = useState(false);

  const incoming =
    state.status === "ready" ? state.data.requests.incoming.length : 0;

  async function pullToRefresh() {
    setRefreshing(true);
    await friends.refresh();
    setRefreshing(false);
  }

  // As on the Progress screen: minHeight 0 keeps the panel's ScrollView
  // within the page on the web.
  const panel = (shown: boolean) => ({
    flex: 1,
    minHeight: 0,
    display: shown ? ("flex" as const) : ("none" as const),
  });

  const scroll = (children: ReactNode) => (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} />
      }
    >
      {children}
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-background">
      <View
        role="tablist"
        className="w-full max-w-4xl mx-auto flex-row gap-2 px-4 pt-4"
      >
        {TABS.map((name) => (
          <ChoiceChip
            key={name}
            role="tab"
            label={
              name === "requests" && incoming > 0
                ? t("friends.tabs.requestsCount", { count: incoming })
                : t(`friends.tabs.${name}`)
            }
            selected={name === tab}
            onPress={() => setTab(name)}
          />
        ))}
      </View>

      {state.status !== "ready" ? (
        <VStack
          space="md"
          className="flex-1 items-center justify-center bg-background px-6"
        >
          <Text className="text-center">
            {state.status === "error" ? t(state.errorKey) : t("common.loading")}
          </Text>
          {state.status === "error" && (
            <Button variant="outline" onPress={friends.retry}>
              <ButtonText>{t("friends.retry")}</ButtonText>
            </Button>
          )}
        </VStack>
      ) : (
        <>
          <View style={panel(tab === "friends")}>
            {scroll(
              <FriendsPanel
                code={state.data.code}
                friends={state.data.friends}
                sending={friends.sending}
                regenerating={friends.regenerating}
                onSend={friends.sendRequest}
                onRegenerate={friends.regenerateCode}
              />,
            )}
          </View>
          <View style={panel(tab === "requests")}>
            {scroll(
              <RequestsPanel
                requests={state.data.requests}
                busyRequestId={friends.busyRequestId}
                onAct={friends.actOnRequest}
              />,
            )}
          </View>
        </>
      )}
    </View>
  );
}
