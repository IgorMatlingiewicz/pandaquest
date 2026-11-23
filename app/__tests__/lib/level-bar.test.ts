import { createInstance } from "i18next";
import en from "@/i18n/locales/en";
import pl from "@/i18n/locales/pl";
import { levelBarView } from "@/lib/level-bar";

describe("levelBarView", () => {
  it("fills by the XP into the level and counts what is left", () => {
    expect(
      levelBarView({
        level: 14,
        xpIntoLevel: 158,
        xpForNextLevel: 170,
        isMax: false,
      }),
    ).toEqual({
      isMax: false,
      level: 14,
      percent: (158 / 170) * 100,
      current: 158,
      total: 170,
      remaining: 12,
      nextLevel: 15,
    });
  });

  it("is almost empty at the start of level 1", () => {
    const view = levelBarView({
      level: 1,
      xpIntoLevel: 10,
      xpForNextLevel: 100,
      isMax: false,
    });

    expect(view).toMatchObject({ percent: 10, remaining: 90, nextLevel: 2 });
  });

  it("is full at the top level, with nothing left to count", () => {
    expect(
      levelBarView({
        level: 50,
        xpIntoLevel: 0,
        xpForNextLevel: null,
        isMax: true,
      }),
    ).toEqual({ isMax: true, level: 50, percent: 100 });
  });

  it("never goes past its ends", () => {
    expect(
      levelBarView({
        level: 3,
        xpIntoLevel: 130,
        xpForNextLevel: 110,
        isMax: false,
      }),
    ).toMatchObject({ percent: 100, current: 110, remaining: 0 });
    expect(
      levelBarView({
        level: 3,
        xpIntoLevel: -5,
        xpForNextLevel: 110,
        isMax: false,
      }),
    ).toMatchObject({ percent: 0, current: 0, remaining: 110 });
  });
});

describe("level bar texts", () => {
  const i18n = createInstance();

  beforeAll(async () => {
    await i18n.init({
      lng: "pl",
      resources: { pl: { translation: pl }, en: { translation: en } },
    });
  });

  it("say how much is left in Polish and English", () => {
    expect(i18n.t("xp.toNext", { xp: 12, level: 15 })).toBe(
      "12 XP do poziomu 15",
    );
    expect(i18n.getFixedT("en")("xp.toNext", { xp: 12, level: 15 })).toBe(
      "12 XP to level 15",
    );
  });

  it("give a screen reader the whole value in words", () => {
    const values = { current: 158, total: 170, xp: 12, level: 15 };

    expect(i18n.t("xp.barValue", values)).toBe(
      "158 z 170 XP, 12 XP do poziomu 15",
    );
    expect(i18n.getFixedT("en")("xp.barValue", values)).toBe(
      "158 of 170 XP, 12 XP to level 15",
    );
  });
});
