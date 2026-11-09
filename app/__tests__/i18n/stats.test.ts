import { createInstance } from "i18next";
import en from "@/i18n/locales/en";
import pl from "@/i18n/locales/pl";

describe("stats texts", () => {
  const i18n = createInstance();

  beforeAll(async () => {
    await i18n.init({
      lng: "pl",
      resources: { pl: { translation: pl }, en: { translation: en } },
    });
  });

  it.each([
    [0, "0 zadań"],
    [1, "1 zadanie"],
    [2, "2 zadania"],
    [5, "5 zadań"],
    [12, "12 zadań"],
    [22, "22 zadania"],
  ])("name %i completions in Polish", (count, text) => {
    expect(i18n.t("stats.activity.completions", { count })).toBe(text);
  });

  it.each([
    [1, "1 dzień"],
    [3, "3 dni"],
    [22, "22 dni"],
  ])("name a streak of %i days in Polish", (count, text) => {
    expect(i18n.t("stats.tiles.days", { count })).toBe(text);
  });

  it("use the singular for one in English", () => {
    const english = i18n.getFixedT("en");

    expect(english("stats.activity.completions", { count: 1 })).toBe("1 task");
    expect(english("stats.activity.completions", { count: 0 })).toBe("0 tasks");
    expect(english("stats.tiles.days", { count: 1 })).toBe("1 day");
  });
});
