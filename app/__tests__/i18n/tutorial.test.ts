import { createInstance } from "i18next";
import en from "@/i18n/locales/en";
import pl from "@/i18n/locales/pl";
import { TUTORIAL_STEP_COUNT, TUTORIAL_STEPS } from "@/lib/tutorial";

describe("tutorial texts", () => {
  const i18n = createInstance();

  beforeAll(async () => {
    await i18n.init({
      lng: "pl",
      resources: { pl: { translation: pl }, en: { translation: en } },
    });
  });

  const stepKeys = TUTORIAL_STEPS.flatMap(({ key }) => [
    `tutorial.steps.${key}.title`,
    `tutorial.steps.${key}.body`,
  ]);
  const otherKeys = [
    "tutorial.counter",
    "tutorial.heading",
    "tutorial.back",
    "tutorial.next",
    "tutorial.finish",
    "tutorial.retry",
    "tutorial.saving",
    "tutorial.close",
    "tutorial.saveError",
    "tutorial.menuHint",
    "tutorial.closeConfirm.title",
    "tutorial.closeConfirm.message",
    "tutorial.closeConfirm.confirm",
    "tutorial.closeConfirm.cancel",
    "tutorial.farewell.title",
    "tutorial.farewell.message",
    "tutorial.farewell.action",
    "profile.settings.replayTutorial",
  ];

  describe.each(["pl", "en"])("in %s", (lng) => {
    it.each([...stepKeys, ...otherKeys])("has %s", (key) => {
      const text = i18n.getFixedT(lng)(key);
      expect(i18n.exists(key, { lng })).toBe(true);
      expect(text.trim()).not.toBe("");
    });
  });

  it("shows the counter as n/9 and tells a screen reader the whole step", () => {
    const values = {
      step: 3,
      total: TUTORIAL_STEP_COUNT,
      title: "XP i poziomy",
    };
    expect(i18n.t("tutorial.counter", values)).toBe("3/9");
    expect(i18n.t("tutorial.heading", values)).toBe("Krok 3 z 9: XP i poziomy");
    expect(
      i18n.getFixedT("en")("tutorial.heading", {
        ...values,
        title: "XP and levels",
      }),
    ).toBe("Step 3 of 9: XP and levels");
  });

  // The steps name buttons as the screens show them; a renamed button must
  // be renamed here too.
  it.each([
    ["pl", "tutorial.steps.tasks.body", ["tasks.addCategory", "tasks.addTask"]],
    ["en", "tutorial.steps.tasks.body", ["tasks.addCategory", "tasks.addTask"]],
    [
      "pl",
      "tutorial.steps.friends.body",
      ["friends.add.label", "friends.tabs.requests"],
    ],
    [
      "en",
      "tutorial.steps.friends.body",
      ["friends.add.label", "friends.tabs.requests"],
    ],
    ["pl", "tutorial.steps.profile.body", ["profile.settings.replayTutorial"]],
    ["en", "tutorial.steps.profile.body", ["profile.settings.replayTutorial"]],
  ])("%s: %s names the real buttons", (lng, key, labels) => {
    const t = i18n.getFixedT(lng);
    for (const label of labels) {
      expect(t(key)).toContain(t(label));
    }
  });
});
