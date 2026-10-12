import { useTranslation } from "react-i18next";
import { Toast, ToastTitle, useToast } from "@/components/ui/toast";

// The xpAward field of a PATCH /tasks/:id response.
export type XpAward = {
  amount: number;
  baseXp: number;
  multiplier: number;
  leveledUp: boolean;
  level: number;
};

export function useXpToast() {
  const toast = useToast();
  const { t, i18n } = useTranslation();

  function show(message: string) {
    toast.show({
      placement: "top",
      duration: 3000,
      render: ({ id }) => (
        <Toast nativeID={`toast-${id}`} action="success" variant="solid">
          <ToastTitle>{message}</ToastTitle>
        </Toast>
      ),
    });
  }

  return function showXpAward(award: XpAward) {
    show(
      award.multiplier > 1
        ? t("xp.gainedWithMultiplier", {
            amount: award.amount,
            multiplier: new Intl.NumberFormat(i18n.language).format(
              award.multiplier,
            ),
          })
        : t("xp.gained", { amount: award.amount }),
    );
    if (award.leveledUp) show(t("xp.levelUp", { level: award.level }));
  };
}
