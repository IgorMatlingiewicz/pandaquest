import { useState } from "react";
import { RefreshControl, ScrollView } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { BadgePickerSheet } from "@/components/profile/badge-picker-sheet";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { SettingsSection } from "@/components/profile/settings-section";
import { Showcase } from "@/components/profile/showcase";
import { SlotMenuSheet } from "@/components/profile/slot-menu-sheet";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useProfile } from "@/hooks/use-profile";
import { alertMessage } from "@/lib/alert";
import { pickerOptions, showcaseView, type ShowcaseSlot } from "@/lib/profile";
import type { EarnedBadge, FavoritePick } from "@/types/api";

type TakenSlot = Extract<ShowcaseSlot, { kind: "badge" }>;

/*
 * Who the user is, their showcase and their settings, in one column. The data
 * comes from useProfile; this screen only decides which sheet is open.
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const { state, savingSlot, refresh, retry, saveSlot } = useProfile();
  // The slot the picker fills; null while the picker is closed.
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  // The taken slot whose menu is open.
  const [menuSlot, setMenuSlot] = useState<TakenSlot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
            <ButtonText>{t("profile.retry")}</ButtonText>
          </Button>
        )}
      </VStack>
    );
  }

  const { profile, earned } = state;

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function save(slot: number, pick: FavoritePick | null) {
    const failure = await saveSlot(slot, pick);
    if (failure) alertMessage(t("profile.showcase.saveError"), t(failure));
  }

  function pressSlot(slot: ShowcaseSlot) {
    if (slot.kind === "empty") setPickerSlot(slot.slot);
    else setMenuSlot(slot);
  }

  // Each sheet closes before the save starts: the slot shows it is saving.
  function pick(badge: EarnedBadge) {
    if (pickerSlot === null) return;
    setPickerSlot(null);
    save(pickerSlot, badge);
  }

  function changeSlot() {
    if (!menuSlot) return;
    setMenuSlot(null);
    setPickerSlot(menuSlot.slot);
  }

  function removeSlot() {
    if (!menuSlot) return;
    setMenuSlot(null);
    save(menuSlot.slot, null);
  }

  function showAllBadges() {
    router.navigate({ pathname: "/progress", params: { tab: "achievements" } });
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
          <ProfileSummary profile={profile} onShowAllBadges={showAllBadges} />

          <Card>
            <VStack space="xs">
              <Heading size="md">{t("profile.showcase.title")}</Heading>
              <Text className="text-muted-foreground">
                {t("profile.showcase.hint")}
              </Text>
            </VStack>
            <Showcase
              slots={showcaseView(profile.favorites)}
              savingSlot={savingSlot}
              onPressSlot={pressSlot}
            />
          </Card>

          <SettingsSection />
        </VStack>
      </ScrollView>

      <BadgePickerSheet
        isOpen={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        options={pickerOptions(earned, profile.favorites)}
        hasEarned={earned.length > 0}
        onPick={pick}
      />
      <SlotMenuSheet
        badge={menuSlot}
        onClose={() => setMenuSlot(null)}
        onChange={changeSlot}
        onRemove={removeSlot}
      />
    </>
  );
}
