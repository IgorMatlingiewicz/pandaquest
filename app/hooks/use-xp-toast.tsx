import { useTranslation } from "react-i18next";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";
import type { XpAward } from "@/types/api";

// A short toast for XP from a task. Badges and level-ups get a window of
// their own (RewardsContext).
export function useXpToast() {
  const toast = useToast();
  const { t, i18n } = useTranslation();

  return function showXpAward(award: XpAward) {
    const message =
      award.multiplier > 1
        ? t("xp.gainedWithMultiplier", {
            amount: award.amount,
            multiplier: new Intl.NumberFormat(i18n.language).format(
              award.multiplier,
            ),
          })
        : t("xp.gained", { amount: award.amount });

    toast.show({
      placement: "top",
      duration: 3000,
      render: ({ id }) => (
        <Toast nativeID={`toast-${id}`} action="success" variant="solid">
          <ToastTitle>{message}</ToastTitle>
        </Toast>
      ),
    });
  };
}
