import { useTranslation } from "react-i18next";
import { LevelBar } from "@/components/level-bar";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { ProfileResponse } from "@/types/api";

type Props = {
  profile: ProfileResponse;
  onShowAllBadges: () => void;
};

// Who the user is. The level bar sits here, and the top bar leaves it out on
// this page, so it is shown once.
export function ProfileSummary({ profile, onShowAllBadges }: Props) {
  const { t, i18n } = useTranslation();
  const joined = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
  }).format(new Date(profile.joinedAt));

  return (
    <Card>
      <VStack space="xs">
        <Heading size="xl">{profile.username}</Heading>
        <LevelBar progress={profile.levelProgress} className="my-1" />
        <Text className="text-muted-foreground">
          {t("profile.joined", { date: joined })}
        </Text>
        <Text className="text-muted-foreground">
          {t("profile.badgeCount", {
            earned: profile.badges.earned,
            total: profile.badges.total,
          })}
        </Text>
      </VStack>
      <Button
        variant="outline"
        className="min-h-11 self-start"
        onPress={onShowAllBadges}
        accessibilityRole="link"
      >
        <ButtonText>{t("profile.showAllBadges")}</ButtonText>
      </Button>
    </Card>
  );
}
