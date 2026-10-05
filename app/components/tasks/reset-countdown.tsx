import { useEffect, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

const MINUTE = 60_000;

type Props = {
  cycleType: "DAILY" | "WEEKLY";
  // ISO timestamp of the next reset, as computed by the backend.
  endsAt: string;
  onExpire: () => void;
};

export function ResetCountdown({ cycleType, endsAt, onExpire }: Props) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const expiredFor = useRef<string | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const remainingMs = new Date(endsAt).getTime() - now;

  useEffect(() => {
    if (remainingMs <= 0) {
      // Fire once per period end; the reload brings the next endsAt.
      if (expiredFor.current !== endsAt) {
        expiredFor.current = endsAt;
        onExpireRef.current();
      }
      return;
    }

    // Wake up when the displayed minute changes.
    const timer = setTimeout(
      () => setNow(Date.now()),
      (remainingMs % MINUTE || MINUTE) + 50,
    );
    return () => clearTimeout(timer);
  }, [remainingMs, endsAt]);

  // Round up so "0 min" only shows once the period is really over.
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / MINUTE));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;

  const label =
    cycleType === "WEEKLY"
      ? t("tasks.resetIn.weekly", { days, hours, minutes })
      : t("tasks.resetIn.daily", { hours: days * 24 + hours, minutes });

  return (
    <HStack space="xs" className="items-center" style={{ opacity: 0.6 }}>
      <MaterialCommunityIcons name="timer-sand" size={12} color="#999" />
      <Text size="xs" className="text-muted-foreground">
        {label}
      </Text>
    </HStack>
  );
}
