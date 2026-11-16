import { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Modal,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useTutorial } from "@/context/TutorialContext";
import { useIsWide } from "@/hooks/use-is-wide";
import {
  isFirstStep,
  isLastStep,
  showsMenuHint,
  stepAt,
  TUTORIAL_STEP_COUNT,
} from "@/lib/tutorial";

/*
 * The tutorial over the app: a dimmed backdrop and one card. No spotlight:
 * every step opens its page, and the card describes it in words.
 *
 * A React Native Modal, as every window of the app (ConfirmDialog,
 * RewardModal). On the web it already keeps Tab inside, puts the focus in
 * it, closes on Escape through onRequestClose (only the topmost window
 * does) and is a dialog to screen readers (role="dialog", aria-modal). On
 * iOS it is a window of its own, so VoiceOver stays in it. Android's back
 * button goes through onRequestClose too.
 *
 * The backdrop has no onPress: it takes every touch, so nothing under it
 * can be used, and it never closes the tutorial by accident.
 */
export function TutorialOverlay() {
  const { t } = useTranslation();
  const tutorial = useTutorial();
  const { state } = tutorial;
  const isWide = useIsWide();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const headingRef = useRef<View>(null);
  const running = state.phase === "running";
  const step = running ? state.step : 1;

  // Each step moves the focus to its heading, so a screen reader reads the
  // new step at once instead of staying on the button just pressed.
  useEffect(() => {
    if (!running || !headingRef.current) return;
    if (Platform.OS === "web") {
      (headingRef.current as unknown as HTMLElement).focus();
    } else {
      AccessibilityInfo.sendAccessibilityEvent(headingRef.current, "focus");
    }
  }, [running, step]);

  const { key } = stepAt(step);
  const title = t(`tutorial.steps.${key}.title`);
  const last = isLastStep(step);
  const saving = running && state.saving;
  const saveFailed = running && state.saveFailed;

  const nextLabel = !last
    ? t("tutorial.next")
    : saving
      ? t("tutorial.saving")
      : saveFailed
        ? t("tutorial.retry")
        : t("tutorial.finish");

  // Wide: the bottom right corner, out of the way of the page. Narrow: the
  // bottom, full width with the app's 16 px margins, above the home bar.
  const placement = isWide
    ? { right: 24, bottom: 24, width: "100%" as const, maxWidth: 420 }
    : { left: 16, right: 16, bottom: 16 + insets.bottom };

  return (
    <Modal
      visible={running}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={tutorial.requestClose}
    >
      <View className="flex-1 bg-black/40">
        <Card className="p-5" style={{ position: "absolute", ...placement }}>
          {/* First in the card: the focus trap focuses the first element it
              can, so the window opens on the step, not on the X. The
              counter is drawn but not read: the heading says it in words.
              No visible focus ring: the heading is no control (Tab never
              reaches it); the focus only tells a screen reader where to
              start reading. outline-none keeps a transparent outline, which
              a high-contrast mode can still show. */}
          <View
            ref={headingRef}
            tabIndex={-1}
            role="heading"
            aria-level={2}
            aria-label={t("tutorial.heading", {
              step,
              total: TUTORIAL_STEP_COUNT,
              title,
            })}
            className="pr-12 outline-none"
          >
            <Text size="xs" className="text-muted-foreground" aria-hidden>
              {t("tutorial.counter", { step, total: TUTORIAL_STEP_COUNT })}
            </Text>
            <Text size="xl" bold>
              {title}
            </Text>
          </View>

          <Text>
            {t(`tutorial.steps.${key}.body`)}
            {key === "welcome" && showsMenuHint(width)
              ? ` ${t("tutorial.menuHint")}`
              : ""}
          </Text>

          {saveFailed && (
            // role="alert": read out at once, without moving the focus.
            <View role="alert">
              <Text size="sm" className="text-destructive">
                {t("tutorial.saveError")}
              </Text>
            </View>
          )}

          <View className="mt-1 flex-row justify-end gap-2">
            {!isFirstStep(step) && (
              <Button
                variant="outline"
                className="min-h-11"
                onPress={tutorial.back}
                isDisabled={saving}
              >
                <ButtonText>{t("tutorial.back")}</ButtonText>
              </Button>
            )}
            <Button
              className="min-h-11"
              onPress={last ? tutorial.finish : tutorial.next}
              isDisabled={saving}
            >
              <ButtonText>{nextLabel}</ButtonText>
            </Button>
          </View>

          <Pressable
            onPress={tutorial.requestClose}
            role="button"
            aria-label={t("tutorial.close")}
            disabled={saving}
            className="absolute right-2 top-2 h-11 w-11 items-center justify-center"
          >
            <MaterialCommunityIcons name="close" size={22} color="#999" />
          </Pressable>
        </Card>

        {/* Inside this window, not beside it: on iOS a second Modal next to
            a visible one may not show. */}
        <ConfirmDialog
          request={
            running && state.confirmingClose
              ? {
                  title: t("tutorial.closeConfirm.title"),
                  message: t("tutorial.closeConfirm.message"),
                  confirmLabel: t("tutorial.closeConfirm.confirm"),
                  cancelLabel: t("tutorial.closeConfirm.cancel"),
                  onConfirm: tutorial.confirmClose,
                }
              : null
          }
          onClose={tutorial.cancelClose}
        />
      </View>
    </Modal>
  );
}
