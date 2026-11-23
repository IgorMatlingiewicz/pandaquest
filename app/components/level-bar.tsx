import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { levelBarView } from "@/lib/level-bar";
import type { LevelProgress } from "@/types/api";

type Props = {
  progress: LevelProgress;
  className?: string;
};

/** Short: the fill follows a change, it does not perform. */
const FILL_ANIMATION_MS = 400;

/*
 * The level and the XP toward the next one. Shown in the top bar, and on the
 * profile screen inside its card instead, so it is never there twice.
 *
 * The colours are the theme's level tokens (global.css), the app's blue:
 * a light track with an outline in the fill colour, so the fill stands out
 * from the track and the track's edge from the background, 3:1 or more in
 * both themes. Built on plain views rather than gluestack's Progress, which
 * puts the bar in the Tab order (tabIndex 1), reports only a percentage and
 * sets the width itself, so it could not be animated.
 */
export function LevelBar({ progress, className }: Props) {
  const { t } = useTranslation();
  const view = levelBarView(progress);
  const levelText = t("xp.level", { level: view.level });

  // Starts where it is; later changes slide. With "reduce motion" on in the
  // system, ReduceMotion.System makes the change instant.
  const fill = useSharedValue(view.percent);
  useEffect(() => {
    fill.value = withTiming(view.percent, {
      duration: FILL_ANIMATION_MS,
      reduceMotion: ReduceMotion.System,
    });
  }, [fill, view.percent]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));

  return (
    <VStack space="xs" className={className}>
      {/* Wraps instead of cutting on a narrow phone: the right part moves
          under the left one. */}
      <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <View className="flex-row items-center gap-2">
          <View className="rounded-full bg-level px-2.5 py-0.5">
            <Text bold className="text-level-foreground">
              {levelText}
            </Text>
          </View>
          {!view.isMax && (
            <Text size="sm">
              {t("xp.toNext", { xp: view.remaining, level: view.nextLevel })}
            </Text>
          )}
        </View>
        {/* Bold: the numbers are what the bar stands for. */}
        <Text size="sm" bold>
          {view.isMax
            ? t("xp.maxLevel")
            : t("xp.progress", { current: view.current, total: view.total })}
        </Text>
      </View>

      <View
        role="progressbar"
        aria-label={levelText}
        aria-valuemin={0}
        aria-valuemax={view.isMax ? 100 : view.total}
        aria-valuenow={view.isMax ? 100 : view.current}
        aria-valuetext={
          view.isMax
            ? t("xp.maxLevel")
            : t("xp.barValue", {
                current: view.current,
                total: view.total,
                xp: view.remaining,
                level: view.nextLevel,
              })
        }
        className="h-3 w-full overflow-hidden rounded-full border border-level bg-level-track"
      >
        <Animated.View style={[{ height: "100%" }, fillStyle]}>
          <View className="flex-1 rounded-full bg-level" />
        </Animated.View>
      </View>
    </VStack>
  );
}
