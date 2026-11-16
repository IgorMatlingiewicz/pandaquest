import { NAV_INLINE } from "@/constants/layout";
import {
  clampStep,
  FIRST_STEP,
  isFirstStep,
  isLastStep,
  nextStep,
  previousStep,
  shouldStartTutorial,
  showsMenuHint,
  stepAt,
  stepHref,
  TUTORIAL_STEP_COUNT,
  TUTORIAL_STEPS,
} from "@/lib/tutorial";
import type { TutorialStatus } from "@/types/api";

describe("the tutorial steps", () => {
  it("are 9, in the agreed order and on the agreed pages", () => {
    expect(TUTORIAL_STEP_COUNT).toBe(9);
    expect(TUTORIAL_STEPS.map((s) => [s.key, s.route, s.tab])).toEqual([
      ["welcome", "/", undefined],
      ["tasks", "/", undefined],
      ["xp", "/", undefined],
      ["streaks", "/streaks", undefined],
      ["stats", "/progress", "stats"],
      ["achievements", "/progress", "achievements"],
      ["friends", "/friends", undefined],
      ["profile", "/profile", undefined],
      ["honesty", "/profile", undefined],
    ]);
  });

  it("have a tab only on the Progress page", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.tab !== undefined).toBe(step.route === "/progress");
    }
  });
});

describe("moving between steps", () => {
  it("goes forward one step at a time and stops at the last", () => {
    expect(nextStep(1)).toBe(2);
    expect(nextStep(8)).toBe(9);
    expect(nextStep(9)).toBe(9);
  });

  it("goes back one step at a time and never before the first", () => {
    expect(previousStep(9)).toBe(8);
    expect(previousStep(2)).toBe(1);
    expect(previousStep(1)).toBe(1);
  });

  it("walks the whole tutorial forward and back", () => {
    const forward = [FIRST_STEP];
    while (!isLastStep(forward.at(-1)!))
      forward.push(nextStep(forward.at(-1)!));
    expect(forward).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const back = [TUTORIAL_STEP_COUNT];
    while (!isFirstStep(back.at(-1)!)) back.push(previousStep(back.at(-1)!));
    expect(back).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
  });

  it.each([
    [0, 1],
    [-3, 1],
    [1, 1],
    [5, 5],
    [9, 9],
    [10, 9],
    [4.7, 4], // no half steps
  ])("keeps %d within the steps as %d", (step, kept) => {
    expect(clampStep(step)).toBe(kept);
  });

  it("knows the first and the last step", () => {
    expect([isFirstStep(1), isFirstStep(2)]).toEqual([true, false]);
    expect([isLastStep(9), isLastStep(8)]).toEqual([true, false]);
  });
});

describe("stepHref", () => {
  it("opens the page of the step", () => {
    expect(stepHref(1)).toEqual({ pathname: "/" });
    expect(stepHref(4)).toEqual({ pathname: "/streaks" });
    expect(stepHref(7)).toEqual({ pathname: "/friends" });
    expect(stepHref(9)).toEqual({ pathname: "/profile" });
  });

  it("picks the Progress tab through the screen's own param", () => {
    expect(stepHref(5)).toEqual({
      pathname: "/progress",
      params: { tab: "stats" },
    });
    expect(stepHref(6)).toEqual({
      pathname: "/progress",
      params: { tab: "achievements" },
    });
  });

  it("clamps a number outside the steps", () => {
    expect(stepAt(0).key).toBe("welcome");
    expect(stepAt(99).key).toBe("honesty");
  });
});

describe("showsMenuHint", () => {
  // The links sit in the top bar from NAV_INLINE, not from the cards' 768.
  it.each([
    [390, true],
    [768, true],
    [NAV_INLINE - 1, true],
    [NAV_INLINE, false],
    [1440, false],
  ])("at %d px: %s", (width, shown) => {
    expect(showsMenuHint(width)).toBe(shown);
  });
});

describe("shouldStartTutorial", () => {
  const user = (tutorialStatus: TutorialStatus) => ({
    id: "user-1",
    tutorialStatus,
  });

  it("starts for an account that has not seen it", () => {
    expect(shouldStartTutorial(user("NOT_STARTED"), null)).toBe(true);
  });

  it.each(["DISMISSED", "COMPLETED"] as const)(
    "does not start once %s",
    (status) => {
      expect(shouldStartTutorial(user(status), null)).toBe(false);
    },
  );

  it("starts once per session for the same account", () => {
    expect(shouldStartTutorial(user("NOT_STARTED"), "user-1")).toBe(false);
  });

  it("starts for another account logged in in the same session", () => {
    expect(shouldStartTutorial(user("NOT_STARTED"), "user-0")).toBe(true);
  });

  it("waits while nobody is logged in", () => {
    expect(shouldStartTutorial(null, null)).toBe(false);
  });
});
