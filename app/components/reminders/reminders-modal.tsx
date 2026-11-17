import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Modal,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useReminders } from "@/context/RemindersContext";
import type { ReminderItem } from "@/lib/reminders";

/** The words of one line: what is the matter, and the streak at risk. */
function useItemTexts(item: ReminderItem) {
  const { t } = useTranslation();
  switch (item.kind) {
    case "daily":
      return {
        message: t("reminders.daily", { count: item.remaining }),
        streak:
          item.streak !== null
            ? t("reminders.streakDays", { count: item.streak })
            : null,
        action: t("reminders.goToTasks"),
      };
    case "weekly":
      return {
        message: t("reminders.weekly"),
        streak:
          item.streak !== null
            ? t("reminders.streakWeeks", { count: item.streak })
            : null,
        action: t("reminders.goToTasks"),
      };
    case "friends":
      return {
        message: t("reminders.friends", { count: item.count }),
        streak: null,
        action: t("reminders.goToFriends"),
      };
  }
}

function ReminderRow({ item, onGo }: { item: ReminderItem; onGo: () => void }) {
  const { message, streak, action } = useItemTexts(item);

  return (
    <VStack space="sm" className="rounded-lg border border-border p-4">
      <Text>{message}</Text>
      {streak && <Text bold>{streak}</Text>}
      <Button variant="outline" className="min-h-11 self-start" onPress={onGo}>
        <ButtonText>{action}</ButtonText>
      </Button>
    </VStack>
  );
}

/*
 * The reminders, all in one window: daily, weekly, friend requests, each
 * with its own "Go to", and Close below. RemindersContext decides when it
 * opens (never over the tutorial or a reward) and confirms it on opening.
 *
 * A React Native Modal, as every window of the app: on the web it keeps
 * Tab inside, closes on Escape through onRequestClose and is a dialog to
 * screen readers (role="dialog", aria-modal); Android's back button goes
 * through onRequestClose too. The words say what is the matter; nothing
 * relies on an icon or a colour alone.
 */
export function RemindersModal() {
  const { t } = useTranslation();
  const { view, close, goTo } = useReminders();
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<View>(null);
  const open = view !== null;

  // The focus on the heading, so a screen reader starts with the title
  // instead of the first "Go to" button.
  useEffect(() => {
    if (!open || !headingRef.current) return;
    if (Platform.OS === "web") {
      (headingRef.current as unknown as HTMLElement).focus();
    } else {
      AccessibilityInfo.sendAccessibilityEvent(headingRef.current, "focus");
    }
  }, [open]);

  return (
    <Modal
      visible={open}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={close}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-4 py-6">
        {view && (
          <Card
            className="p-0"
            style={{ width: "100%", maxWidth: 440, maxHeight: "100%" }}
          >
            {/* Scrolls when three reminders do not fit a short screen. */}
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <VStack space="md">
                {/* First in the window, as in the tutorial: the focus trap
                    lands on it. Not a control (Tab skips it), hence no
                    visible ring; outline-none keeps a transparent one
                    that a high-contrast mode can still show. */}
                <View
                  ref={headingRef}
                  tabIndex={-1}
                  role="heading"
                  aria-level={2}
                  className="outline-none"
                >
                  <Text size="xl" bold>
                    {t("reminders.title")}
                  </Text>
                </View>

                {view.items.map((item) => (
                  <ReminderRow
                    key={item.kind}
                    item={item}
                    onGo={() => goTo(item.kind)}
                  />
                ))}

                <Button className="mt-2 min-h-11" onPress={close}>
                  <ButtonText>{t("reminders.close")}</ButtonText>
                </Button>
              </VStack>
            </ScrollView>
          </Card>
        )}
      </View>
    </Modal>
  );
}
