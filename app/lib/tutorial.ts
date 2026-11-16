import { NAV_INLINE } from "@/constants/layout";
import type { TutorialStatus } from "@/types/api";

/*
 * The onboarding tutorial without React: which steps there are, where each
 * one takes the app, and how to move between them. Steps are numbered from
 * 1, as the user sees them ("3/9"), so nothing here converts indexes.
 */

/** A page of the app a step shows; the Progress tab picks its tab by param. */
export type TutorialRoute =
  "/" | "/streaks" | "/progress" | "/friends" | "/profile";

export type ProgressTab = "stats" | "achievements";

export type TutorialStep = {
  /** Under tutorial.steps.<key> in the translations: title and body. */
  key: string;
  route: TutorialRoute;
  /** Only for /progress: the tab, set through the screen's ?tab= param. */
  tab?: ProgressTab;
};

/**
 * The steps in order. Read-only: each one only describes the page behind
 * it, which the app opens on its own, so nothing has to be found in a menu.
 */
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { key: "welcome", route: "/" },
  { key: "tasks", route: "/" },
  { key: "xp", route: "/" },
  { key: "streaks", route: "/streaks" },
  { key: "stats", route: "/progress", tab: "stats" },
  { key: "achievements", route: "/progress", tab: "achievements" },
  { key: "friends", route: "/friends" },
  { key: "profile", route: "/profile" },
  { key: "honesty", route: "/profile" },
];

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;

export const FIRST_STEP = 1;

/** A step number kept within 1…count; whole numbers only. */
export function clampStep(step: number): number {
  return Math.min(TUTORIAL_STEP_COUNT, Math.max(FIRST_STEP, Math.trunc(step)));
}

/** The step after `step`; the last one stays where it is. */
export function nextStep(step: number): number {
  return clampStep(step + 1);
}

/** The step before `step`; the first one stays where it is. */
export function previousStep(step: number): number {
  return clampStep(step - 1);
}

export const isFirstStep = (step: number) => clampStep(step) === FIRST_STEP;

export const isLastStep = (step: number) =>
  clampStep(step) === TUTORIAL_STEP_COUNT;

/** The step's description; any number is clamped first. */
export function stepAt(step: number): TutorialStep {
  return TUTORIAL_STEPS[clampStep(step) - 1];
}

/**
 * Where the router goes for a step: the page, and for Progress the tab
 * through the param the screen already reads (/progress?tab=achievements).
 */
export function stepHref(
  step: number,
):
  | { pathname: TutorialRoute }
  | { pathname: "/progress"; params: { tab: ProgressTab } } {
  const { route, tab } = stepAt(step);
  return tab ? { pathname: "/progress", params: { tab } } : { pathname: route };
}

/**
 * Whether the first step adds where the menu is: only when the page links
 * are behind the burger, below NAV_INLINE (not the cards' 768 px).
 */
export function showsMenuHint(windowWidth: number): boolean {
  return windowWidth < NAV_INLINE;
}

/**
 * Whether the tutorial should start on its own: an account that has neither
 * skipped nor finished it, and only once per session (`startedFor` holds the
 * id of the account it already started for). The once-only guard also keeps
 * it from coming back in the same session when skipping could not be saved.
 */
export function shouldStartTutorial(
  user: { id: string; tutorialStatus: TutorialStatus } | null,
  startedFor: string | null,
): boolean {
  return (
    user !== null &&
    user.tutorialStatus === "NOT_STARTED" &&
    startedFor !== user.id
  );
}
