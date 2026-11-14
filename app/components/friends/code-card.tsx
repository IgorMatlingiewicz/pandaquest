import { useState } from "react";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useTranslation } from "react-i18next";
import {
  ConfirmDialog,
  type ConfirmRequest,
} from "@/components/confirm-dialog";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useMessageToast } from "@/hooks/use-message-toast";
import type { FriendFailure } from "@/lib/api-errors";
import { formatFriendCode, spelledFriendCode } from "@/lib/friends";

type Props = {
  code: string;
  regenerating: boolean;
  // Resolves to null once the new code is on screen.
  onRegenerate: () => Promise<FriendFailure | null>;
};

/*
 * The user's own code, to read out or send to someone. A new code needs a
 * confirmation, as the old one stops working at once; friends stay.
 */
export function CodeCard({ code, regenerating, onRegenerate }: Props) {
  const { t } = useTranslation();
  const showMessage = useMessageToast();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  async function copy() {
    // Sent as shown, with the dash: the server takes it either way, and
    // someone reading the pasted text sees the two halves.
    let copied = false;
    try {
      copied = await Clipboard.setStringAsync(formatFriendCode(code));
    } catch {
      copied = false;
    }
    // On the web a browser may refuse; the promise then says false.
    showMessage(
      t(copied ? "friends.code.copied" : "friends.code.copyFailed"),
      copied ? "success" : "error",
    );
  }

  async function regenerate() {
    const failure = await onRegenerate();
    if (failure) showMessage(t(failure.key, failure.values), "error");
    else showMessage(t("friends.code.regenerated"));
  }

  function askToRegenerate() {
    setConfirm({
      title: t("friends.code.confirmTitle"),
      message: t("friends.code.confirmMessage"),
      note: t("friends.code.confirmNote"),
      confirmLabel: t("friends.code.regenerate"),
      onConfirm: regenerate,
    });
  }

  return (
    <Card>
      <VStack space="xs">
        <Heading size="md">{t("friends.code.title")}</Heading>
        <Text className="text-muted-foreground">{t("friends.code.hint")}</Text>
      </VStack>

      {/* One element for a screen reader, read letter by letter rather than
          as a word. An RN View: on the web, Text is a plain element that
          takes no accessibility props. */}
      <View
        accessible
        accessibilityLabel={t("friends.code.label", {
          spelled: spelledFriendCode(code),
        })}
        className="items-center rounded-xl border border-border bg-muted py-4"
      >
        <Text size="3xl" bold style={{ letterSpacing: 3 }}>
          {formatFriendCode(code)}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Button className="min-h-11 flex-1" onPress={copy}>
          <ButtonText>{t("friends.code.copy")}</ButtonText>
        </Button>
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          onPress={askToRegenerate}
          isDisabled={regenerating}
        >
          <ButtonText>
            {regenerating
              ? t("friends.code.regenerating")
              : t("friends.code.regenerate")}
          </ButtonText>
        </Button>
      </View>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </Card>
  );
}
