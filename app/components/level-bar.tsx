import { useTranslation } from "react-i18next";
import { HStack } from "@/components/ui/hstack";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { LevelProgress } from "@/types/api";

type Props = {
  progress: LevelProgress;
  className?: string;
};

// The level and the XP toward the next one. Shown in the top bar, and on the
// profile screen inside its card instead, so it is never there twice.
export function LevelBar({ progress, className }: Props) {
  const { t } = useTranslation();

  // Derived on every render from the server's numbers; no state of its own.
  const percent =
    progress.xpForNextLevel === null
      ? 100
      : (progress.xpIntoLevel / progress.xpForNextLevel) * 100;

  return (
    <VStack space="xs" className={className}>
      <HStack className="items-center justify-between">
        <Text size="sm" bold>
          {t("xp.level", { level: progress.level })}
        </Text>
        <Text size="sm" className="text-muted-foreground">
          {progress.xpForNextLevel === null
            ? t("xp.maxLevel")
            : t("xp.progress", {
                current: progress.xpIntoLevel,
                total: progress.xpForNextLevel,
              })}
        </Text>
      </HStack>
      <Progress value={percent}>
        <ProgressFilledTrack />
      </Progress>
    </VStack>
  );
}
