import { Modal, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export type ConfirmRequest = {
  title: string;
  message: string;
  // A second paragraph, e.g. what stays after the action.
  note?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
};

type Props = {
  // What to ask; null while nothing is being asked.
  request: ConfirmRequest | null;
  onClose: () => void;
};

// Asks before an action that cannot be taken back. Built like RewardModal, so
// both look the same on every platform, in the app's theme and language.
export function ConfirmDialog({ request, onClose }: Props) {
  const { t } = useTranslation();

  function confirm() {
    // Closed first: a reward window may follow, and two at once do not stack.
    onClose();
    request?.onConfirm();
  }

  return (
    <Modal
      visible={request !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        {request && (
          <Card className="p-6" style={{ width: "100%", maxWidth: 400 }}>
            <VStack space="md">
              <Heading size="lg">{request.title}</Heading>
              <Text>{request.message}</Text>
              {request.note && (
                <Text className="text-muted-foreground">{request.note}</Text>
              )}
              <VStack space="sm" className="mt-2">
                <Button
                  variant={request.destructive ? "destructive" : "default"}
                  className="min-h-11"
                  onPress={confirm}
                >
                  <ButtonText>{request.confirmLabel}</ButtonText>
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onPress={onClose}
                >
                  <ButtonText>{t("common.cancel")}</ButtonText>
                </Button>
              </VStack>
            </VStack>
          </Card>
        )}
      </View>
    </Modal>
  );
}
