import { Modal, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTutorial } from "@/context/TutorialContext";

/*
 * "Enjoy the app!", after the tutorial was turned off or finished, on the
 * Tasks page. Built like ConfirmDialog, with one way out. Rewards earned
 * meanwhile (Bright Start) wait until it closes: the tutorial holds them
 * until closeFarewell.
 */
export function TutorialFarewell() {
  const { t } = useTranslation();
  const { state, closeFarewell } = useTutorial();
  const reduceMotion = useReducedMotion();

  return (
    <Modal
      visible={state.phase === "farewell"}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={closeFarewell}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <Card className="p-6" style={{ width: "100%", maxWidth: 400 }}>
          <VStack space="md">
            <Heading size="lg">{t("tutorial.farewell.title")}</Heading>
            <Text>{t("tutorial.farewell.message")}</Text>
            <Button className="mt-2 min-h-11" onPress={closeFarewell}>
              <ButtonText>{t("tutorial.farewell.action")}</ButtonText>
            </Button>
          </VStack>
        </Card>
      </View>
    </Modal>
  );
}
