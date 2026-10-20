import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { BadgeCard } from "@/components/badges/badge-card";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { API_URL } from "@/constants/api";
import { WIDE_SCREEN } from "@/constants/layout";
import type { Achievement } from "@/types/api";

export default function AchievementsScreen() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/achievements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setAchievements(await response.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);

  // Read again on every visit: tasks completed on the home page in the
  // meantime may have moved streaks and earned badges.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!achievements) {
    return (
      <VStack
        space="md"
        className="flex-1 items-center justify-center bg-background"
      >
        <Text>
          {failed ? t("achievements.loadError") : t("common.loading")}
        </Text>
        {failed && (
          <Button variant="outline" onPress={load}>
            <ButtonText>{t("achievements.retry")}</ButtonText>
          </Button>
        )}
      </VStack>
    );
  }

  const tiers = achievements.flatMap((a) => a.tiers);
  const earned = tiers.filter((tier) => tier.earnedAt !== null).length;
  const isWide = width >= WIDE_SCREEN;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <VStack className="w-full max-w-4xl mx-auto">
        <Text size="lg" className="mb-2">
          {t("achievements.summary", { earned, total: tiers.length })}
        </Text>

        <View className="flex-row flex-wrap -mx-2">
          {achievements.map((achievement) => (
            <View
              key={achievement.key}
              className="p-2"
              style={{ width: isWide ? "50%" : "100%" }}
            >
              <BadgeCard achievement={achievement} />
            </View>
          ))}
        </View>
      </VStack>
    </ScrollView>
  );
}
