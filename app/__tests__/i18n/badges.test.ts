import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInstance } from "i18next";
import en from "@/i18n/locales/en";
import pl from "@/i18n/locales/pl";

/*
 * Every badge of the server's catalog has a name and a description in both
 * languages. The catalog lives in the backend, a project of its own the app
 * cannot import, so its source is read as text: a badge added there without
 * texts fails here, instead of showing its raw key on the achievements
 * screen ("bright_start" instead of "Jasny początek").
 */
const CATALOG = join(__dirname, "../../../backend/src/badges/badges.config.ts");
const catalogKeys = [
  ...readFileSync(CATALOG, "utf8").matchAll(/key: '([a-z_]+)'/g),
].map((match) => match[1]);

describe("badge texts", () => {
  const i18n = createInstance();

  beforeAll(async () => {
    await i18n.init({
      lng: "pl",
      resources: { pl: { translation: pl }, en: { translation: en } },
    });
  });

  it("finds the whole catalog in the backend source", () => {
    // 12 badges: a smaller number means the pattern above went stale.
    expect(catalogKeys).toHaveLength(12);
    expect(catalogKeys).toContain("bright_start");
  });

  describe.each(["pl", "en"])("in %s", (lng) => {
    it.each(catalogKeys)("names %s", (key) => {
      expect(i18n.exists(`badges.names.${key}`, { lng })).toBe(true);
    });

    // The card passes the tier's threshold as count, so a description may
    // be plural forms only (daily_streak_one, ...) or one plain text.
    it.each(catalogKeys)("describes %s", (key) => {
      for (const count of [1, 2, 5]) {
        expect(i18n.exists(`badges.descriptions.${key}`, { lng, count })).toBe(
          true,
        );
      }
    });
  });

  it("calls the tutorial badge Jasny początek / Bright Start", () => {
    // count: 1, as the achievements card passes the threshold.
    expect(i18n.t("badges.names.bright_start")).toBe("Jasny początek");
    expect(i18n.t("badges.descriptions.bright_start", { count: 1 })).toBe(
      "Przejdź samouczek",
    );
    const t = i18n.getFixedT("en");
    expect(t("badges.names.bright_start")).toBe("Bright Start");
    expect(t("badges.descriptions.bright_start", { count: 1 })).toBe(
      "Complete the tutorial",
    );
  });
});
