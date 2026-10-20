import { Modal, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { TIER_COLORS } from "@/constants/badge-tiers";
import type { Reward } from "@/lib/rewards";
import type { BadgeAward } from "@/types/api";

const LEVEL_UP_COLOR = "#eab308";

function BadgeContent({ badge }: { badge: BadgeAward }) {
  const { t } = useTranslation();
  const color = TIER_COLORS[badge.tier];

  return (
    <>
      <MaterialCommunityIcons name="trophy" size={64} color={color} />
      <Text className="mt-2 text-muted-foreground">
        {t("rewards.badgeTitle")}
      </Text>
      <Heading size="xl" className="text-center">
        {/* A badge the app has no translation for yet shows its key. */}
        {t(`badges.names.${badge.key}`, { defaultValue: badge.key })}
      </Heading>
      <Text bold style={{ color }}>
        {t(`badges.tiers.${badge.tier}`)}
      </Text>
      <Text size="lg" bold className="mt-3">
        {t("rewards.xp", { amount: badge.xp })}
      </Text>
    </>
  );
}

function LevelUpContent({ level }: { level: number }) {
  const { t } = useTranslation();

  return (
    <>
      <MaterialCommunityIcons
        name="star-circle"
        size={64}
        color={LEVEL_UP_COLOR}
      />
      <Text className="mt-2 text-muted-foreground">
        {t("rewards.levelUpTitle")}
      </Text>
      <Heading size="xl" className="text-center">
        {t("xp.level", { level })}
      </Heading>
    </>
  );
}

type Props = {
  // The reward on top of the queue; null while there is none to show.
  reward: (Reward & { id: number }) | null;
  onClose: () => void;
};

// A window the user has to close. The next reward in the queue pops in as
// soon as this one is closed.
export function RewardModal({ reward, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={reward !== null}
      transparent
      animationType="fade"
      // Android back button: closing the window is still the user's choice.
      onRequestClose={onClose}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        {reward && (
          // A new key per reward replays the entering animation.
          <Animated.View
            key={reward.id}
            entering={ZoomIn.duration(220)}
            style={{ width: "100%", maxWidth: 360 }}
          >
            <Card className="items-center p-6">
              {reward.kind === "badge" ? (
                <BadgeContent badge={reward.badge} />
              ) : (
                <LevelUpContent level={reward.level} />
              )}
              <Button className="mt-6 w-full" onPress={onClose}>
                <ButtonText>{t("rewards.close")}</ButtonText>
              </Button>
            </Card>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
