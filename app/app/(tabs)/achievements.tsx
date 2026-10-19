import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

// Filled in with the badge list in a later stage.
export default function AchievementsScreen() {
  const { t } = useTranslation();

  return (
    <VStack className="flex-1 items-center justify-center bg-background">
      <Text>{t("nav.achievements")}</Text>
    </VStack>
  );
}
