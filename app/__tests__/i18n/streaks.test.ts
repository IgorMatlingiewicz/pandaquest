import { createInstance } from "i18next";
import en from "@/i18n/locales/en";
import pl from "@/i18n/locales/pl";

describe("streaks texts", () => {
  const i18n = createInstance();

  beforeAll(async () => {
    await i18n.init({
      lng: "pl",
      resources: { pl: { translation: pl }, en: { translation: en } },
    });
  });

  it("offer as many encouragements in both languages", () => {
    expect(en.streaks.encouragements).toHaveLength(
      pl.streaks.encouragements.length,
    );
    expect(pl.streaks.encouragements.length).toBeGreaterThanOrEqual(6);
  });

  it.each([
    [1, "1 dzień"],
    [2, "2 dni"],
    [5, "5 dni"],
    [22, "22 dni"],
  ])("name %i days in Polish", (count, text) => {
    expect(i18n.t("streaks.daysCount", { count })).toBe(text);
  });

  it.each([
    [1, "1 godzina"],
    [2, "2 godziny"],
    [5, "5 godzin"],
    [22, "22 godziny"],
  ])("name %i hours in Polish", (count, text) => {
    expect(i18n.t("streaks.hoursCount", { count })).toBe(text);
  });

  it.each([
    [1, "Dodaj cel (został 1)"],
    [2, "Dodaj cel (zostały 2)"],
    [4, "Dodaj cel (zostały 4)"],
  ])("name %i goals left in Polish", (count, text) => {
    expect(i18n.t("streaks.addGoalLeft", { count })).toBe(text);
  });

  it("name the unit alone next to the big number", () => {
    expect(i18n.t("streaks.daysUnit", { count: 1 })).toBe("dzień");
    expect(i18n.t("streaks.daysUnit", { count: 12 })).toBe("dni");
  });

  it("use the singular for one day in English", () => {
    const english = i18n.getFixedT("en");

    expect(english("streaks.daysCount", { count: 1 })).toBe("1 day");
    expect(english("streaks.daysCount", { count: 2 })).toBe("2 days");
  });
});
