import { createInstance } from "i18next";
import en from "@/i18n/locales/en";
import pl from "@/i18n/locales/pl";

describe("reminders texts", () => {
  const i18n = createInstance();

  beforeAll(async () => {
    await i18n.init({
      lng: "pl",
      resources: { pl: { translation: pl }, en: { translation: en } },
    });
  });

  it.each([
    [1, "1 niezrobione zadanie dzienne"],
    [2, "2 niezrobione zadania dzienne"],
    [4, "4 niezrobione zadania dzienne"],
    [5, "5 niezrobionych zadań dziennych"],
    [12, "12 niezrobionych zadań dziennych"],
    [22, "22 niezrobione zadania dzienne"],
    [25, "25 niezrobionych zadań dziennych"],
  ])("count %i open daily tasks in Polish", (count, phrase) => {
    expect(i18n.t("reminders.daily", { count })).toContain(
      `jeszcze ${phrase}.`,
    );
  });

  it.each([
    [1, "(1 dzień)"],
    [2, "(2 dni)"],
    [5, "(5 dni)"],
    [21, "(21 dni)"],
  ])("name a %i-day streak in Polish", (count, phrase) => {
    expect(i18n.t("reminders.streakDays", { count })).toBe(
      `Uwaga: Twoja seria ${phrase} jest zagrożona!`,
    );
  });

  it.each([
    [1, "(1 tydzień)"],
    [2, "(2 tygodnie)"],
    [4, "(4 tygodnie)"],
    [5, "(5 tygodni)"],
    [12, "(12 tygodni)"],
    [22, "(22 tygodnie)"],
  ])("name a %i-week streak in Polish", (count, phrase) => {
    expect(i18n.t("reminders.streakWeeks", { count })).toBe(
      `Uwaga: Twoja seria ${phrase} jest zagrożona!`,
    );
  });

  it.each([
    [1, "Masz 1 nowe zaproszenie do znajomych."],
    [3, "Masz 3 nowe zaproszenia do znajomych."],
    [5, "Masz 5 nowych zaproszeń do znajomych."],
    [12, "Masz 12 nowych zaproszeń do znajomych."],
    [24, "Masz 24 nowe zaproszenia do znajomych."],
  ])("count %i friend requests in Polish", (count, sentence) => {
    expect(i18n.t("reminders.friends", { count })).toContain(sentence);
  });

  describe("in English", () => {
    const english = () => i18n.getFixedT("en");

    it("use the singular for one task and one request", () => {
      expect(english()("reminders.daily", { count: 1 })).toContain(
        "you still have 1 daily task to do.",
      );
      expect(english()("reminders.daily", { count: 3 })).toContain(
        "you still have 3 daily tasks to do.",
      );
      expect(english()("reminders.friends", { count: 1 })).toContain(
        "You have 1 new friend request.",
      );
      expect(english()("reminders.friends", { count: 2 })).toContain(
        "You have 2 new friend requests.",
      );
    });

    it("name the streak with the number as an adjective", () => {
      expect(english()("reminders.streakDays", { count: 1 })).toBe(
        "Heads up: your 1-day streak is at risk!",
      );
      expect(english()("reminders.streakWeeks", { count: 5 })).toBe(
        "Heads up: your 5-week streak is at risk!",
      );
    });
  });

  it("call the streak by the statistics tile's name", () => {
    expect(i18n.t("reminders.streakDays", { count: 2 })).toContain(
      pl.stats.tiles.streak.toLowerCase(),
    );
    expect(english("reminders.streakDays")).toContain(
      en.stats.tiles.streak.toLowerCase(),
    );

    function english(key: string) {
      return i18n.getFixedT("en")(key, { count: 2 });
    }
  });
});
