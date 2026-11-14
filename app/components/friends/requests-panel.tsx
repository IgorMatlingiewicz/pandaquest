import type { ReactNode } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { useIsWide } from "@/hooks/use-is-wide";
import { useMessageToast } from "@/hooks/use-message-toast";
import type { RequestAction } from "@/hooks/use-friends";
import type { FriendFailure } from "@/lib/api-errors";
import { resendValues } from "@/lib/friends";
import type { FriendRequest, FriendRequestsResponse } from "@/types/api";

type Props = {
  requests: FriendRequestsResponse;
  // The request being answered; while one is, no other can be.
  busyRequestId: string | null;
  onAct: (id: string, action: RequestAction) => Promise<FriendFailure | null>;
};

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string | null;
  children: ReactNode;
}) {
  const isWide = useIsWide();
  // Two columns share the row on a wide screen. In one column, flex-1 would
  // let the web squeeze the card's height inside the scroll view.
  return (
    <Card className={isWide ? "flex-1" : "w-full"}>
      <Heading size="md">{title}</Heading>
      {empty ? (
        <Text className="text-muted-foreground">{empty}</Text>
      ) : (
        children
      )}
    </Card>
  );
}

function Who({ request }: { request: FriendRequest }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1">
      <Text bold isTruncated>
        {request.user.username}
      </Text>
      <Text size="sm" className="text-muted-foreground">
        {t("friends.level", { level: request.user.level })}
      </Text>
    </View>
  );
}

/*
 * Requests the user received (accept or decline) and sent (take back while
 * waiting). A declined one stays among the sent ones while its sender has
 * to wait, saying until when. Side by side on a wide screen.
 */
export function RequestsPanel({ requests, busyRequestId, onAct }: Props) {
  const { t, i18n } = useTranslation();
  const isWide = useIsWide();
  const showMessage = useMessageToast();
  const busy = busyRequestId !== null;

  async function act(request: FriendRequest, action: RequestAction) {
    const failure = await onAct(request.id, action);
    if (failure) showMessage(t(failure.key, failure.values), "error");
    else if (action === "accept") {
      showMessage(
        t("friends.requests.accepted", { name: request.user.username }),
      );
    }
  }

  const row = "flex-row flex-wrap items-center gap-2 py-2";
  const divider = (index: number) =>
    index > 0 ? "border-t border-border" : "";

  return (
    <View
      className="w-full max-w-4xl mx-auto gap-4"
      // Side by side, each card as tall as its own content; in one column,
      // each card the full width.
      style={{
        flexDirection: isWide ? "row" : "column",
        alignItems: isWide ? "flex-start" : "stretch",
      }}
    >
      <Section
        title={t("friends.requests.incoming")}
        empty={
          requests.incoming.length === 0
            ? t("friends.requests.incomingEmpty")
            : null
        }
      >
        {requests.incoming.map((request, index) => {
          const name = request.user.username;
          return (
            <View key={request.id} className={`${row} ${divider(index)}`}>
              <Who request={request} />
              <View className="flex-row gap-2">
                <Button
                  size="sm"
                  className="min-h-11"
                  onPress={() => act(request, "accept")}
                  isDisabled={busy}
                  aria-label={t("friends.requests.acceptFrom", { name })}
                >
                  <ButtonText>{t("friends.requests.accept")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onPress={() => act(request, "decline")}
                  isDisabled={busy}
                  aria-label={t("friends.requests.declineFrom", { name })}
                >
                  <ButtonText>{t("friends.requests.decline")}</ButtonText>
                </Button>
              </View>
            </View>
          );
        })}
      </Section>

      <Section
        title={t("friends.requests.outgoing")}
        empty={
          requests.outgoing.length === 0
            ? t("friends.requests.outgoingEmpty")
            : null
        }
      >
        {requests.outgoing.map((request, index) => (
          <View key={request.id} className={`${row} ${divider(index)}`}>
            <Who request={request} />
            {request.status === "PENDING" ? (
              <View className="flex-row items-center gap-2">
                <Text size="sm" className="text-muted-foreground">
                  {t("friends.requests.waiting")}
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onPress={() => act(request, "cancel")}
                  isDisabled={busy}
                  aria-label={t("friends.requests.cancelTo", {
                    name: request.user.username,
                  })}
                >
                  <ButtonText>{t("friends.requests.cancel")}</ButtonText>
                </Button>
              </View>
            ) : (
              request.resendAvailableAt && (
                <Text size="sm" className="w-full text-muted-foreground">
                  {t(
                    "friends.requests.declinedUntil",
                    resendValues(
                      request.resendAvailableAt,
                      Date.now(),
                      i18n.language,
                    ),
                  )}
                </Text>
              )
            )}
          </View>
        ))}
      </Section>
    </View>
  );
}
